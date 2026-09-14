import { BookingRepository } from "../../repositories/booking/booking.repository";
import { StaffingRequestRepository } from "../../repositories/booking/staffingRequest.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { ActivityService } from "../shared/activity.service";

const PERIOD_DAYS = { "7d": 7, "14d": 14, "30d": 30 } as const;

export type GrowthPeriod = keyof typeof PERIOD_DAYS;

export class AdminDashboardService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private bookingRepo = new BookingRepository();
  private staffingRequestRepo = new StaffingRequestRepository();
  private activityService = new ActivityService();

  async stats() {
    const [drivers, clients, pendingVerifications, approvedDrivers, openRequests, requested, inProgress, completed] = await Promise.all([
      this.userRepo.count({ role: "DRIVER" }),
      this.userRepo.count({ role: "CLIENT" }),
      this.driverProfileRepo.countByStatus("PENDING"),
      this.driverProfileRepo.countByStatus("APPROVED"),
      this.staffingRequestRepo.countByStatus("OPEN"),
      this.bookingRepo.countByStatus("REQUESTED"),
      this.bookingRepo.countByStatus("IN_PROGRESS"),
      this.bookingRepo.countByStatus("COMPLETED"),
    ]);

    return {
      total_users: drivers + clients,
      active_drivers: approvedDrivers,
      open_requests: openRequests,
      pending_verifications: pendingVerifications,
      drivers,
      clients,
      bookings: { requested, in_progress: inProgress, completed },
    };
  }

  async growth(period: GrowthPeriod) {
    const days = PERIOD_DAYS[period];
    // UTC throughout — Postgres buckets by UTC day, so local midnight would shift every key.
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));

    const rows = await this.userRepo.registrationSeries(since);

    const buckets = new Map<string, { date: string; drivers: number; clients: number }>();

    for (let i = 0; i < days; i++) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, drivers: 0, clients: 0 });
    }

    for (const row of rows) {
      const bucket = buckets.get(row.day.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (row.role === "DRIVER") bucket.drivers = Number(row.count);
      else bucket.clients = Number(row.count);
    }

    return { period, series: [...buckets.values()] };
  }

  // Platform-wide rather than scoped to the calling admin — admins generate
  // almost no activity of their own, so a per-user feed renders empty.
  async recentActivity(limit = 20) {
    return this.activityService.listPlatformActivities(limit);
  }
}
