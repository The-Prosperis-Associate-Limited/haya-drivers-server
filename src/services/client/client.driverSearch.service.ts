import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { CertificationRepository } from "../../repositories/training/certification.repository";
import { NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import type { DriverSearchInput } from "../../utils/types/bookingValidatorSchema";

export class ClientDriverSearchService {
  private driverProfileRepo = new DriverProfileRepository();
  private reviewRepo = new ReviewRepository();
  private certificationRepo = new CertificationRepository();

  async search(query: Record<string, unknown>, filters: DriverSearchInput) {
    const pagination = parsePagination(query);

    const { drivers, total } = await this.driverProfileRepo.search({ ...pagination, ...filters });

    return paginate(drivers, total, pagination);
  }

  /*
    A client only ever sees an approved, discoverable driver — the repository
    filter is not a nicety, it is what keeps an unverified profile off the
    platform. Contact details stay out of the response until there is a booking.
  */
  async getPublicProfile(userId: string) {
    const profile = await this.driverProfileRepo.findByUserIdWithRelations(userId);

    if (!profile || profile.verification_status !== "APPROVED" || !profile.is_discoverable) throw new NotFoundError("Driver not found");

    const [reviews, certifications] = await Promise.all([this.reviewRepo.summaryForSubject(userId), this.certificationRepo.findForUser(userId)]);

    const { guarantors: _guarantors, user, ...rest } = profile;
    const { phone_no: _phone, email: _email, ...publicUser } = user as Record<string, unknown>;

    return {
      ...rest,
      user: publicUser,
      rating: reviews.average,
      review_count: reviews.total,
      certifications: certifications.map(certification => ({
        id: certification.id,
        title: certification.course.title,
        issued_at: certification.issued_at,
        expires_at: certification.expires_at,
      })),
    };
  }

  async listReviews(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { reviews, total } = await this.reviewRepo.findForSubject(userId, pagination);

    return paginate(reviews, total, pagination);
  }
}
