import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { WalletService } from "../earnings/wallet.service";
import { NotificationService } from "../shared/notification.service";
import { paymentFeeFor } from "./client.wallet.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { paginate } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import type { CreateHireRequestInput, HireRequestListQuery } from "../../utils/types/hireValidatorSchema";

/*
  The client's half of the admin-brokered hire flow. Contact details are the
  product being bought: they appear on the detail payload only once the
  invoice is paid.
*/
export class ClientHireRequestsService {
  private hireRepo = new HireRequestRepository();
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();
  private walletRepo = new WalletRepository();
  private transactionRepo = new WalletTransactionRepository();
  private walletService = new WalletService();
  private notificationService = new NotificationService();

  async create(clientId: string, data: CreateHireRequestInput) {
    const driverProfile = await this.driverProfileRepo.findByUserId(data.driverId, { verification_status: true, is_discoverable: true });

    if (!driverProfile) throw new NotFoundError("Driver not found");
    if (driverProfile.verification_status !== "APPROVED") throw new BadRequestError("That driver is not available for hire");

    const existing = await this.hireRepo.findOpenForClientAndDriver(clientId, data.driverId);

    if (existing) throw new BadRequestError(`You already have an open request for this driver (${existing.reference})`);

    const request = await this.hireRepo.create({
      ...data,
      clientId,
      reference: generateReference("HRQ"),
    });

    return request;
  }

  async list(clientId: string, query: HireRequestListQuery) {
    const { requests, total } = await this.hireRepo.listForClient(clientId, query);

    return paginate(requests, total, { page: query.page, limit: query.limit });
  }

  async get(clientId: string, reference: string) {
    const request = await this.requireOwn(clientId, reference);

    return this.withComboPack(request);
  }

  async cancel(clientId: string, reference: string) {
    const request = await this.requireOwn(clientId, reference);

    if (!["PENDING_REVIEW", "INVOICED"].includes(request.status)) throw new BadRequestError("Only an open request can be cancelled");

    const updated = await this.hireRepo.update(request.id, { status: "CANCELLED", cancelled_at: new Date() });

    if (request.invoice) await this.hireRepo.updateInvoice(request.invoice.id, { status: "VOID" });

    return updated;
  }

  /*
    Paying the invoice is what buys the engagement: three itemised debits
    (salary, VAT, platform fee), the driver credited in full with the standard
    earnings hold, and an already-ACCEPTED booking — the admin brokered it, so
    there is no driver-acceptance leg.
  */
  async pay(clientId: string, reference: string) {
    const request = await this.requireOwn(clientId, reference);

    if (request.status !== "INVOICED" || !request.invoice || request.invoice.status !== "UNPAID") {
      throw new BadRequestError("This request has no unpaid invoice");
    }

    const invoice = request.invoice;
    const wallet = await this.walletRepo.ensureForUser(clientId);

    if (wallet.available_minor < invoice.total_minor) {
      throw new BadRequestError("Insufficient wallet balance. Fund your wallet to continue.");
    }

    const driverName = [request.driver.first_name, request.driver.last_name].filter(Boolean).join(" ") || "your driver";
    const driverType = request.driver.driver_profile?.driver_type ?? "PRIVATE_DRIVER";
    const client = await this.userRepo.findById(clientId, { address: true, city: true, state_of_residence: true, country: true });

    const booking = await this.bookingRepo.create({
      clientId,
      driverId: request.driverId,
      reference: generateReference("JOB"),
      title: `${request.engagement_type === "MONTHLY" ? "Monthly engagement" : "Contract engagement"} — ${driverName}`,
      description: request.note ?? null,
      driver_type: driverType,
      engagement_type: request.engagement_type,
      pickup_address: (client?.address as string) ?? "To be agreed with the driver",
      country: (client?.country as string) ?? "Nigeria",
      state: (client?.state_of_residence as string) ?? "Lagos",
      city: (client?.city as string) ?? null,
      starts_at: request.starts_at,
      amount: invoice.amount_minor,
      currency: invoice.currency,
      status: "ACCEPTED",
      accepted_at: new Date(),
    });

    await this.statusEventRepo.create({ bookingId: booking.id, to_status: "ACCEPTED", changed_by: clientId });

    const payReference = generateReference("PAY");

    await this.transactionRepo.create({
      walletId: wallet.id,
      bookingId: booking.id,
      type: "BOOKING_CHARGE",
      status: "PAID_OUT",
      amount_minor: -invoice.amount_minor,
      currency: wallet.currency,
      description: `Hire of ${driverName} (${invoice.reference})`,
      reference: payReference,
      available_at: new Date(),
    });

    await this.transactionRepo.create({
      walletId: wallet.id,
      bookingId: booking.id,
      type: "VAT_CHARGE",
      status: "PAID_OUT",
      amount_minor: -invoice.vat_minor,
      currency: wallet.currency,
      description: `VAT (${invoice.vat_percent}%) on ${invoice.reference}`,
      reference: `${payReference}-VAT`,
      available_at: new Date(),
    });

    await this.transactionRepo.create({
      walletId: wallet.id,
      bookingId: booking.id,
      type: "PLATFORM_FEE",
      status: "PAID_OUT",
      amount_minor: -invoice.fee_minor,
      currency: wallet.currency,
      description: "Payment fee",
      reference: `${payReference}-FEE`,
      available_at: new Date(),
    });

    await this.walletService.rebuildBalances(wallet.id);

    await this.walletService.credit(request.driverId, {
      amount_minor: invoice.amount_minor,
      currency: wallet.currency,
      type: "BOOKING_PAYMENT",
      bookingId: booking.id,
      description: booking.title,
    });

    await this.hireRepo.updateInvoice(invoice.id, { status: "PAID", paid_at: new Date() });
    const updated = await this.hireRepo.update(request.id, { status: "PAID", paid_at: new Date(), bookingId: booking.id });

    await this.notificationService.notify({
      recipientId: request.driverId,
      senderId: clientId,
      type: "BOOKING_STATUS",
      title: "You've been hired",
      message: `A client has hired you for ${booking.title} starting ${booking.starts_at.toDateString()}. ${formatMoney(invoice.amount_minor, invoice.currency)} is on its way to your wallet.`,
      actionUrl: `/dashboard/job-request/${booking.reference}`,
      metadata: { bookingId: booking.id, reference: booking.reference },
    });

    return this.withComboPack(updated);
  }

  /*
    The combo pack — the verified contact details the client paid for. Never
    attached before the request is PAID.
  */
  private async withComboPack(request: Awaited<ReturnType<HireRequestRepository["findByReference"]>>) {
    if (!request) throw new NotFoundError("Hire request not found");

    if (request.status !== "PAID") return { ...request, combo_pack: null };

    const contact = await this.userRepo.findById(request.driverId, {
      first_name: true,
      last_name: true,
      email: true,
      phone_no: true,
      whatsapp_number: true,
      city: true,
      state_of_residence: true,
    });

    return { ...request, combo_pack: contact };
  }

  private async requireOwn(clientId: string, reference: string) {
    const request = await this.hireRepo.findByReference(reference);

    if (!request) throw new NotFoundError("Hire request not found");
    if (request.clientId !== clientId) throw new ForbiddenError("That request belongs to another client");

    return request;
  }
}
