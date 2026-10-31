import { BookingRepository, JOB_REQUEST_BUCKETS, type JobRequestBucket } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { BookingTransitionService } from "../booking/booking.transition.service";
import { AttendanceService } from "../booking/attendance.service";

export class DriverBookingService {
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private transitionService = new BookingTransitionService();
  private attendanceService = new AttendanceService();

  async list(userId: string, query: Record<string, unknown>, bucket?: JobRequestBucket) {
    const pagination = parsePagination(query);

    const { bookings, total } = await this.bookingRepo.findForDriver(userId, { ...pagination, bucket });

    return paginate(bookings, total, pagination);
  }

  async summary(userId: string) {
    const entries = await Promise.all(JOB_REQUEST_BUCKETS.map(async bucket => [bucket, await this.bookingRepo.countBucketForDriver(userId, bucket)] as const));

    const counts = Object.fromEntries(entries) as Record<JobRequestBucket, number>;

    return {
      active: counts.active,
      completed: counts.completed,
    };
  }

  async get(userId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.driverId !== userId) throw new ForbiddenError("That booking belongs to another driver");

    const events = await this.statusEventRepo.findForBooking(booking.id);
    const [withToday] = await this.attendanceService.todayFor([booking]);

    return { ...withToday, status_events: events };
  }

  async start(userId: string, reference: string) {
    const booking = await this.get(userId, reference);

    const started = await this.transitionService.transition(booking.id, "IN_PROGRESS", userId);

    await this.attendanceService.recordStart(started, started.started_at ?? new Date());

    return started;
  }

  // Only the driver marks a job complete. The client confirms by leaving a
  // review, and the earnings hold covers the window where they disagree.
  async complete(userId: string, reference: string) {
    const booking = await this.get(userId, reference);

    const completed = await this.transitionService.transition(booking.id, "COMPLETED", userId);

    await this.attendanceService.closeOpenShift(booking.id, completed.completed_at ?? new Date());

    return completed;
  }

  async checkIn(userId: string, reference: string) {
    return this.attendanceService.checkIn(userId, reference);
  }

  async checkOut(userId: string, reference: string) {
    return this.attendanceService.checkOut(userId, reference);
  }

  async attendance(userId: string, reference: string, month?: string) {
    return this.attendanceService.driverLog(userId, reference, month);
  }
}
