import { AttendanceRepository } from "../../repositories/booking/attendance.repository";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import {
  addDays,
  formatClock,
  formatDuration,
  isLate,
  isOpenShift,
  isWorkingDay,
  MAX_SHIFT_MS,
  minutesLate,
  monthKeyOf,
  monthRange,
  scheduledStartOn,
  todayAttendance,
  workDateKey,
  workDateOf,
} from "../../utils/attendance";
import { ON_TIME_SAMPLE, onTimeRate } from "../../utils/onTimeRate";
import { paginate, parsePagination } from "../../utils/pagination";
import { NotificationService } from "../shared/notification.service";

type Booking = NonNullable<Awaited<ReturnType<BookingRepository["findByReference"]>>>;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const nameOf = (person?: { first_name: string | null; last_name: string | null } | null, fallback = "Your driver") =>
  [person?.first_name, person?.last_name].filter(Boolean).join(" ") || fallback;

const clientNameOf = (booking: Booking) => booking.client.client_profile?.organisation_name || nameOf(booking.client, "The client");

const dayLabel = (workDate: Date) => new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(workDate);

export class AttendanceService {
  private attendanceRepo = new AttendanceRepository();
  private bookingRepo = new BookingRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();

  async checkIn(driverId: string, reference: string) {
    const booking = await this.driverBooking(driverId, reference);

    if (booking.status !== "IN_PROGRESS") throw new BadRequestError("Start the job before checking in");

    const now = new Date();
    const open = await this.attendanceRepo.findOpenForDriver(driverId, new Date(now.getTime() - MAX_SHIFT_MS));

    if (open) {
      throw new BadRequestError(
        open.bookingId === booking.id ? "You're already checked in" : `You're still checked in on ${open.booking.title} - check out there first`,
      );
    }

    if (await this.attendanceRepo.findForDay(booking.id, workDateOf(now))) throw new BadRequestError("You've already checked in and out today");

    return this.record(booking, now);
  }

  // Starting a job is the first day's check-in, so the driver never has to do both.
  async recordStart(booking: Booking, at: Date) {
    if (await this.attendanceRepo.findForDay(booking.id, workDateOf(at))) return;

    await this.record(booking, at);
  }

  async checkOut(driverId: string, reference: string) {
    const booking = await this.driverBooking(driverId, reference);
    const now = new Date();
    const open = await this.attendanceRepo.findOpenForBooking(booking.id, new Date(now.getTime() - MAX_SHIFT_MS));

    if (!open) throw new BadRequestError("You're not checked in on this job");

    return this.attendanceRepo.update(open.id, { checked_out_at: now });
  }

  // Completing a job mid-shift ends the shift too.
  async closeOpenShift(bookingId: string, at: Date) {
    const open = await this.attendanceRepo.findOpenForBooking(bookingId, new Date(at.getTime() - MAX_SHIFT_MS));

    if (open) await this.attendanceRepo.update(open.id, { checked_out_at: at });
  }

  async driverLog(driverId: string, reference: string, month?: string) {
    return this.log(await this.driverBooking(driverId, reference), month);
  }

  async clientLog(clientId: string, reference: string, month?: string) {
    return this.log(await this.clientBooking(clientId, reference), month);
  }

  async flag(clientId: string, reference: string, attendanceId: string, reason: string) {
    const booking = await this.clientBooking(clientId, reference);
    const row = await this.attendanceRepo.findById(attendanceId);

    if (!row || row.bookingId !== booking.id) throw new NotFoundError("That attendance day was not found");
    if (row.flagged_at) throw new BadRequestError("You've already flagged this day - our team is looking into it");

    const updated = await this.attendanceRepo.update(row.id, { flagged_at: new Date(), flag_reason: reason });

    const clientName = clientNameOf(booking);
    const driverName = nameOf(booking.driver);
    const day = dayLabel(row.work_date);
    const adminIds = await this.userRepo.findAdminIds();

    await Promise.all([
      ...adminIds.map(recipientId =>
        this.notificationService.notify({
          recipientId,
          senderId: clientId,
          type: "WARNING",
          title: "Attendance flagged",
          message: `${clientName} flagged ${driverName}'s check-in on ${day} (${booking.reference}): "${reason}"`,
          actionUrl: "/dashboard/attendance",
          metadata: { reference: booking.reference, attendanceId: row.id },
        }),
      ),
      booking.driverId
        ? this.notificationService.notify({
            recipientId: booking.driverId,
            senderId: clientId,
            type: "WARNING",
            title: "A client flagged your attendance",
            message: `${clientName} raised a concern about ${day}. Our team will be in touch - reply through Support if you have context to add.`,
            actionUrl: `/dashboard/job-request/${booking.reference}`,
            metadata: { reference: booking.reference, attendanceId: row.id },
          })
        : null,
    ]);

    return updated;
  }

