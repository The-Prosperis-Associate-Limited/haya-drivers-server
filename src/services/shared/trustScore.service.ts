import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { ActivityRepository } from "../../repositories/user/activity.repository";

/*
  Trust score is the number the driver dashboard shows and the number the client
  search sorts by, so it is derived and recomputed - never written by hand from
  a service that happens to be nearby. Three inputs, capped at 100:

    verification  50   cleared documents are the floor of being trusted at all
    completions   30   1.5 per completed booking
    reviews       20   scaled from the average rating

  Change the weights here and nowhere else. (Training was the fourth pillar
  until courses were dropped from the product - its 30 points moved into
  verification, completions and reviews.)
*/
const WEIGHTS = {
  VERIFICATION: 50,
  PER_COMPLETION: 1.5,
  MAX_COMPLETIONS: 30,
  MAX_REVIEWS: 20,
} as const;

// The activity kinds that actually move the score. Anything else is noise on a
// screen whose whole job is explaining why the number is what it is.
const TRUST_SCORE_ACTIVITY_TYPES: $Enums.ActivityType[] = ["VERIFICATION_APPROVED", "BOOKING_COMPLETED"];

export class TrustScoreService {
  private driverProfileRepo = new DriverProfileRepository();
  private bookingRepo = new BookingRepository();
  private reviewRepo = new ReviewRepository();
  private activityRepo = new ActivityRepository();

  async compute(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { verification_status: true });

    if (!profile) return 0;

    const [completions, reviews] = await Promise.all([this.bookingRepo.countForDriver(userId, "COMPLETED"), this.reviewRepo.summaryForSubject(userId)]);

    const verification = profile.verification_status === "APPROVED" ? WEIGHTS.VERIFICATION : 0;
    const completed = Math.min(Math.round(completions * WEIGHTS.PER_COMPLETION), WEIGHTS.MAX_COMPLETIONS);
    // No reviews yet is 0, not an assumed average - an unrated driver has not
    // earned the points, and defaulting them would flatter new accounts.
    const rating = reviews.total ? Math.round((reviews.average / 5) * WEIGHTS.MAX_REVIEWS) : 0;

    return Math.min(100, verification + completed + rating);
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

  /*
    The breakdown screen shows each component as a bar plus the fact behind it,
    so the raw counts travel with the points. The client composes the wording -
    the weights and the numbers are the server's, the sentences are not.
  */
  async breakdown(userId: string) {
    const [completions, engaged, reviews, profile] = await Promise.all([
      this.bookingRepo.countForDriver(userId, "COMPLETED"),
      this.bookingRepo.countEngagedForDriver(userId),
      this.reviewRepo.summaryForSubject(userId),
      this.driverProfileRepo.findByUserIdWithUserState(userId),
    ]);

    const total = profile?.trust_score ?? 0;

    const [percentile, recent_activity] = await Promise.all([this.driverProfileRepo.trustScorePercentile(userId, total, profile?.user?.state_of_residence ?? null), this.activityRepo.findByUserAndTypes(userId, TRUST_SCORE_ACTIVITY_TYPES, 5)]);

    return {
      total,
      percentile,
      verification: profile?.verification_status === "APPROVED" ? WEIGHTS.VERIFICATION : 0,
      completions: Math.min(Math.round(completions * WEIGHTS.PER_COMPLETION), WEIGHTS.MAX_COMPLETIONS),
      reviews: reviews.total ? Math.round((reviews.average / 5) * WEIGHTS.MAX_REVIEWS) : 0,
      max: {
        verification: WEIGHTS.VERIFICATION,
        completions: WEIGHTS.MAX_COMPLETIONS,
        reviews: WEIGHTS.MAX_REVIEWS,
      },
      facts: {
        verification_status: profile?.verification_status ?? "UNSUBMITTED",
        bookings_completed: completions,
        bookings_engaged: engaged,
        review_average: reviews.average,
        review_count: reviews.total,
      },
      recent_activity,
    };
  }
}
