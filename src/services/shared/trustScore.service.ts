import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { CertificationRepository } from "../../repositories/training/certification.repository";
import { CourseRepository } from "../../repositories/training/course.repository";
import { EnrollmentRepository } from "../../repositories/training/enrollment.repository";
import { ActivityRepository } from "../../repositories/user/activity.repository";

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

// The activity kinds that actually move the score. Anything else is noise on a
// screen whose whole job is explaining why the number is what it is.
const TRUST_SCORE_ACTIVITY_TYPES: $Enums.ActivityType[] = [
  "VERIFICATION_APPROVED",
  "CERTIFICATION_ISSUED",
  "COURSE_COMPLETED",
  "BOOKING_COMPLETED",
];

export class TrustScoreService {
  private driverProfileRepo = new DriverProfileRepository();
  private certificationRepo = new CertificationRepository();
  private bookingRepo = new BookingRepository();
  private reviewRepo = new ReviewRepository();
  private courseRepo = new CourseRepository();
  private enrollmentRepo = new EnrollmentRepository();
  private activityRepo = new ActivityRepository();

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

  /*
    The breakdown screen shows each component as a bar plus the fact behind it,
    so the raw counts travel with the points. The client composes the wording —
    the weights and the numbers are the server's, the sentences are not.
  */
  async breakdown(userId: string) {
    const [certifications, completions, engaged, reviews, requiredCourses, requiredCompleted, profile] = await Promise.all([
      this.certificationRepo.countForUser(userId),
      this.bookingRepo.countForDriver(userId, "COMPLETED"),
      this.bookingRepo.countEngagedForDriver(userId),
      this.reviewRepo.summaryForSubject(userId),
      this.courseRepo.countRequired(),
      this.enrollmentRepo.countRequiredCompletedForUser(userId),
      this.driverProfileRepo.findByUserIdWithUserState(userId),
    ]);

    const total = profile?.trust_score ?? 0;

    const [percentile, recent_activity] = await Promise.all([
      this.driverProfileRepo.trustScorePercentile(userId, total, profile?.user?.state_of_residence ?? null),
      this.activityRepo.findByUserAndTypes(userId, TRUST_SCORE_ACTIVITY_TYPES, 5),
    ]);

    return {
      total,
      percentile,
      verification: profile?.verification_status === "APPROVED" ? WEIGHTS.VERIFICATION : 0,
      training: Math.min(certifications * WEIGHTS.PER_CERTIFICATION, WEIGHTS.MAX_TRAINING),
      completions: Math.min(completions * WEIGHTS.PER_COMPLETION, WEIGHTS.MAX_COMPLETIONS),
      reviews: reviews.total ? Math.round((reviews.average / 5) * WEIGHTS.MAX_REVIEWS) : 0,
      max: {
        verification: WEIGHTS.VERIFICATION,
        training: WEIGHTS.MAX_TRAINING,
        completions: WEIGHTS.MAX_COMPLETIONS,
        reviews: WEIGHTS.MAX_REVIEWS,
      },
      facts: {
        verification_status: profile?.verification_status ?? "UNSUBMITTED",
        certifications_earned: certifications,
        required_courses: requiredCourses,
        required_courses_completed: requiredCompleted,
        bookings_completed: completions,
        bookings_engaged: engaged,
        review_average: reviews.average,
        review_count: reviews.total,
      },
      recent_activity,
    };
  }
}
