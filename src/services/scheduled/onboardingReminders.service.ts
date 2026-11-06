import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { DOCUMENT_LABELS, ONBOARDING_STEP_LABELS, REQUIRED_DOCUMENTS } from "../../utils/onboardingSteps";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { RequiredDocumentsService } from "../driver/driver.requiredDocuments.service";
import { NotificationService } from "../shared/notification.service";

const driverProfileRepo = new DriverProfileRepository();
const notificationService = new NotificationService();
const requiredDocumentsService = new RequiredDocumentsService();

const { CLIENT_URL } = process.env;

const DAY_MS = 24 * 60 * 60 * 1000;

// Days after signup; the last one is the final reminder, so nobody hears from us past day 90.
export const ONBOARDING_REMINDER_DAYS = [1, 3, 7, 14, 28, 42, 56, 70, 84];
export const DOCUMENTS_REMINDER_EVERY_DAYS = 3;

const remindUnsubmitted = async (now: Date) => {
  const signedUpAfter = new Date(now.getTime() - 90 * DAY_MS);
  const drivers = await driverProfileRepo.findOnboardingReminderCandidates(signedUpAfter, ONBOARDING_REMINDER_DAYS.length);
  let sent = 0;

  for (const driver of drivers) {
    const daysSinceSignup = (now.getTime() - driver.user.createdAt.getTime()) / DAY_MS;
    const due = ONBOARDING_REMINDER_DAYS.filter(day => day <= daysSinceSignup).length;

    if (due <= driver.onboarding_reminders_sent) continue;

    const uploaded = new Set(driver.user.documents.filter(document => document.status !== "REJECTED").map(document => document.type));
    const missing = REQUIRED_DOCUMENTS.filter(type => !uploaded.has(type)).map(type => DOCUMENT_LABELS[type]);
    const stepLabel = ONBOARDING_STEP_LABELS[driver.onboarding_step];
    const final = due === ONBOARDING_REMINDER_DAYS.length;

    // Missed slots are skipped, not replayed - a driver who signed up weeks before this sweep existed gets one reminder, not a backlog.
    await driverProfileRepo.update(driver.userId, { onboarding_reminders_sent: due, last_onboarding_reminder_at: now });

    await notificationService.notify({
      recipientId: driver.userId,
      type: "VERIFICATION",
      title: "Finish your application",
      message: `You stopped at ${stepLabel}. Clients can only hire verified drivers - pick up where you left off.`,
      actionUrl: "/onboarding",
    });

    if (await notificationService.wants(driver.userId, "verification_updates")) {
      await queueEmail(JOB_KEY.ONBOARDING_REMINDER, {
        email: driver.user.email,
        first_name: driver.user.first_name ?? "there",
        step_label: stepLabel,
        missing_documents: missing,
        final,
        baseUrl: CLIENT_URL as string,
      }).catch(error => console.error("Onboarding reminder email failed", error));
    }

    sent += 1;
  }

  return sent;
};

const remindVerifiedWithGaps = async (now: Date) => {
  const remindedBefore = new Date(now.getTime() - DOCUMENTS_REMINDER_EVERY_DAYS * DAY_MS);
  const drivers = await driverProfileRepo.findDocumentsReminderCandidates(remindedBefore);
  let sent = 0;

  for (const driver of drivers) {
    const delivered = await requiredDocumentsService.sendNotice({ userId: driver.userId, email: driver.user.email, first_name: driver.user.first_name }, "reminder", driver.documents_due_at, true, { essential: false });

    await driverProfileRepo.update(driver.userId, { last_documents_reminder_at: now });
    if (delivered) sent += 1;
  }

  return sent;
};

export const onboardingReminders = async () => {
  const now = new Date();
  const [unsubmitted, verified] = [await remindUnsubmitted(now), await remindVerifiedWithGaps(now)];

  return `${unsubmitted} onboarding reminder(s), ${verified} missing-document reminder(s) sent`;
};
