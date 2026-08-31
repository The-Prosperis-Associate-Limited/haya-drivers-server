import type { $Enums } from "../../generated/prisma/client";
import { DriverDocumentRepository } from "../../repositories/driver/driverDocument.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { DriverVerificationRepository } from "../../repositories/driver/driverVerification.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { DOCUMENT_LABELS } from "../../utils/onboardingSteps";
import { paginate, parsePagination } from "../../utils/pagination";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { TrustScoreService } from "../shared/trustScore.service";
import type { ReviewDocumentInput, ReviewVerificationInput } from "../../utils/types/driverValidatorSchema";

const { CLIENT_URL } = process.env;

export class AdminVerificationService {
  private verificationRepo = new DriverVerificationRepository();
  private documentRepo = new DriverDocumentRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();
  private trustScoreService = new TrustScoreService();

  async queue(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { submissions, total } = await this.verificationRepo.findQueue({
      ...pagination,
      status: query.status as $Enums.DriverVerificationStatus | undefined,
      search: query.search as string | undefined,
    });

    return paginate(submissions, total, pagination);
  }

  async getSubmission(userId: string) {
    const [verification, profile, documents] = await Promise.all([
      this.verificationRepo.findByUserId(userId),
      this.driverProfileRepo.findByUserIdWithRelations(userId),
      this.documentRepo.findByUser(userId),
    ]);

    if (!profile) throw new NotFoundError("Driver profile not found");

    return { verification, profile, documents };
  }

  async reviewDocument(documentId: string, reviewerId: string, data: ReviewDocumentInput) {
    const document = await this.documentRepo.findById(documentId);

    if (!document) throw new NotFoundError("Document not found");

    return this.documentRepo.review(documentId, {
      status: data.status,
      rejection_reason: data.status === "REJECTED" ? data.rejection_reason : null,
      reviewerId,
    });
  }

  /*
    Approving the application is refused while a document is still rejected.
    Otherwise a driver ends up verified with a document the reviewer explicitly
    turned down, and the rejection notice they already received is a lie.
  */
  async reviewSubmission(userId: string, reviewerId: string, data: ReviewVerificationInput) {
    const verification = await this.verificationRepo.findByUserId(userId);

    if (!verification) throw new NotFoundError("This driver has not submitted anything to review");

    const user = await this.userRepo.findById(userId, { email: true, first_name: true, state_of_residence: true, country: true });

    if (!user) throw new NotFoundError("Driver not found");

    if (data.status === "APPROVED") {
      const rejected = await this.documentRepo.countByStatusForUser(userId, "REJECTED");

      if (rejected > 0) throw new BadRequestError("Clear or re-review the rejected documents before approving this driver");

      return this.approve(userId, reviewerId, user);
    }

    return this.reject(userId, reviewerId, user, data.rejection_reason as string);
  }

  private async approve(userId: string, reviewerId: string, user: { email?: unknown; first_name?: unknown; state_of_residence?: unknown; country?: unknown }) {
    await Promise.all([
      this.verificationRepo.review(userId, { status: "APPROVED", reviewerId, rejection_reason: null }),
      this.driverProfileRepo.setVerificationStatus(userId, "APPROVED"),
    ]);

    // Verification is 40 of the 100 trust-score points, so the score has to be
    // recomputed here or an approved driver sorts below an unapproved one.
    await this.trustScoreService.recompute(userId);

    const location = (user.state_of_residence as string) ?? (user.country as string) ?? "your area";

    await this.notificationService.notify({
      recipientId: userId,
      type: "VERIFICATION",
      title: "You are verified",
      message: `Your documents cleared review. Your profile is now visible to clients across ${location}.`,
      actionUrl: "/dashboard",
    });

    await queueEmail(JOB_KEY.VERIFICATION_APPROVED, {
      email: user.email as string,
      first_name: (user.first_name as string) ?? "there",
      location,
      baseUrl: CLIENT_URL as string,
    });

    await this.activityService.record(userId, "VERIFICATION_APPROVED", "Verification approved");

    return this.getSubmission(userId);
  }

  private async reject(userId: string, reviewerId: string, user: { email?: unknown; first_name?: unknown }, reason: string) {
    await Promise.all([
      this.verificationRepo.review(userId, { status: "REJECTED", reviewerId, rejection_reason: reason }),
      this.driverProfileRepo.setVerificationStatus(userId, "REJECTED"),
    ]);

    const rejectedDocuments = await this.documentRepo.findRejectedForUser(userId);

    // The email lists the specific documents when the reviewer marked them, and
    // falls back to the overall reason when the refusal was not per-document.
    const documents = rejectedDocuments.length
      ? rejectedDocuments.map(document => ({ label: DOCUMENT_LABELS[document.type], reason: document.rejection_reason ?? reason }))
      : [{ label: "Your application", reason }];

    await this.notificationService.notify({
      recipientId: userId,
      type: "DOCUMENT_REVIEW",
      title: "Action needed on your documents",
      message: reason,
      actionUrl: "/onboarding/documents",
    });

    await queueEmail(JOB_KEY.VERIFICATION_REJECTED, {
      email: user.email as string,
      first_name: (user.first_name as string) ?? "there",
      documents,
      baseUrl: CLIENT_URL as string,
    });

    await this.activityService.record(userId, "VERIFICATION_REJECTED", "Verification rejected", reason);

    return this.getSubmission(userId);
  }
}
