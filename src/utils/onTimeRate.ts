import { isLate, ON_TIME_GRACE_MS, scheduledStartOn, workDateOf } from "./attendance";

export const ON_TIME_SAMPLE = 50;

type CheckIn = { checked_in_at: Date; minutes_late: number | null; flag_resolution?: string | null };
type LegacyStart = { starts_at: Date; started_at: Date | null; resumption_time: string | null };

// A date-only start (midnight UTC) with no resumption time has no clock to be late against.
const legacyDue = (booking: LegacyStart) => {
  if (booking.resumption_time) return scheduledStartOn(workDateOf(booking.started_at ?? booking.starts_at), booking.resumption_time);

  const startsAt = booking.starts_at;
  const dateOnly = startsAt.getUTCHours() === 0 && startsAt.getUTCMinutes() === 0 && startsAt.getUTCSeconds() === 0 && startsAt.getUTCMilliseconds() === 0;

  return dateOnly ? null : startsAt;
};

// Every daily check-in is an arrival; jobs started before attendance existed count once via their start stamp.
export const onTimeRate = (checkIns: CheckIn[], legacyStarts: LegacyStart[] = []) => {
  const arrivals = [
    ...checkIns
      .filter(row => row.minutes_late !== null || row.flag_resolution === "UPHELD")
      .map(row => ({ at: row.checked_in_at, onTime: row.flag_resolution !== "UPHELD" && !isLate(row.minutes_late) })),
    ...legacyStarts.flatMap(booking => {
      const due = legacyDue(booking);
      return due && booking.started_at ? [{ at: booking.started_at, onTime: booking.started_at.getTime() <= due.getTime() + ON_TIME_GRACE_MS }] : [];
    }),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, ON_TIME_SAMPLE);

  if (!arrivals.length) return null;

  return Math.round((arrivals.filter(arrival => arrival.onTime).length / arrivals.length) * 100);
};
