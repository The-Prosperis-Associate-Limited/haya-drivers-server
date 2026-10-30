import { BookingRepository } from "../../repositories/booking/booking.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { SalaryPaymentRepository } from "../../repositories/booking/salaryPayment.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { NotFoundError } from "../../helper/errors";
import { AttendanceService } from "../booking/attendance.service";

export class DriverDashboardService {
  private bookingRepo = new BookingRepository();
  private attendanceService = new AttendanceService();
  private walletRepo = new WalletRepository();
  private salaryRepo = new SalaryPaymentRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private reviewRepo = new ReviewRepository();

  async stats(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { trust_score: true, verification_status: true });

    if (!profile) throw new NotFoundError("Driver profile not found");

    const [wallet, salaries, ongoing, completed, activeClients, reviews, onTime] = await Promise.all([
      this.walletRepo.findByUserId(userId),
      this.salaryRepo.totalsByStatus(userId),
      this.bookingRepo.countForDriver(userId, "IN_PROGRESS"),
      this.bookingRepo.countForDriver(userId, "COMPLETED"),
      this.bookingRepo.countDistinctClientsForDriver(userId),
      this.reviewRepo.summaryForSubject(userId),
      this.attendanceService.onTimeRate({ driverId: userId }),
    ]);

    return {
      total_earnings_minor: salaries.find(row => row.status === "CONFIRMED")?._sum.amount_minor ?? 0,
      available_minor: wallet?.available_minor ?? 0,
      pending_minor: wallet?.pending_minor ?? 0,
      currency: wallet?.currency ?? "NGN",
      ongoing_projects: ongoing,
      jobs_completed: completed,
      active_customers: activeClients,
      trust_score: profile.trust_score,
      verification_status: profile.verification_status,
      client_review_average: reviews.average,
      client_review_count: reviews.total,
      on_time_rate: onTime,
    };
  }

  async upcomingJobs(userId: string, limit = 5) {
    return this.attendanceService.todayFor(await this.bookingRepo.findUpcomingForDriver(userId, limit));
  }
}
