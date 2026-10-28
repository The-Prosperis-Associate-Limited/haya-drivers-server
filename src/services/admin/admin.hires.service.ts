import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotificationService } from "../shared/notification.service";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { formatMoney } from "../../utils/money";
import { paginate } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import { surfaceUrlFor } from "../../utils/surfaceUrl";
import { computeHireFee, ContractDurationRequiredError, type HireClientType, type HireFeeQuote } from "../../utils/hirePricing";
import type { AssignDriverInput, DeclineHireRequestInput, GenerateInvoiceInput, HireRequestListQuery, RejectProofInput } from "../../utils/types/hireValidatorSchema";

// Nigeria's standard VAT unless the invoice overrides it.
const { HIRE_VAT_PERCENT } = process.env;
const defaultVatPercent = Number(HIRE_VAT_PERCENT ?? 7.5);

export class AdminHiresService {
  private hireRepo = new HireRequestRepository();
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();

  async list(query: HireRequestListQuery) {
    const [{ requests, total }, counts] = await Promise.all([this.hireRepo.listForAdmin(query), this.hireRepo.countByStatus()]);

    return { ...paginate(requests, total, { page: query.page, limit: query.limit }), counts };
  }

  async get(reference: string) {
    const request = await this.requireRequest(reference);

    return request;
  }

