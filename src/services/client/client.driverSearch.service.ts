import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { NotFoundError } from "../../helper/errors";
import { prisma } from "../../helper/prisma";
import { paginate, parsePagination } from "../../utils/pagination";
import { ON_TIME_SAMPLE, onTimeRate } from "../../utils/onTimeRate";
import type { DriverSearchInput } from "../../utils/types/bookingValidatorSchema";

// Verification and matching data the admin team works from - never sent to a client.
const withoutPrivateFields = <T extends Record<string, unknown>>(profile: T) => {
  const { license_number: _licence, license_expires_at: _expiry, religion: _religion, ethnicity: _ethnicity, state_of_origin: _origin, ...rest } = profile;
  return rest;
};

export class ClientDriverSearchService {
  private driverProfileRepo = new DriverProfileRepository();
  private reviewRepo = new ReviewRepository();

  async search(query: Record<string, unknown>, filters: DriverSearchInput) {
    const pagination = parsePagination(query);

    const { drivers, total } = await this.driverProfileRepo.search({ ...pagination, ...filters });

    const userIds = drivers.map(driver => driver.userId);

    const summaries = await this.reviewRepo.summariesForSubjects(userIds);

    const withRatings = drivers.map(driver => ({
      ...withoutPrivateFields(driver),
      rating: summaries.get(driver.userId)?.average ?? 0,
      review_count: summaries.get(driver.userId)?.total ?? 0,
    }));

    return paginate(withRatings, total, pagination);
  }

  /*
    A client only ever sees an approved, discoverable driver - the repository
    filter is not a nicety, it is what keeps an unverified profile off the
    platform. Contact details stay out of the response until there is a booking.
  */
  async getPublicProfile(userId: string) {
    const profile = await this.driverProfileRepo.findByUserIdWithRelations(userId);

    if (!profile || profile.verification_status !== "APPROVED" || !profile.is_discoverable) throw new NotFoundError("Driver not found");

    return this.present(profile, userId);
  }

  // The driver's own "see what clients see" view - the same shape, no discoverability gate.
  async getPreviewForDriver(userId: string) {
    const profile = await this.driverProfileRepo.findByUserIdWithRelations(userId);

    if (!profile) throw new NotFoundError("Driver profile not found");

    return this.present(profile, userId);
  }

  private async present(profile: NonNullable<Awaited<ReturnType<DriverProfileRepository["findByUserIdWithRelations"]>>>, userId: string) {
    const [reviews, quickStats] = await Promise.all([this.reviewRepo.summaryForSubject(userId), this.quickStats(userId)]);

    const { guarantors: _guarantors, user, ...rest } = withoutPrivateFields(profile);
    const { phone_no: _phone, email: _email, ...publicUser } = user as Record<string, unknown>;

    return {
      ...rest,
      user: publicUser,
      rating: reviews.average,
      review_count: reviews.total,
      ...quickStats,
    };
  }

  // On-time means the driver's own "start job" stamp landed within the grace
  // window of the scheduled start. Both rates are null until measured - a
  // driver nobody has booked has no record, not a bad one.
  private async quickStats(userId: string) {
    const [completedJobs, answered, started] = await Promise.all([
      prisma.booking.count({ where: { driverId: userId, status: "COMPLETED" } }),
      prisma.booking.findMany({
        where: { driverId: userId, OR: [{ accepted_at: { not: null } }, { declined_at: { not: null } }] },
        select: { createdAt: true, accepted_at: true, declined_at: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.booking.findMany({
        where: { driverId: userId, started_at: { not: null } },
        select: { starts_at: true, started_at: true },
        orderBy: { starts_at: "desc" },
        take: ON_TIME_SAMPLE,
      }),
    ]);

    const latencies = answered.map(booking => {
      const answeredAt = booking.accepted_at ?? booking.declined_at;
      return answeredAt ? answeredAt.getTime() - booking.createdAt.getTime() : null;
    });

    const valid = latencies.filter((latency): latency is number => latency !== null && latency >= 0);

    const responseTimeMinutes = valid.length ? Math.round(valid.reduce((sum, latency) => sum + latency, 0) / valid.length / 60000) : null;

    return {
      completed_jobs: completedJobs,
      response_time_minutes: responseTimeMinutes,
      on_time_rate: onTimeRate(started),
    };
  }

  async listReviews(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { reviews, total } = await this.reviewRepo.findForSubject(userId, pagination);

    return paginate(reviews, total, pagination);
  }
}
