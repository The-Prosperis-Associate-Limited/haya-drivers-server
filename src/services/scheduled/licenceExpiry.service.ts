import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { NotificationService } from "../shared/notification.service";

const driverProfileRepo = new DriverProfileRepository();
const notificationService = new NotificationService();

const WARNING_WINDOW_DAYS = 30;

// A licence that expires while a driver is live is a compliance problem, so the
// warning goes out well before the date rather than on it.
export const notifyExpiringLicences = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + WARNING_WINDOW_DAYS);

  const drivers = await driverProfileRepo.findExpiringLicences(cutoff);

  for (const driver of drivers) {
    await notificationService.notify({
      recipientId: driver.userId,
      type: "WARNING",
      title: "Your licence expires soon",
      message: `Your driver licence expires on ${driver.license_expires_at?.toDateString()}. Upload a renewed copy to stay visible to clients.`,
      actionUrl: "/onboarding/documents",
    });
  }

  return `${drivers.length} licence expiry warning(s) sent`;
};
