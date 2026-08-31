import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { BookingTransitionService } from "../booking/booking.transition.service";

export class DriverBookingService {
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private transitionService = new BookingTransitionService();

  async list(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const status = query.status as $Enums.BookingStatus | undefined;

    const { bookings, total } = await this.bookingRepo.findForDriver(userId, { ...pagination, status });

    return paginate(bookings, total, pagination);
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
