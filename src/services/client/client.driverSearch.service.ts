import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { CertificationRepository } from "../../repositories/training/certification.repository";
import { NotFoundError } from "../../helper/errors";
import { prisma } from "../../helper/prisma";
import { paginate, parsePagination } from "../../utils/pagination";
import type { DriverSearchInput } from "../../utils/types/bookingValidatorSchema";

export class ClientDriverSearchService {
  private driverProfileRepo = new DriverProfileRepository();
  private reviewRepo = new ReviewRepository();
  private certificationRepo = new CertificationRepository();

  async search(query: Record<string, unknown>, filters: DriverSearchInput) {
    const pagination = parsePagination(query);

    const { drivers, total } = await this.driverProfileRepo.search({ ...pagination, ...filters });

    const summaries = await this.reviewRepo.summariesForSubjects(drivers.map(driver => driver.userId));

    const withRatings = drivers.map(driver => ({
      ...driver,
      rating: summaries.get(driver.userId)?.average ?? 0,
      review_count: summaries.get(driver.userId)?.total ?? 0,
    }));

    return paginate(withRatings, total, pagination);
  }

  /*
    A client only ever sees an approved, discoverable driver — the repository
    filter is not a nicety, it is what keeps an unverified profile off the
    platform. Contact details stay out of the response until there is a booking.
  */
  async getPublicProfile(userId: string) {
    const profile = await this.driverProfileRepo.findByUserIdWithRelations(userId);

    if (!profile || profile.verification_status !== "APPROVED" || !profile.is_discoverable) throw new NotFoundError("Driver not found");

    const [reviews, certifications, quickStats] = await Promise.all([this.reviewRepo.summaryForSubject(userId), this.certificationRepo.findForUser(userId), this.quickStats(userId)]);

    const { guarantors: _guarantors, user, ...rest } = profile;
    const { phone_no: _phone, email: _email, ...publicUser } = user as Record<string, unknown>;

    return {
      ...rest,
      user: publicUser,
      rating: reviews.average,
      review_count: reviews.total,
      ...quickStats,
      certifications: certifications.map(certification => ({
        id: certification.id,
        title: certification.course.title,
        issued_at: certification.issued_at,
        expires_at: certification.expires_at,
      })),
    };
  }

  // on_time_rate stays null until a punctuality signal exists — the client
  // renders it as "—" rather than a number nobody measured.
  private async quickStats(userId: string) {
    const [completedJobs, answered] = await Promise.all([
      prisma.booking.count({ where: { driverId: userId, status: "COMPLETED" } }),
      prisma.booking.findMany({
        where: { driverId: userId, OR: [{ accepted_at: { not: null } }, { declined_at: { not: null } }] },
        select: { createdAt: true, accepted_at: true, declined_at: true },
        orderBy: { createdAt: "desc" },
        take: 50,
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
      on_time_rate: null as number | null,
    };
  }

  async listReviews(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { reviews, total } = await this.reviewRepo.findForSubject(userId, pagination);

    return paginate(reviews, total, pagination);
  }
}
