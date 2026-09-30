import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { BookingTransitionService } from "../booking/booking.transition.service";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { TrustScoreService } from "../shared/trustScore.service";
import type { ReviewBookingInput } from "../../utils/types/bookingValidatorSchema";

export class ClientBookingService {
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private reviewRepo = new ReviewRepository();
  private userRepo = new UserRepository();
  private transitionService = new BookingTransitionService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();
  private trustScoreService = new TrustScoreService();

  async list(clientId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { bookings, total } = await this.bookingRepo.findForClient(clientId, { ...pagination, status: query.status as $Enums.BookingStatus | undefined });

    return paginate(bookings, total, pagination);
  }

  async get(clientId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.clientId !== clientId) throw new ForbiddenError("That booking belongs to another client");

    const events = await this.statusEventRepo.findForBooking(booking.id);

    return { ...booking, status_events: events };
  }

  async cancel(clientId: string, reference: string, reason: string) {
    const booking = await this.get(clientId, reference);

    return this.transitionService.transition(booking.id, "CANCELLED", clientId, { reason });
  }

  async review(clientId: string, reference: string, data: ReviewBookingInput) {
    const booking = await this.get(clientId, reference);

    // A monthly hire runs for months - the client reviews the driver while the
    // engagement is live, not only after it ends. Unanswered requests stay
    // unreviewable: nobody reviews a driver who never worked for them.
    const reviewable = booking.accepted_at && ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);

    if (!reviewable) throw new BadRequestError("You can review a driver once they have taken the job");
    if (!booking.driverId) throw new BadRequestError("This booking has no driver to review");

    const existing = await this.reviewRepo.findByBooking(booking.id);

    if (existing) throw new BadRequestError("You have already reviewed this job");

    const scores = Object.values(data.criteria ?? {});
    const rating = data.rating ?? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

    const review = await this.reviewRepo.create({
      bookingId: booking.id,
      authorId: clientId,
      subjectId: booking.driverId,
      rating,
      comment: data.comment,
      criteria: data.criteria,
    });

    // A review moves the trust score, which is what the client search sorts by.
    await this.trustScoreService.recompute(booking.driverId);

    await this.notificationService.notify({
      recipientId: booking.driverId,
      senderId: clientId,
      type: "BOOKING_STATUS",
      title: "New review",
      message: `You received a ${data.rating}-star review for ${booking.title}.`,
      actionUrl: "/dashboard",
    });

    return review;
  }
}