  /*
    Shortlisting is parallel outreach: the admin adds as many candidates as
    they like, every one gets an availability ping, and the crew is trimmed to
    drivers_needed before invoicing. Nothing waits on a single driver's reply.
  */
  async assignDriver(reference: string, adminId: string, data: AssignDriverInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be assigned a driver");
    if (request.assignments.some(a => a.driverId === data.driverId)) throw new BadRequestError("That driver is already on this request's shortlist");

    const driverProfile = await this.driverProfileRepo.findByUserId(data.driverId, { verification_status: true });

    if (!driverProfile) throw new NotFoundError("Driver not found");
    if (driverProfile.verification_status !== "APPROVED") throw new BadRequestError("That driver is not approved for hire");

    const open = await this.hireRepo.findOpenForClientAndDriver(request.clientId, data.driverId);

    if (open && open.id !== request.id) throw new BadRequestError(`This client already has an open request for that driver (${open.reference})`);

    await this.hireRepo.addAssignment(request.id, data.driverId);

    await this.notificationService.notify({
      recipientId: data.driverId,
      senderId: adminId,
      type: "BOOKING_REQUEST",
      title: "You've been shortlisted for an engagement",
      message: `You're a candidate for a ${request.engagement_type === "MONTHLY" ? "full-time" : "contract"} engagement starting ${request.starts_at.toDateString()}${request.state ? ` in ${request.state}` : ""}. Confirm your availability from your dashboard.`,
      actionUrl: "/dashboard",
      metadata: { reference: request.reference },
    });

    const driverContact = await this.userRepo.findById(data.driverId, { email: true, first_name: true });

    if (driverContact?.email) {
      await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
        email: driverContact.email as string,
        first_name: (driverContact.first_name as string) ?? "there",
        event: "SHORTLISTED",
        reference: request.reference,
        date: request.starts_at.toDateString(),
        counterpart: request.state ?? undefined,
        actionUrl: `${surfaceUrlFor("DRIVER")}/dashboard`,
      });
    }

    return this.requireRequest(reference);
  }

  async unassignDriver(reference: string, adminId: string, data: AssignDriverInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can have a driver removed");

    await this.hireRepo.removeAssignment(request.id, data.driverId);

    return this.requireRequest(reference);
  }

  /*
    The invoice charges ONLY the platform service fee plus VAT on that fee -
    the client pays the drivers' salaries directly. The quote shares the exact
    computation with generation so what the admin previews is what gets issued.
  */
  private quoteFor(request: Awaited<ReturnType<AdminHiresService["requireRequest"]>>, overrides: { per_driver_minor?: number; vat_percent?: number }) {
    if (request.assignments.length !== request.drivers_needed) {
      throw new BadRequestError(`Trim the shortlist to exactly ${request.drivers_needed} driver(s) before invoicing - ${request.assignments.length} on it now`);
    }

    const advertised = request.assignments.map(a => a.driver.driver_profile?.expected_monthly_rate ?? 0);
    const perDriver = overrides.per_driver_minor ?? Math.max(...advertised);

    if (perDriver <= 0) throw new BadRequestError("No assigned driver has an advertised rate - set the per-driver salary");

    const clientType: HireClientType = request.client.client_profile?.client_type === "ORGANISATION" ? "ORGANISATION" : "INDIVIDUAL";

    // Brokered hires are only ever MONTHLY or CONTRACT; ONE_OFF lives on the
    // retired direct-booking rail.
    const engagement = request.engagement_type === "CONTRACT" ? ("CONTRACT" as const) : ("MONTHLY" as const);

    let quote: HireFeeQuote;

    try {
      quote = computeHireFee({
        engagement_type: engagement,
        client_type: clientType,
        drivers: request.assignments.length,
        per_driver_monthly_minor: perDriver,
        duration_days: request.duration_days,
      });
    } catch (error) {
      if (error instanceof ContractDurationRequiredError) throw new BadRequestError(error.message);
      throw error;
    }

    const vatPercent = overrides.vat_percent ?? defaultVatPercent;
    const vat = Math.round((quote.fee_minor * vatPercent) / 100);
    const currency = request.assignments[0].driver.driver_profile?.rate_currency ?? "NGN";

    return {
      client_type: clientType,
      engagement_type: request.engagement_type,
      duration_days: request.duration_days,
      drivers: request.assignments.length,
      per_driver_minor: perDriver,
      fee_minor: quote.fee_minor,
      lines: quote.lines,
      vat_percent: vatPercent,
      vat_minor: vat,
      total_minor: quote.fee_minor + vat,
      currency,
    };
  }

  async quoteInvoice(reference: string, overrides: { per_driver_minor?: number; vat_percent?: number }) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be quoted");

    return this.quoteFor(request, overrides);
  }

  async generateInvoice(reference: string, adminId: string, data: GenerateInvoiceInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be invoiced");

    const quote = this.quoteFor(request, { per_driver_minor: data.amount_minor, vat_percent: data.vat_percent });

    await this.hireRepo.createInvoice({
      hireRequestId: request.id,
      issuedById: adminId,
      reference: generateReference("INV"),
      amount_minor: quote.fee_minor,
      per_driver_minor: quote.per_driver_minor,
      vat_percent: quote.vat_percent,
      vat_minor: quote.vat_minor,
      fee_minor: quote.fee_minor,
      total_minor: quote.total_minor,
      breakdown: quote.lines.map(line => ({ ...line })),
      currency: quote.currency,
      note: data.note,
    });

    const updated = await this.hireRepo.update(request.id, { status: "INVOICED" });

    await this.notificationService.notify({
      recipientId: request.clientId,
      senderId: adminId,
      type: "PAYMENT",
      title: "Your hire invoice is ready",
      message: `Invoice for your request ${request.reference}: ${formatMoney(quote.total_minor, quote.currency)} (service fee + VAT - your driver's salary is paid to them directly). Transfer to our account and upload your proof of payment to receive your driver's contact details.`,
      actionUrl: `/dashboard/my-hire/requests/${request.reference}`,
      metadata: { reference: request.reference },
    });

    await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
      email: request.client.email,
      first_name: request.client.first_name ?? "there",
      event: "INVOICE_READY",
      reference: request.reference,
      amount: formatMoney(quote.total_minor, quote.currency),
      actionUrl: `${surfaceUrlFor("CLIENT")}/dashboard/my-hire/requests/${request.reference}`,
    });

    return updated;
  }

  /*
    The human oracle for a bare bank transfer: the admin has seen the money in
    the organisation account and confirms it. Only then does the engagement
    exist - one already-ACCEPTED booking per assigned driver (admin-brokered,
    no driver-acceptance leg), contact details unlocked. The client pays each
    driver's salary directly - no money for drivers passes through us, so
    nothing is credited to driver wallets here.
  */
  async confirmPayment(reference: string, adminId: string) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PAYMENT_REVIEW" || !request.invoice || request.invoice.status !== "PAYMENT_REVIEW") {
      throw new BadRequestError("This request has no payment awaiting confirmation");
    }
    if (!request.assignments.length) throw new BadRequestError("Assign the driver(s) before confirming payment");

    const invoice = request.invoice;
    const perDriver = invoice.per_driver_minor ?? Math.round(invoice.amount_minor / request.assignments.length);
    const client = await this.userRepo.findById(request.clientId, { address: true, city: true, state_of_residence: true, country: true });

    let firstBookingId: string | null = null;

    for (const assignment of request.assignments) {
      const driver = assignment.driver;
      const driverName = [driver.first_name, driver.last_name].filter(Boolean).join(" ") || "your driver";
      const driverType = request.driver_type ?? driver.driver_profile?.driver_type ?? "PRIVATE_DRIVER";

      const booking = await this.bookingRepo.create({
        clientId: request.clientId,
        driverId: assignment.driverId,
        reference: generateReference("JOB"),
        title: `${request.engagement_type === "MONTHLY" ? "Monthly engagement" : "Contract engagement"} - ${driverName}`,
        description: request.note ?? null,
        driver_type: driverType,
        engagement_type: request.engagement_type,
        pickup_address: (client?.address as string) ?? "To be agreed with the driver",
        country: (client?.country as string) ?? "Nigeria",
        state: request.state ?? (client?.state_of_residence as string) ?? "Lagos",
        city: (client?.city as string) ?? null,
        starts_at: request.starts_at,
        schedule: request.schedule,
        resumption_time: request.resumption_time,
        closing_time: request.closing_time,
        amount: perDriver,
        currency: invoice.currency,
        status: "ACCEPTED",
        accepted_at: new Date(),
      });

      firstBookingId ??= booking.id;

      await this.statusEventRepo.create({ bookingId: booking.id, to_status: "ACCEPTED", changed_by: adminId });

      await this.notificationService.notify({
        recipientId: assignment.driverId,
        senderId: adminId,
        type: "BOOKING_STATUS",
        title: "You've been hired",
        message: `A client has hired you for ${booking.title} starting ${booking.starts_at.toDateString()}. Your salary of ${formatMoney(perDriver, invoice.currency)}/month is paid to you directly by the client.`,
        actionUrl: `/dashboard/job-request/${booking.reference}`,
        metadata: { bookingId: booking.id, reference: booking.reference },
      });

      const driverContact = await this.userRepo.findById(assignment.driverId, { email: true, first_name: true });

      if (driverContact?.email) {
        await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
          email: driverContact.email as string,
          first_name: (driverContact.first_name as string) ?? "there",
          event: "DRIVER_HIRED",
          reference: booking.reference,
          amount: formatMoney(perDriver, invoice.currency),
          counterpart: booking.title,
          date: booking.starts_at.toDateString(),
          actionUrl: `${surfaceUrlFor("DRIVER")}/dashboard/job-request/${booking.reference}`,
        });
      }
    }

    await this.hireRepo.updateInvoice(invoice.id, { status: "PAID", paid_at: new Date(), confirmedById: adminId });
    const updated = await this.hireRepo.update(request.id, { status: "PAID", paid_at: new Date(), bookingId: firstBookingId });

    const count = request.assignments.length;

    await this.notificationService.notify({
      recipientId: request.clientId,
      senderId: adminId,
      type: "PAYMENT",
      title: count > 1 ? "Payment confirmed - your drivers' details are unlocked" : "Payment confirmed - driver details unlocked",
      message: `We've confirmed your payment for ${request.reference}. The contact details of your ${count > 1 ? `${count} drivers` : "driver"} are now available on your request.`,
      actionUrl: `/dashboard/my-hire/requests/${request.reference}`,
      metadata: { reference: request.reference },
    });

    await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
      email: request.client.email,
      first_name: request.client.first_name ?? "there",
      event: "PAYMENT_CONFIRMED",
      reference: request.reference,
      amount: formatMoney(invoice.total_minor, invoice.currency),
      counterpart: count > 1 ? `Your ${count} drivers` : [request.assignments[0].driver.first_name, request.assignments[0].driver.last_name].filter(Boolean).join(" ") || "Your driver",
      actionUrl: `${surfaceUrlFor("CLIENT")}/dashboard/my-hire/requests/${request.reference}`,
    });

    return updated;
  }

  async rejectProof(reference: string, adminId: string, data: RejectProofInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PAYMENT_REVIEW" || !request.invoice || request.invoice.status !== "PAYMENT_REVIEW") {
      throw new BadRequestError("This request has no payment awaiting confirmation");
    }

    await this.hireRepo.updateInvoice(request.invoice.id, { status: "UNPAID", proof_rejected_reason: data.reason });
    const updated = await this.hireRepo.update(request.id, { status: "INVOICED" });

    await this.notificationService.notify({
      recipientId: request.clientId,
      senderId: adminId,
      type: "PAYMENT",
      title: "We couldn't confirm your payment",
      message: `Your proof of payment for ${request.reference} was not accepted: ${data.reason}. Please re-upload a valid receipt.`,
      actionUrl: `/dashboard/my-hire/requests/${request.reference}`,
      metadata: { reference: request.reference },
    });

    await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
      email: request.client.email,
      first_name: request.client.first_name ?? "there",
      event: "PROOF_REJECTED",
      reference: request.reference,
      reason: data.reason,
      actionUrl: `${surfaceUrlFor("CLIENT")}/dashboard/my-hire/requests/${request.reference}`,
    });

    return updated;
  }

  async decline(reference: string, adminId: string, data: DeclineHireRequestInput) {
    const request = await this.requireRequest(reference);

    if (!["PENDING_REVIEW", "INVOICED"].includes(request.status)) throw new BadRequestError("Only an open request can be declined");

    if (request.invoice) await this.hireRepo.updateInvoice(request.invoice.id, { status: "VOID" });

    const updated = await this.hireRepo.update(request.id, { status: "DECLINED", declined_reason: data.reason, declined_at: new Date() });

    await this.notificationService.notify({
      recipientId: request.clientId,
      senderId: adminId,
      type: "BOOKING_STATUS",
      title: "Hire request declined",
      message: `Your request ${request.reference} was declined: ${data.reason}`,
      actionUrl: `/dashboard/my-hire/requests/${request.reference}`,
    });

    return updated;
  }

  private async requireRequest(reference: string) {
    const request = await this.hireRepo.findByReference(reference);

    if (!request) throw new NotFoundError("Hire request not found");

    return request;
  }
}
