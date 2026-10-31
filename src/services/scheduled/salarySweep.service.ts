import { BookingRepository } from "../../repositories/booking/booking.repository";
import { AttendanceService } from "../booking/attendance.service";
import { BookingTransitionService } from "../booking/booking.transition.service";
import { SalaryService } from "../booking/salary.service";
import { NotificationService } from "../shared/notification.service";

const bookingRepo = new BookingRepository();
const transitionService = new BookingTransitionService();
const attendanceService = new AttendanceService();
const salaryService = new SalaryService();
const notificationService = new NotificationService();

type EndedBooking = Awaited<ReturnType<BookingRepository["findEndedEngagements"]>>[number];

const endDay = (at: Date) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(at);

const endEngagement = async (booking: EndedBooking, now: Date) => {
  const endsAt = booking.ends_at as Date;
  const started = booking.status === "IN_PROGRESS";

  // Acting as the client makes the transition notify the driver; the client is told below.
  await transitionService.transition(booking.id, started ? "COMPLETED" : "CANCELLED", booking.clientId, {
    note: `Engagement period ended on ${endDay(endsAt)}`,
    reason: started ? undefined : "The engagement period ended before the job was started.",
  });

  if (started) await attendanceService.closeOpenShift(booking.id, now);

  await notificationService.notify({
    recipientId: booking.clientId,
    type: "BOOKING_STATUS",
    title: started ? "An engagement has ended" : "An engagement ended without starting",
    message: started
      ? `${booking.title} reached its end date (${endDay(endsAt)}) and is now complete. Settle any salary still due and leave a review.`
      : `${booking.title} reached its end date (${endDay(endsAt)}) without the driver starting, so it was closed.`,
    actionUrl: `/dashboard/my-hire/${booking.reference}`,
    metadata: { reference: booking.reference },
  });
};

const endEngagements = async (now: Date) => {
  const ended = await bookingRepo.findEndedEngagements(now);
  let closed = 0;

  // One booking that fails to close must not stop the rest; it is retried on the next run.
  for (const booking of ended) {
    try {
      await endEngagement(booking, now);
      closed++;
    } catch (error) {
      console.error(`Salary sweep could not end ${booking.reference}:`, error);
    }
  }

  return closed;
};

export const salarySweep = async () => {
  const now = new Date();
  const ended = await endEngagements(now);
  const synced = await salaryService.syncAllActive();
  const reminded = await salaryService.remindOverdue();

  return `${ended} engagement(s) ended, ${synced} synced, ${reminded} overdue reminder(s)`;
};
