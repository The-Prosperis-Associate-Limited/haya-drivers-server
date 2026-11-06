import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { DriverDocumentRepository } from "../../repositories/driver/driverDocument.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { DriverVerificationRepository } from "../../repositories/driver/driverVerification.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { DOCUMENT_LABELS, REQUIRED_DOCUMENTS } from "../../utils/onboardingSteps";
import type { RequiredDocumentsEmailKind } from "../../utils/services/emails/requiredDocumentsEmailService";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { TrustScoreService } from "../shared/trustScore.service";

const { CLIENT_URL } = process.env;

export const DOCUMENTS_GRACE_DAYS = 14;
export const ACTIVE_JOB_EXTENSION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatDueDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

type Recipient = { userId: string; email: string; first_name: string | null };

export class RequiredDocumentsService {
  private documentRepo = new DriverDocumentRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private verificationRepo = new DriverVerificationRepository();
  private bookingRepo = new BookingRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();
  private trustScoreService = new TrustScoreService();

  async gaps(userId: string) {
    const documents = await this.documentRepo.findByUser(userId);
    const byType = new Map(documents.map(document => [document.type, document]));

    return {
      missing: REQUIRED_DOCUMENTS.filter(type => !byType.has(type)),
      rejected: REQUIRED_DOCUMENTS.filter(type => byType.get(type)?.status === "REJECTED"),
      pending: REQUIRED_DOCUMENTS.filter(type => byType.get(type)?.status === "PENDING"),
    };
  }

  async outstanding(userId: string) {
    const { missing, rejected } = await this.gaps(userId);

    return [...missing.map(type => ({ type, reason: "Not uploaded yet" })), ...rejected.map(type => ({ type, reason: "Turned down - upload a new one" }))];
  }

  async settle(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { documents_due_at: true });
    if (!profile?.documents_due_at) return;

    const { missing, rejected, pending } = await this.gaps(userId);

