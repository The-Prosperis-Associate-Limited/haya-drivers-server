import { BookingRepository } from "../../repositories/booking/booking.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { NotFoundError } from "../../helper/errors";
import { ON_TIME_SAMPLE, onTimeRate } from "../../utils/onTimeRate";

export class DriverDashboardService {
  private bookingRepo = new BookingRepository();
  private walletRepo = new WalletRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private reviewRepo = new ReviewRepository();

  async stats(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { trust_score: true, verification_status: true });

    if (!profile) throw new NotFoundError("Driver profile not found");

    const [wallet, ongoing, completed, activeClients, reviews, started] = await Promise.all([
      this.walletRepo.findByUserId(userId),
      this.bookingRepo.countForDriver(userId, "IN_PROGRESS"),
      this.bookingRepo.countForDriver(userId, "COMPLETED"),
      this.bookingRepo.countDistinctClientsForDriver(userId),
      this.reviewRepo.summaryForSubject(userId),
      this.bookingRepo.findStartedForDriver(userId, ON_TIME_SAMPLE),
    ]);

    return {
      total_earnings_minor: wallet?.lifetime_minor ?? 0,
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
      on_time_rate: onTimeRate(started),
    };
  }

  async upcomingJobs(userId: string, limit = 5) {
    return this.bookingRepo.findUpcomingForDriver(userId, limit);
  }
}
