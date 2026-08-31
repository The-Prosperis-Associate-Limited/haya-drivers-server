import { BookingRepository } from "../../repositories/booking/booking.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { CertificationRepository } from "../../repositories/training/certification.repository";

/*
  Trust score is the number the driver dashboard shows and the number the client
  search sorts by, so it is derived and recomputed — never written by hand from
  a service that happens to be nearby. Four inputs, capped at 100:

    verification  40   cleared documents are the floor of being trusted at all
    training      30   6 per certification, which is what "Trust Score Boost" means
    completions   20   1 per completed booking
    reviews       10   scaled from the average rating

  Change the weights here and nowhere else.
*/
const WEIGHTS = {
  VERIFICATION: 40,
  PER_CERTIFICATION: 6,
  MAX_TRAINING: 30,
  PER_COMPLETION: 1,
  MAX_COMPLETIONS: 20,
  MAX_REVIEWS: 10,
} as const;

export class TrustScoreService {
  private driverProfileRepo = new DriverProfileRepository();
  private certificationRepo = new CertificationRepository();
  private bookingRepo = new BookingRepository();
  private reviewRepo = new ReviewRepository();

  async compute(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { verification_status: true });

    if (!profile) return 0;

    const [certifications, completions, reviews] = await Promise.all([
      this.certificationRepo.countForUser(userId),
      this.bookingRepo.countForDriver(userId, "COMPLETED"),
      this.reviewRepo.summaryForSubject(userId),
    ]);

    const verification = profile.verification_status === "APPROVED" ? WEIGHTS.VERIFICATION : 0;
    const training = Math.min(certifications * WEIGHTS.PER_CERTIFICATION, WEIGHTS.MAX_TRAINING);
    const completed = Math.min(completions * WEIGHTS.PER_COMPLETION, WEIGHTS.MAX_COMPLETIONS);
    // No reviews yet is 0, not an assumed average — an unrated driver has not
    // earned the points, and defaulting them would flatter new accounts.
    const rating = reviews.total ? Math.round((reviews.average / 5) * WEIGHTS.MAX_REVIEWS) : 0;

    return Math.min(100, verification + training + completed + rating);
  }

  async recompute(userId: string) {
    const score = await this.compute(userId);

    await this.driverProfileRepo.setTrustScore(userId, score);

    return score;
  }

  async recomputeAll() {
    const drivers = await this.driverProfileRepo.findApprovedIds();

    for (const driver of drivers) {
      await this.recompute(driver.userId);
    }

    return drivers.length;
  }

  async breakdown(userId: string) {
    const [certifications, completions, reviews, profile] = await Promise.all([
      this.certificationRepo.countForUser(userId),
      this.bookingRepo.countForDriver(userId, "COMPLETED"),
      this.reviewRepo.summaryForSubject(userId),
      this.driverProfileRepo.findByUserId(userId, { verification_status: true, trust_score: true }),
    ]);

    return {
      total: profile?.trust_score ?? 0,
      verification: profile?.verification_status === "APPROVED" ? WEIGHTS.VERIFICATION : 0,
      training: Math.min(certifications * WEIGHTS.PER_CERTIFICATION, WEIGHTS.MAX_TRAINING),
      completions: Math.min(completions * WEIGHTS.PER_COMPLETION, WEIGHTS.MAX_COMPLETIONS),
      reviews: reviews.total ? Math.round((reviews.average / 5) * WEIGHTS.MAX_REVIEWS) : 0,
    };
  }
}
