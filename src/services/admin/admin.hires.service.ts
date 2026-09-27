import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotificationService } from "../shared/notification.service";
import { paymentFeeFor } from "../client/client.wallet.service";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { paginate } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import type { DeclineHireRequestInput, GenerateInvoiceInput, HireRequestListQuery } from "../../utils/types/hireValidatorSchema";

// Nigeria's standard VAT unless the invoice overrides it.
const { HIRE_VAT_PERCENT } = process.env;
const defaultVatPercent = Number(HIRE_VAT_PERCENT ?? 7.5);

export class AdminHiresService {
  private hireRepo = new HireRequestRepository();
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
    The invoice is the admin's review artifact: salary (defaulting to the
    driver's advertised rate), VAT on the salary, and the platform fee the
    payment rail would charge anyway — quoted here so the client sees one
    total that will not drift at payment time.
  */
  async generateInvoice(reference: string, adminId: string, data: GenerateInvoiceInput) {
    const request = await this.requireRequest(reference);

    if (request.status !== "PENDING_REVIEW") throw new BadRequestError("Only a pending request can be invoiced");

    const amount = data.amount_minor ?? request.driver.driver_profile?.expected_monthly_rate ?? 0;

    if (amount <= 0) throw new BadRequestError("The driver has no advertised rate — set the engagement amount");

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
      message: `Invoice for your request ${request.reference}: ${formatMoney(amount + vat + fee, currency)} (incl. VAT and fees). Pay to receive your driver's contact details.`,
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
