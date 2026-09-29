import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { WalletService } from "../earnings/wallet.service";
import { NotificationService } from "../shared/notification.service";
import { paymentFeeFor } from "../client/client.wallet.service";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { paginate } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
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
    A concierge request arrives without a driver; the admin matches one before
    invoicing. Also lets an admin swap the driver on a still-pending request.
  */
  async assignDriver(reference: string, adminId: string, data: AssignDriverInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be assigned a driver");

    const driverProfile = await this.driverProfileRepo.findByUserId(data.driverId, { verification_status: true });

    if (!driverProfile) throw new NotFoundError("Driver not found");
    if (driverProfile.verification_status !== "APPROVED") throw new BadRequestError("That driver is not approved for hire");

    const open = await this.hireRepo.findOpenForClientAndDriver(request.clientId, data.driverId);

    if (open && open.id !== request.id) throw new BadRequestError(`This client already has an open request for that driver (${open.reference})`);

    return this.hireRepo.update(request.id, { driverId: data.driverId });
  }

  /*
    The invoice is the admin's review artifact: salary (defaulting to the
    driver's advertised rate), VAT on the salary, and the platform fee -
    quoted here so the client sees one total that will not drift at payment
    time.
  */
  async generateInvoice(reference: string, adminId: string, data: GenerateInvoiceInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be invoiced");
    if (!request.driverId || !request.driver) throw new BadRequestError("Assign a driver before invoicing");

    const amount = data.amount_minor ?? request.driver.driver_profile?.expected_monthly_rate ?? 0;

    if (amount <= 0) throw new BadRequestError("The driver has no advertised rate - set the engagement amount");

    const vatPercent = data.vat_percent ?? defaultVatPercent;
    const vat = Math.round((amount * vatPercent) / 100);
    const fee = paymentFeeFor(amount);
    const currency = request.driver.driver_profile?.rate_currency ?? "NGN";

    await this.hireRepo.createInvoice({
      hireRequestId: request.id,
      issuedById: adminId,
      reference: generateReference("INV"),
      amount_minor: amount,
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

    return updated;
  }

  /*
    The human oracle for a bare bank transfer: the admin has seen the money in
    the organisation account and confirms it. Only then does the engagement
    exist - booking created already-ACCEPTED (admin-brokered, no
    driver-acceptance leg), driver credited in full with the standard earnings
    hold, contact details unlocked. The organisation settles the driver out of
    its own account; the wallet credit is the ledger of what is owed.
  */
  async confirmPayment(reference: string, adminId: string) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PAYMENT_REVIEW" || !request.invoice || request.invoice.status !== "PAYMENT_REVIEW") {
      throw new BadRequestError("This request has no payment awaiting confirmation");
    }
    if (!request.driverId || !request.driver) throw new BadRequestError("Assign a driver before confirming payment");

    const invoice = request.invoice;
    const driverName = [request.driver.first_name, request.driver.last_name].filter(Boolean).join(" ") || "your driver";
    const driverType = request.driver_type ?? request.driver.driver_profile?.driver_type ?? "PRIVATE_DRIVER";
    const client = await this.userRepo.findById(request.clientId, { address: true, city: true, state_of_residence: true, country: true });

    const booking = await this.bookingRepo.create({
      clientId: request.clientId,
      driverId: request.driverId,
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
      amount: invoice.amount_minor,
      currency: invoice.currency,
      status: "ACCEPTED",
      accepted_at: new Date(),
    });

    await this.statusEventRepo.create({ bookingId: booking.id, to_status: "ACCEPTED", changed_by: adminId });

    await this.walletService.credit(request.driverId, {
      amount_minor: invoice.amount_minor,
      currency: invoice.currency,
      type: "BOOKING_PAYMENT",
      bookingId: booking.id,
      description: booking.title,
    });

    await this.hireRepo.updateInvoice(invoice.id, { status: "PAID", paid_at: new Date(), confirmedById: adminId });
    const updated = await this.hireRepo.update(request.id, { status: "PAID", paid_at: new Date(), bookingId: booking.id });

    await this.notificationService.notify({
      recipientId: request.clientId,
      senderId: adminId,
      type: "PAYMENT",
      title: "Payment confirmed - driver details unlocked",
      message: `We've confirmed your payment for ${request.reference}. ${driverName}'s contact details are now available on your request.`,
      actionUrl: `/dashboard/my-hire/requests/${request.reference}`,
      metadata: { reference: request.reference },
    });

    await this.notificationService.notify({
      recipientId: request.driverId,
      senderId: adminId,
      type: "BOOKING_STATUS",
      title: "You've been hired",
      message: `A client has hired you for ${booking.title} starting ${booking.starts_at.toDateString()}. ${formatMoney(invoice.amount_minor, invoice.currency)} is on its way to your wallet.`,
      actionUrl: `/dashboard/job-request/${booking.reference}`,
      metadata: { bookingId: booking.id, reference: booking.reference },
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
