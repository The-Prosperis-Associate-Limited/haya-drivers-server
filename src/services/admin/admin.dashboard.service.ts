import { BookingRepository } from "../../repositories/booking/booking.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { ActivityService } from "../shared/activity.service";

export class AdminDashboardService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private bookingRepo = new BookingRepository();
  private activityService = new ActivityService();

  async stats() {
    const [drivers, clients, pendingVerifications, approvedDrivers, requested, inProgress, completed] = await Promise.all([
      this.userRepo.count({ role: "DRIVER" }),
      this.userRepo.count({ role: "CLIENT" }),
      this.driverProfileRepo.countByStatus("PENDING"),
      this.driverProfileRepo.countByStatus("APPROVED"),
      this.bookingRepo.countByStatus("REQUESTED"),
      this.bookingRepo.countByStatus("IN_PROGRESS"),
      this.bookingRepo.countByStatus("COMPLETED"),
    ]);

    return {
      drivers,
      clients,
      pending_verifications: pendingVerifications,
      verified_drivers: approvedDrivers,
      bookings: { requested, in_progress: inProgress, completed },
    };
  }

  // Platform-wide rather than scoped to the calling admin — admins generate
  // almost no activity of their own, so a per-user feed renders empty.
  async recentActivity(limit = 20) {
    return this.activityService.listPlatformActivities(limit);
  }
}
