// A start stamped within this window of the scheduled time still counts as on
// time - nobody should be marked late over a parking search.
const ON_TIME_GRACE_MS = 15 * 60 * 1000;

export const ON_TIME_SAMPLE = 50;

export const onTimeRate = (started: { starts_at: Date; started_at: Date | null }[]) => {
  if (!started.length) return null;

  const onTime = started.filter(booking => booking.started_at && booking.started_at.getTime() <= booking.starts_at.getTime() + ON_TIME_GRACE_MS);

  return Math.round((onTime.length / started.length) * 100);
};
