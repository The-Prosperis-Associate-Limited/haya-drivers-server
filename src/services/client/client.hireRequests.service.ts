import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { CloudinaryService } from "../shared/cloudinary.service";
import { NotificationService } from "../shared/notification.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { paginate } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import type { CreateHireRequestInput, HireRequestListQuery, SubmitProofInput } from "../../utils/types/hireValidatorSchema";

const { ORG_BANK_NAME, ORG_ACCOUNT_NAME, ORG_ACCOUNT_NUMBER } = process.env;

// The organisation account every hire invoice is transferred into. Dummy env
// values until the real account exists.
export const orgPaymentAccount = () => ({
  bank_name: ORG_BANK_NAME ?? "Fidelity Bank",
  account_name: ORG_ACCOUNT_NAME ?? "HAYA DRIVERS LTD",
  account_number: ORG_ACCOUNT_NUMBER ?? "0000000000",
});

/*
  The client's half of the admin-brokered hire flow. A request may name a
  driver (self-serve) or none (concierge - an admin assigns one at review).
  Payment is a bank transfer into the organisation account: the client uploads
  proof, an admin confirms it. Contact details are the product being bought:
  they appear on the detail payload only once payment is confirmed.
*/
export class ClientHireRequestsService {
  private hireRepo = new HireRequestRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();
  private cloudinaryService = new CloudinaryService();
  private notificationService = new NotificationService();

  async create(clientId: string, data: CreateHireRequestInput) {
    if (data.driverId) {
      const driverProfile = await this.driverProfileRepo.findByUserId(data.driverId, { verification_status: true, is_discoverable: true, open_to_work: true });

      if (!driverProfile) throw new NotFoundError("Driver not found");
      if (driverProfile.verification_status !== "APPROVED") throw new BadRequestError("That driver is not available for hire");
      if (!driverProfile.open_to_work) throw new BadRequestError("That driver isn't taking new jobs right now");

      const existing = await this.hireRepo.findOpenForClientAndDriver(clientId, data.driverId);

      if (existing) throw new BadRequestError(`You already have an open request for this driver (${existing.reference})`);
    }

    const request = await this.hireRepo.create({
      ...data,
      clientId,
      reference: generateReference("HRQ"),
      // A named driver is also the first assignment; concierge starts empty.
      ...(data.driverId && { assignments: { create: { driverId: data.driverId } } }),
    });

    await this.notifyAdmins(clientId, "New hire request", `${request.reference}: ${data.driverId ? "a specific driver was requested" : `concierge request for ${data.drivers_needed} driver(s)`}. Review and invoice it.`);

    return request;
  }

  async list(clientId: string, query: HireRequestListQuery) {
    const { requests, total } = await this.hireRepo.listForClient(clientId, query);

    return paginate(requests, total, { page: query.page, limit: query.limit });
  }

  async get(clientId: string, reference: string) {
    const request = await this.requireOwn(clientId, reference);

    return this.present(request);
  }

  async cancel(clientId: string, reference: string) {
    const request = await this.requireOwn(clientId, reference);

    // Once proof is submitted the money is in flight - only an admin decision
    // (confirm or reject) can move the request from there.
    if (!["PENDING_REVIEW", "INVOICED"].includes(request.status)) throw new BadRequestError("Only a request that hasn't been paid can be cancelled");

    const updated = await this.hireRepo.update(request.id, { status: "CANCELLED", cancelled_at: new Date() });

    if (request.invoice) await this.hireRepo.updateInvoice(request.invoice.id, { status: "VOID" });

    return updated;
  }

  /*
    The client has transferred the invoice total into the organisation account
    and uploads the receipt. The request parks in PAYMENT_REVIEW until an
    admin confirms the money actually arrived - bare NIP transfers have no
    verification API, so a human is the oracle.
  */
  async submitProof(clientId: string, reference: string, file: Express.Multer.File | undefined, data: SubmitProofInput) {
    const request = await this.requireOwn(clientId, reference);

    if (!file) throw new BadRequestError("Attach your proof of payment");
    if (!request.invoice || !["INVOICED", "PAYMENT_REVIEW"].includes(request.status) || !["UNPAID", "PAYMENT_REVIEW"].includes(request.invoice.status)) {
      throw new BadRequestError("This request has no invoice awaiting payment");
    }

    const upload = await this.cloudinaryService.uploadFile(clientId, "client", file, "payments");

    await this.hireRepo.updateInvoice(request.invoice.id, {
      status: "PAYMENT_REVIEW",
      proof_url: upload.secure_url,
      proof_note: data.note,
      proof_submitted_at: new Date(),
      proof_rejected_reason: null,
    });

    const updated = await this.hireRepo.update(request.id, { status: "PAYMENT_REVIEW" });

    await this.notifyAdmins(clientId, "Proof of payment uploaded", `${request.reference}: the client says they've transferred ${formatMoney(request.invoice.total_minor, request.invoice.currency)}. Confirm or reject the proof.`);

    return this.present(updated);
  }

  /*
    The combo pack - the verified contact details the client paid for - is
    attached only when PAID; the organisation account only while an invoice
    is awaiting payment or review.
  */
  private async present(request: Awaited<ReturnType<HireRequestRepository["findByReference"]>>) {
    if (!request) throw new NotFoundError("Hire request not found");

    const needsPayment = ["INVOICED", "PAYMENT_REVIEW"].includes(request.status);
    const driverIds = request.assignments.length ? request.assignments.map(a => a.driverId) : request.driverId ? [request.driverId] : [];

    if (request.status !== "PAID" || !driverIds.length) {
      return { ...request, combo_pack: null, payment_account: needsPayment ? orgPaymentAccount() : null };
    }

    const contacts = await Promise.all(
      driverIds.map(driverId =>
        this.userRepo.findById(driverId, {
          first_name: true,
          last_name: true,
          email: true,
          phone_no: true,
          whatsapp_number: true,
          city: true,
          state_of_residence: true,
        }),
      ),
    );

    return { ...request, combo_pack: contacts.filter(Boolean), payment_account: null };
  }

  // Admins work from the Hires queue; the notification is what stops a
  // money-bearing request sitting in it unnoticed.
  private async notifyAdmins(senderId: string, title: string, message: string) {
    const adminIds = await this.userRepo.findAdminIds();

    await Promise.all(
      adminIds.map(recipientId =>
        this.notificationService.notify({
          recipientId,
          senderId,
          type: "PAYMENT",
          title,
          message,
          actionUrl: "/dashboard/hires",
        }),
      ),
    );
  }

  private async requireOwn(clientId: string, reference: string) {
    const request = await this.hireRepo.findByReference(reference);

    if (!request) throw new NotFoundError("Hire request not found");
    if (request.clientId !== clientId) throw new ForbiddenError("That request belongs to another client");

    return request;
  }
}
