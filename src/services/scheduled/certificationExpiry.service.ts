import { CertificationRepository } from "../../repositories/training/certification.repository";
import { NotificationService } from "../shared/notification.service";

const certificationRepo = new CertificationRepository();
const notificationService = new NotificationService();

const WARNING_WINDOW_DAYS = 30;

export const notifyExpiringCertifications = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + WARNING_WINDOW_DAYS);

  const certifications = await certificationRepo.findExpiringBefore(cutoff);

  for (const certification of certifications) {
    await notificationService.notify({
      recipientId: certification.userId,
      type: "TRAINING",
      title: "A certificate is expiring",
      message: `Your ${certification.course.title} certificate expires on ${certification.expires_at?.toDateString()}. Retake the course to keep the trust score it earned you.`,
      actionUrl: "/dashboard/training",
    });
  }

  return `${certifications.length} certification expiry warning(s) sent`;
};
