import { DriverDocumentRepository } from "../../repositories/driver/driverDocument.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { DriverVerificationRepository } from "../../repositories/driver/driverVerification.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { DOCUMENT_LABELS } from "../../utils/onboardingSteps";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { DriverDocumentService } from "./driver.document.service";

const { CLIENT_URL } = process.env;

export class DriverVerificationService {
  private verificationRepo = new DriverVerificationRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private documentRepo = new DriverDocumentRepository();
  private userRepo = new UserRepository();
  private documentService = new DriverDocumentService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async getStatus(userId: string) {
    const [verification, profile, documents] = await Promise.all([
      this.verificationRepo.findByUserId(userId),
      this.driverProfileRepo.findByUserId(userId, { verification_status: true, onboarding_step: true, onboarding_completed_at: true }),
      this.documentRepo.findByUser(userId),
    ]);

    if (!profile) throw new NotFoundError("Driver profile not found");

    return {
      status: profile.verification_status,
      onboarding_step: profile.onboarding_step,
      onboarding_completed_at: profile.onboarding_completed_at,
      submitted_at: verification?.submitted_at ?? null,
      reviewed_at: verification?.reviewed_at ?? null,
      rejection_reason: verification?.rejection_reason ?? null,
      attempts: verification?.attempts ?? 0,
      // The resubmit screen lists exactly what failed, so a driver fixes two
      // documents rather than redoing the whole application.
      rejected_documents: documents
        .filter(document => document.status === "REJECTED")
        .map(document => ({ id: document.id, type: document.type, label: DOCUMENT_LABELS[document.type], reason: document.rejection_reason })),
    };
  }

  async submit(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { verification_status: true });

    if (!profile) throw new NotFoundError("Driver profile not found");
    if (profile.verification_status === "PENDING") throw new BadRequestError("Your documents are already being reviewed");
    if (profile.verification_status === "APPROVED") throw new BadRequestError("You are already verified");

    await this.documentService.assertRequiredDocumentsPresent(userId);

    // A resubmission puts every document back in the queue, including ones
    // approved last time — a reviewer looks at the whole application, and a
    // stale approval beside a fresh upload is how bad documents slip through.
    await this.documentRepo.markAllPendingForUser(userId);

    await Promise.all([
      this.verificationRepo.submit(userId),
      this.driverProfileRepo.update(userId, { verification_status: "PENDING", onboarding_completed_at: new Date() }),
    ]);

    const user = await this.userRepo.findById(userId, { email: true, first_name: true });

    await queueEmail(JOB_KEY.ONBOARDING_SUBMITTED, {
      email: user?.email as string,
      first_name: (user?.first_name as string) ?? "there",
      baseUrl: CLIENT_URL as string,
    });

    await this.notificationService.notify({
      recipientId: userId,
      type: "VERIFICATION",
      title: "Documents submitted",
      message: "Our team is reviewing your documents. Verification usually takes 24-48 hours.",
      actionUrl: "/dashboard",
    });

    await this.activityService.record(userId, "ONBOARDING_SUBMITTED", "Submitted documents for verification");

    return this.getStatus(userId);
  }
}
