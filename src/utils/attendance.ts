import type { $Enums } from "../generated/prisma/client";

// An arrival within this window of the scheduled time is on time - nobody should be marked late over a parking search.
export const ON_TIME_GRACE_MS = 15 * 60 * 1000;

// Nigeria keeps West Africa Time all year with no DST, so a fixed offset is exact.
const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// A shift left open longer than this was a missed check-out, not one still running.
export const MAX_SHIFT_MS = 18 * 60 * 60 * 1000;

// Indexed by getUTCDay (0 = Sunday); CUSTOM schedules are agreed off-platform.
const WORKING_DAYS: Partial<Record<$Enums.WorkSchedule, number[]>> = {
  WEEKDAYS: [1, 2, 3, 4, 5],
  WEEKDAYS_AND_SATURDAY: [1, 2, 3, 4, 5, 6],
  FULL_WEEK: [0, 1, 2, 3, 4, 5, 6],
};

type AttendanceRow = {
  work_date: Date;
  checked_in_at: Date;
  checked_out_at: Date | null;
  minutes_late: number | null;
};

// The Lagos calendar day containing `at`, as UTC midnight - the shape a @db.Date column holds.
export const workDateOf = (at: Date) => {
  const local = new Date(at.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
};

export const workDateKey = (workDate: Date) => workDate.toISOString().slice(0, 10);

export const addDays = (workDate: Date, days: number) => new Date(workDate.getTime() + days * DAY_MS);

export const monthKeyOf = (at: Date) => workDateKey(workDateOf(at)).slice(0, 7);

export const monthRange = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(year, monthIndex - 1, 1)), to: new Date(Date.UTC(year, monthIndex, 1)) };
};

// Accepts "07:00", "7:00 AM", "7pm" - the hire form has sent more than one shape over time.
export const parseClock = (value?: string | null) => {
  const match = value?.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "p" && hours < 12) hours += 12;
  if (meridiem === "a" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
};

export const scheduledStartOn = (workDate: Date, resumptionTime?: string | null) => {
  const minutes = parseClock(resumptionTime);
  return minutes === null ? null : new Date(workDate.getTime() + minutes * 60_000 - WAT_OFFSET_MS);
};

// null when the schedule is unknown or custom - nobody can say whether the day was off.
export const isWorkingDay = (schedule: $Enums.WorkSchedule | null | undefined, workDate: Date) => {
  const days = schedule ? WORKING_DAYS[schedule] : undefined;
  return days ? days.includes(workDate.getUTCDay()) : null;
};

export const minutesLate = (checkedInAt: Date, scheduledStart: Date | null) =>
  scheduledStart ? Math.max(0, Math.round((checkedInAt.getTime() - scheduledStart.getTime()) / 60_000)) : null;

export const isLate = (late: number | null) => late !== null && late * 60_000 > ON_TIME_GRACE_MS;

export const isOpenShift = (row: Pick<AttendanceRow, "checked_in_at" | "checked_out_at">, now = new Date()) =>
  !row.checked_out_at && now.getTime() - row.checked_in_at.getTime() < MAX_SHIFT_MS;

export const formatClock = (at: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).format(at);

export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export type TodayAttendanceState = "ON_DUTY" | "CHECKED_OUT" | "NOT_IN" | "UPCOMING" | "OFF_DAY";

// What a running hire's "Today" cell says; `latest` is the booking's most recent attendance row.
export const todayAttendance = (
  booking: { status: $Enums.BookingStatus; schedule: $Enums.WorkSchedule | null; resumption_time: string | null },
  latest: AttendanceRow | null,
  now = new Date(),
) => {
  if (booking.status !== "IN_PROGRESS") return null;

  const today = workDateOf(now);
  const scheduledStart = scheduledStartOn(today, booking.resumption_time);
  const empty = { checked_in_at: null, checked_out_at: null, minutes_late: null, late: false, scheduled_start: scheduledStart };
  const fromRow = (row: AttendanceRow) => ({
    checked_in_at: row.checked_in_at,
    checked_out_at: row.checked_out_at,
    minutes_late: row.minutes_late,
    late: isLate(row.minutes_late),
    scheduled_start: scheduledStart,
  });

  if (latest && isOpenShift(latest, now)) return { state: "ON_DUTY" as TodayAttendanceState, ...fromRow(latest) };
  if (latest && workDateKey(latest.work_date) === workDateKey(today)) return { state: "CHECKED_OUT" as TodayAttendanceState, ...fromRow(latest) };
  if (isWorkingDay(booking.schedule, today) === false) return { state: "OFF_DAY" as TodayAttendanceState, ...empty };
  if (scheduledStart && now < scheduledStart) return { state: "UPCOMING" as TodayAttendanceState, ...empty };

  return { state: "NOT_IN" as TodayAttendanceState, ...empty };
};
