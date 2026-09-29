import { BookingRepository, JOB_REQUEST_BUCKETS, type JobRequestBucket } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { BookingTransitionService } from "../booking/booking.transition.service";

export class DriverBookingService {
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private transitionService = new BookingTransitionService();

  async list(userId: string, query: Record<string, unknown>, bucket?: JobRequestBucket) {
    const pagination = parsePagination(query);

    const { bookings, total } = await this.bookingRepo.findForDriver(userId, { ...pagination, bucket });

    return paginate(bookings, total, pagination);
  }

  async summary(userId: string) {
    const [entries, answered, closed] = await Promise.all([
      Promise.all(JOB_REQUEST_BUCKETS.map(async (bucket) => [bucket, await this.bookingRepo.countBucketForDriver(userId, bucket)] as const)),
      this.bookingRepo.countAnsweredForDriver(userId),
      this.bookingRepo.countClosedForDriver(userId),
    ]);

    const counts = Object.fromEntries(entries) as Record<JobRequestBucket, number>;

    return {
      open: counts.open,
      accepted: counts.accepted,
      declined: counts.declined,
      // Null, not zero, until a request has actually closed - a driver who has
      // never been asked has no record, and 0% reads as a bad one.
      response_rate: closed ? Math.round((answered / closed) * 100) : null,
    };
  }

  async get(userId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.driverId !== userId) throw new ForbiddenError("That booking belongs to another driver");

    const events = await this.statusEventRepo.findForBooking(booking.id);

    return { ...booking, status_events: events };
  }

  async accept(userId: string, reference: string) {
    const booking = await this.get(userId, reference);

    return this.transitionService.transition(booking.id, "ACCEPTED", userId);
  }

  async decline(userId: string, reference: string, reason: string) {
    const booking = await this.get(userId, reference);

    return this.transitionService.transition(booking.id, "DECLINED", userId, { reason });
  }

  async start(userId: string, reference: string) {
    const booking = await this.get(userId, reference);

    return this.transitionService.transition(booking.id, "IN_PROGRESS", userId);
  }

  // Only the driver marks a job complete. The client confirms by leaving a
  // review, and the earnings hold covers the window where they disagree.
  async complete(userId: string, reference: string) {
    const booking = await this.get(userId, reference);

    return this.transitionService.transition(booking.id, "COMPLETED", userId);
  }
}
