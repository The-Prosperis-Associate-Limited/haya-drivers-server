import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { WalletService } from "../earnings/wallet.service";
import { NotificationService } from "../shared/notification.service";
import { paymentFeeFor } from "../client/client.wallet.service";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { formatMoney } from "../../utils/money";
import { paginate } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import { surfaceUrlFor } from "../../utils/surfaceUrl";
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
  private walletService = new WalletService();
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
    A concierge request arrives with no drivers attached; the admin matches
    them one at a time until drivers_needed is met. A named-driver request
    starts with that driver as its first assignment.
  */
  async assignDriver(reference: string, adminId: string, data: AssignDriverInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be assigned a driver");
    if (request.assignments.length >= request.drivers_needed) throw new BadRequestError(`This request only needs ${request.drivers_needed} driver(s)`);
    if (request.assignments.some(a => a.driverId === data.driverId)) throw new BadRequestError("That driver is already assigned to this request");

    const driverProfile = await this.driverProfileRepo.findByUserId(data.driverId, { verification_status: true });

    if (!driverProfile) throw new NotFoundError("Driver not found");
    if (driverProfile.verification_status !== "APPROVED") throw new BadRequestError("That driver is not approved for hire");

    const open = await this.hireRepo.findOpenForClientAndDriver(request.clientId, data.driverId);

    if (open && open.id !== request.id) throw new BadRequestError(`This client already has an open request for that driver (${open.reference})`);

    await this.hireRepo.addAssignment(request.id, data.driverId);

    return this.requireRequest(reference);
  }

  async unassignDriver(reference: string, adminId: string, data: AssignDriverInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can have a driver removed");

    await this.hireRepo.removeAssignment(request.id, data.driverId);

    return this.requireRequest(reference);
  }

  /*
    The invoice is the admin's review artifact: a per-driver salary (defaulting
    to the highest advertised rate among the assigned drivers) times the head
    count, VAT on that, and the platform fee - quoted here so the client sees
    one total that will not drift at payment time.
  */
  async generateInvoice(reference: string, adminId: string, data: GenerateInvoiceInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be invoiced");
    if (request.assignments.length < request.drivers_needed) {
      throw new BadRequestError(`Assign ${request.drivers_needed} driver(s) before invoicing - ${request.assignments.length} assigned so far`);
    }

    const advertised = request.assignments.map(a => a.driver.driver_profile?.expected_monthly_rate ?? 0);
    const perDriver = data.amount_minor ?? Math.max(...advertised);

    if (perDriver <= 0) throw new BadRequestError("No assigned driver has an advertised rate - set the per-driver amount");

    const amount = perDriver * request.assignments.length;
    const vatPercent = data.vat_percent ?? defaultVatPercent;
    const vat = Math.round((amount * vatPercent) / 100);
    const fee = paymentFeeFor(amount);
    const currency = request.assignments[0].driver.driver_profile?.rate_currency ?? "NGN";

    await this.hireRepo.createInvoice({
      hireRequestId: request.id,
      issuedById: adminId,
      reference: generateReference("INV"),
      amount_minor: amount,
      per_driver_minor: perDriver,
      vat_percent: vatPercent,
      vat_minor: vat,
      fee_minor: fee,
      total_minor: amount + vat + fee,
      currency,
      note: data.note,
    });

    const updated = await this.hireRepo.update(request.id, { status: "INVOICED" });

    await this.notificationService.notify({
      recipientId: request.clientId,
      senderId: adminId,
      type: "PAYMENT",
      title: "Your hire invoice is ready",
      message: `Invoice for your request ${request.reference}: ${formatMoney(amount + vat + fee, currency)} (incl. VAT and fees). Transfer to our account and upload your proof of payment to receive your driver's contact details.`,
      actionUrl: `/dashboard/my-hire/requests/${request.reference}`,
      metadata: { reference: request.reference },
    });

    await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
      email: request.client.email,
      first_name: request.client.first_name ?? "there",
      event: "INVOICE_READY",
      reference: request.reference,
      amount: formatMoney(amount + vat + fee, currency),
      actionUrl: `${surfaceUrlFor("CLIENT")}/dashboard/my-hire/requests/${request.reference}`,
    });

    return updated;
  }

  /*
    The human oracle for a bare bank transfer: the admin has seen the money in
    the organisation account and confirms it. Only then does the engagement
    exist - one already-ACCEPTED booking per assigned driver (admin-brokered,
    no driver-acceptance leg), each driver credited their per-driver salary
    with the standard earnings hold, contact details unlocked. The organisation
    settles drivers out of its own account; the wallet credits are the ledger
    of what is owed.
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
        amount: perDriver,
        currency: invoice.currency,
        status: "ACCEPTED",
        accepted_at: new Date(),
      });

      firstBookingId ??= booking.id;

      await this.statusEventRepo.create({ bookingId: booking.id, to_status: "ACCEPTED", changed_by: adminId });

      await this.walletService.credit(assignment.driverId, {
        amount_minor: perDriver,
        currency: invoice.currency,
        type: "BOOKING_PAYMENT",
        bookingId: booking.id,
        description: booking.title,
      });

      await this.notificationService.notify({
        recipientId: assignment.driverId,
        senderId: adminId,
        type: "BOOKING_STATUS",
        title: "You've been hired",
        message: `A client has hired you for ${booking.title} starting ${booking.starts_at.toDateString()}. ${formatMoney(perDriver, invoice.currency)} is on its way to your wallet.`,
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
