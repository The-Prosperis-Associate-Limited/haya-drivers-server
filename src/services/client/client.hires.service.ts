import { BookingRepository } from "../../repositories/booking/booking.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { prisma } from "../../helper/prisma";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";

export class ClientHiresService {
  private bookingRepo = new BookingRepository();
  private reviewRepo = new ReviewRepository();
  private driverProfileRepo = new DriverProfileRepository();

  async list(clientId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { bookings, total } = await this.bookingRepo.findActiveHires(clientId, pagination);

    return paginate(bookings, total, pagination);
  }

  // The hire detail carries the client's own review (if any) so the form knows
  // whether to render stars or the review already left, plus the driver's
  // public profile facts for the Drivers Vault profile card.
  async get(clientId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Hire not found");
    if (booking.clientId !== clientId) throw new ForbiddenError("That hire belongs to another client");

    const [review, driver, summary] = await Promise.all([
      this.reviewRepo.findByBooking(booking.id),
      booking.driverId
        ? prisma.user.findUnique({
            where: { id: booking.driverId },
            select: {
              gender: true,
              city: true,
              state_of_residence: true,
              driver_profile: {
                select: { driver_type: true, years_of_experience: true, expected_monthly_rate: true, rate_currency: true, trust_score: true },
              },
            },
          })
        : null,
      booking.driverId ? this.reviewRepo.summaryForSubject(booking.driverId) : null,
    ]);

    return {
      ...booking,
      my_review: review,
      driver_details: driver,
      driver_rating: summary?.average ?? 0,
      driver_review_count: summary?.total ?? 0,
    };
  }
}