  async adminLog(reference: string, month?: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");

    return { booking: { reference: booking.reference, title: booking.title, client: clientNameOf(booking), driver: nameOf(booking.driver, "Driver") }, ...(await this.log(booking, month)) };
  }

  async listFlags(status: "open" | "resolved", query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [{ rows, total }, counts] = await Promise.all([this.attendanceRepo.findFlags(status, pagination), this.attendanceRepo.countFlags()]);

    return {
      ...paginate(
        rows.map(({ booking, ...row }) => ({
          ...row,
          work_date: workDateKey(row.work_date),
          late: isLate(row.minutes_late),
          booking: { reference: booking.reference, title: booking.title, resumption_time: booking.resumption_time, closing_time: booking.closing_time },
          client: { id: booking.client.id, name: booking.client.client_profile?.organisation_name || nameOf(booking.client, "Client"), profile_pic: booking.client.profile_pic },
          driver: booking.driver ? { id: booking.driver.id, name: nameOf(booking.driver, "Driver"), profile_pic: booking.driver.profile_pic } : null,
        })),
        total,
        pagination,
      ),
      counts,
    };
  }

  async resolveFlag(adminId: string, attendanceId: string, outcome: "UPHELD" | "DISMISSED", note: string) {
    const row = await this.attendanceRepo.findById(attendanceId);

    if (!row || !row.flagged_at) throw new NotFoundError("That flagged day was not found");
    if (row.flag_resolved_at) throw new BadRequestError("This flag has already been resolved");

    const booking = await this.bookingRepo.findById(row.bookingId);

    if (!booking) throw new NotFoundError("Booking not found");

    const updated = await this.attendanceRepo.update(row.id, {
      flag_resolution: outcome,
      flag_resolution_note: note,
      flag_resolved_at: new Date(),
      flag_resolved_by: adminId,
    });

    const day = dayLabel(row.work_date);
    const upheld = outcome === "UPHELD";

    await Promise.all([
      this.notificationService.notify({
        recipientId: booking.clientId,
        senderId: adminId,
        type: "BOOKING_STATUS",
        title: upheld ? "We upheld your attendance flag" : "We reviewed your attendance flag",
        message: `${day} on ${booking.reference}: ${upheld ? "your concern was upheld" : "we found no problem with the check-in"}. ${note}`,
        actionUrl: `/dashboard/my-hire/${booking.reference}`,
        metadata: { reference: booking.reference, attendanceId: row.id },
      }),
      booking.driverId
        ? this.notificationService.notify({
            recipientId: booking.driverId,
            senderId: adminId,
            type: upheld ? "WARNING" : "INFO",
            title: upheld ? "A flagged day was upheld" : "A flagged day was cleared",
            message: upheld
              ? `The client's concern about ${day} was upheld, so it counts against your on-time rate. ${note}`
              : `The client's concern about ${day} was dismissed - nothing changes on your record. ${note}`,
            actionUrl: `/dashboard/job-request/${booking.reference}`,
            metadata: { reference: booking.reference, attendanceId: row.id },
          })
        : null,
    ]);

    return updated;
  }

  async todayFor<T extends { id: string; status: Booking["status"]; schedule: Booking["schedule"]; resumption_time: string | null }>(bookings: T[]) {
    const latest = await this.attendanceRepo.latestForBookings(bookings.filter(booking => booking.status === "IN_PROGRESS").map(booking => booking.id));
    const byBooking = new Map(latest.map(row => [row.bookingId, row]));
    const now = new Date();

    return bookings.map(booking => ({ ...booking, today_attendance: todayAttendance(booking, byBooking.get(booking.id) ?? null, now) }));
  }

  async onTimeRate(scope: { driverId: string } | { clientId: string }) {
    const [checkIns, legacyStarts] = await Promise.all([
      this.attendanceRepo.findTimedCheckIns(scope, ON_TIME_SAMPLE),
      this.bookingRepo.findStartsWithoutAttendance(scope, ON_TIME_SAMPLE),
    ]);

    return onTimeRate(checkIns, legacyStarts);
  }

  async countOnDutyForClient(clientId: string) {
    return this.attendanceRepo.countOnDutyForClient(clientId, new Date(Date.now() - MAX_SHIFT_MS));
  }