    if (!missing.length && !rejected.length && !pending.length) await this.driverProfileRepo.update(userId, { documents_due_at: null });
  }

  async notifyAdminsOfUpload(userId: string, type: $Enums.DocumentType) {
    const [user, adminIds] = await Promise.all([this.userRepo.findById(userId, { first_name: true, last_name: true }), this.userRepo.findAdminIds()]);
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "A verified driver";

    await Promise.all(
      adminIds.map(recipientId =>
        this.notificationService.notify({
          recipientId,
          senderId: userId,
          type: "DOCUMENT_REVIEW",
          title: "Document waiting for review",
          message: `${name} uploaded their ${DOCUMENT_LABELS[type]}. They stay verified while it waits - approve or reject it on their profile.`,
          actionUrl: `/dashboard/drivers/${userId}?tab=documents`,
        }),
      ),
    );
  }

  async notifyDocumentReviewed(userId: string, type: $Enums.DocumentType, status: $Enums.DocumentStatus, reason?: string | null) {
    await this.notificationService.notify({
      recipientId: userId,
      type: "DOCUMENT_REVIEW",
      title: status === "APPROVED" ? `${DOCUMENT_LABELS[type]} accepted` : `${DOCUMENT_LABELS[type]} turned down`,
      message: status === "APPROVED" ? "Thanks - it's on file and your verified badge is unaffected." : `${(reason ?? "Our team couldn't accept this file").replace(/[.\s]*$/, ".")} Upload a new one before your deadline to stay verified.`,
      actionUrl: "/onboarding/documents",
      essential: status === "REJECTED",
    });
  }

  async sendNotice(recipient: Recipient, kind: RequiredDocumentsEmailKind, dueAt: Date | null, verified: boolean, options: { essential: boolean }) {
    const outstanding = await this.outstanding(recipient.userId);
    if (!outstanding.length) return false;

    const labels = outstanding.map(document => DOCUMENT_LABELS[document.type]);
    const list = labels.join(", ");
    const it = labels.length === 1 ? "it" : "them";
    const is = labels.length === 1 ? "is" : "are";
    const due = dueAt ? formatDueDate(dueAt) : null;

    await this.notificationService.notify({
      recipientId: recipient.userId,
      type: "VERIFICATION",
      title: kind === "deadline_passed" ? "Your verified badge is paused" : kind === "reminder" ? `Reminder: upload your ${list}` : `Upload your ${list}`,
      message:
        kind === "deadline_passed"
          ? `We didn't receive your ${list} in time, so clients can't see your profile. Upload ${it} and resubmit to get your badge back.`
          : due
            ? `Your ${list} ${is} now required. Upload ${it} by ${due} to keep your verified badge.`
            : `Your ${list} ${is} now required before your application can be approved.`,
      actionUrl: "/onboarding/documents",
      essential: options.essential,
    });

    if (options.essential || (await this.notificationService.wants(recipient.userId, "verification_updates"))) {
      await queueEmail(JOB_KEY.REQUIRED_DOCUMENTS, {
        email: recipient.email,
        first_name: recipient.first_name ?? "there",
        kind,
        documents: outstanding.map(document => ({ label: DOCUMENT_LABELS[document.type], reason: document.reason })),
        verified,
        due_at: due,
        baseUrl: CLIENT_URL as string,
      }).catch(error => console.error("Required documents email failed", error));
    }

    return true;
  }

  // Drivers with no documents at all are left to the onboarding reminders - "we now need your CV" means nothing to someone who never started.
  async noticeAudience() {
    const drivers = await this.driverProfileRepo.findWithoutDocumentsNotice();

    return drivers.filter(driver => {
      const uploaded = new Map(driver.user.documents.map(document => [document.type, document.status]));

      return uploaded.size > 0 && REQUIRED_DOCUMENTS.some(type => !uploaded.has(type) || uploaded.get(type) === "REJECTED");
    });
  }

  async announce() {
    const audience = await this.noticeAudience();
    let sent = 0;

    for (const driver of audience) {
      const delivered = await this.sendNotice({ userId: driver.userId, email: driver.user.email, first_name: driver.user.first_name }, "announcement", driver.documents_due_at, driver.verification_status === "APPROVED", { essential: true });

      await this.driverProfileRepo.update(driver.userId, { documents_notice_sent_at: new Date() });
      if (delivered) sent += 1;
    }

    return { sent };
  }

  async enforceDeadline(driver: { userId: string; user: { email: string; first_name: string | null; last_name: string | null } }) {
    const { missing, rejected } = await this.gaps(driver.userId);

    if (!missing.length && !rejected.length) return "waiting";

    if (await this.bookingRepo.countActiveForDriver(driver.userId)) {
      const extended = new Date(Date.now() + ACTIVE_JOB_EXTENSION_DAYS * DAY_MS);
      await this.driverProfileRepo.update(driver.userId, { documents_due_at: extended });

      const name = [driver.user.first_name, driver.user.last_name].filter(Boolean).join(" ") || driver.user.email;
      const adminIds = await this.userRepo.findAdminIds();

      await Promise.all(
        adminIds.map(recipientId =>
          this.notificationService.notify({
            recipientId,
            type: "WARNING",
            title: "Driver past their document deadline",
            message: `${name} is on an active job, so they stay verified and their deadline moved to ${formatDueDate(extended)}. Their documents are still incomplete.`,
            actionUrl: `/dashboard/drivers/${driver.userId}?tab=documents`,
          }),
        ),
      );

      return "extended";
    }

    await Promise.all([
      this.driverProfileRepo.setVerificationStatus(driver.userId, "UNSUBMITTED"),
      this.driverProfileRepo.update(driver.userId, { documents_due_at: null }),
      this.verificationRepo.upsert(driver.userId, { status: "UNSUBMITTED" }),
    ]);

    await this.trustScoreService.recompute(driver.userId);
    await this.sendNotice({ userId: driver.userId, email: driver.user.email, first_name: driver.user.first_name }, "deadline_passed", null, false, { essential: true });
    await this.activityService.record(driver.userId, "VERIFICATION_PAUSED", "Verification paused - required documents missing after the deadline");

    return "unverified";
  }
}