  private async record(booking: Booking, at: Date) {
    const workDate = workDateOf(at);
    const scheduledStart = scheduledStartOn(workDate, booking.resumption_time);
    const late = minutesLate(at, scheduledStart);

    const row = await this.attendanceRepo.create({
      bookingId: booking.id,
      driverId: booking.driverId as string,
      work_date: workDate,
      checked_in_at: at,
      minutes_late: late,
      scheduled_day: isWorkingDay(booking.schedule, workDate) !== false,
    });

    // Clients see who is on duty on their dashboard; only a late start is worth a ping.
    if (scheduledStart && isLate(late)) {
      await this.notificationService.notify({
        recipientId: booking.clientId,
        senderId: booking.driverId ?? undefined,
        type: "BOOKING_STATUS",
        title: `${nameOf(booking.driver)} checked in late`,
        message: `${nameOf(booking.driver)} checked in at ${formatClock(at)}, ${formatDuration(late as number)} after the ${formatClock(scheduledStart)} start.`,
        actionUrl: `/dashboard/my-hire/${booking.reference}`,
        metadata: { reference: booking.reference },
      });
    }

    return row;
  }

  private async log(booking: Booking, month?: string) {
    const now = new Date();
    const key = month && MONTH_PATTERN.test(month) ? month : monthKeyOf(now);
    const { from, to } = monthRange(key);
    const today = workDateOf(now);

    const [rows, firstDay, [latest]] = await Promise.all([
      this.attendanceRepo.findForMonth(booking.id, from, to),
      this.attendanceRepo.findFirstDay(booking.id),
      this.attendanceRepo.latestForBookings([booking.id]),
    ]);

    const days = rows.map(row => ({
      id: row.id,
      work_date: workDateKey(row.work_date),
      status: row.checked_out_at ? "COMPLETE" : isOpenShift(row, now) ? "ON_DUTY" : "NO_CHECK_OUT",
      checked_in_at: row.checked_in_at,
      checked_out_at: row.checked_out_at,
      minutes_late: row.minutes_late,
      late: isLate(row.minutes_late) || row.flag_resolution === "UPHELD",
      scheduled_day: row.scheduled_day,
      minutes_worked: row.checked_out_at ? Math.round((row.checked_out_at.getTime() - row.checked_in_at.getTime()) / 60_000) : null,
      flagged_at: row.flagged_at,
      flag_reason: row.flag_reason,
      flag_resolution: row.flag_resolution,
      flag_resolution_note: row.flag_resolution_note,
      flag_resolved_at: row.flag_resolved_at,
    }));

    // Missed days only count from the first check-in on record, and never today - the day isn't over.
    const missed: { work_date: string; status: "MISSED" }[] = [];

    if (firstDay) {
      const seen = new Set(days.map(day => day.work_date));
      const ended = booking.completed_at ? addDays(workDateOf(booking.completed_at), 1) : today;
      const stop = new Date(Math.min(to.getTime(), today.getTime(), ended.getTime()));

      for (let day = new Date(Math.max(from.getTime(), firstDay.getTime())); day < stop; day = addDays(day, 1)) {
        if (isWorkingDay(booking.schedule, day) && !seen.has(workDateKey(day))) missed.push({ work_date: workDateKey(day), status: "MISSED" });
      }
    }

    const timed = days.filter(day => day.minutes_late !== null || day.flag_resolution === "UPHELD");
    const worked = days.filter(day => day.minutes_worked !== null);
    const minutesWorked = worked.reduce((total, day) => total + (day.minutes_worked ?? 0), 0);

    return {
      month: key,
      tracking_since: firstDay ? workDateKey(firstDay) : null,
      schedule: booking.schedule,
      resumption_time: booking.resumption_time,
      closing_time: booking.closing_time,
      today: todayAttendance(booking, latest ?? null, now),
      summary: {
        days_worked: days.length,
        on_time: timed.filter(day => !day.late).length,
        late: timed.filter(day => day.late).length,
        missed: missed.length,
        flagged: days.filter(day => day.flagged_at).length,
        minutes_worked: minutesWorked,
        average_minutes: worked.length ? Math.round(minutesWorked / worked.length) : null,
        punctuality: timed.length ? Math.round((timed.filter(day => !day.late).length / timed.length) * 100) : null,
      },
      days: [...days, ...missed].sort((a, b) => b.work_date.localeCompare(a.work_date)),
    };
  }

  private async driverBooking(driverId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.driverId !== driverId) throw new ForbiddenError("That booking belongs to another driver");

    return booking;
  }

  private async clientBooking(clientId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Hire not found");
    if (booking.clientId !== clientId) throw new ForbiddenError("That hire belongs to another client");

    return booking;
  }
}
