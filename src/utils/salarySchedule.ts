import type { $Enums } from "../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
// Nigeria has no DST, so month arithmetic runs on the Lagos calendar with a fixed offset.
const WAT_OFFSET_MS = 60 * 60 * 1000;

// A client gets this long past the due date before a salary counts as overdue and reminders start.
export const SALARY_GRACE_DAYS = Number(process.env.SALARY_GRACE_DAYS ?? 3);
export const SALARY_REMINDER_EVERY_DAYS = 3;

export interface SalaryPeriod {
  period_start: Date;
  period_end: Date;
  due_at: Date;
  amount_minor: number;
}

interface Engagement {
  engagement_type: $Enums.EngagementType;
  starts_at: Date;
  ends_at: Date | null;
  amount: number;
}

// Jan 31 + 1 month is Feb 28, not Mar 3; always counted from the anchor so a short month never shifts the rest.
export const addMonths = (anchor: Date, months: number) => {
  const local = new Date(anchor.getTime() + WAT_OFFSET_MS);
  const day = local.getUTCDate();
  const target = new Date(local);

  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  target.setUTCDate(Math.min(day, new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()));

  return new Date(target.getTime() - WAT_OFFSET_MS);
};

export const engagementEnd = (
  startsAt: Date,
  engagement: $Enums.EngagementType,
  durationDays?: number | null,
  durationMonths?: number | null,
) => {
  if (engagement === "CONTRACT" && durationDays) return new Date(startsAt.getTime() + durationDays * DAY_MS);
  if (engagement === "MONTHLY" && durationMonths) return addMonths(startsAt, durationMonths);

  return null;
};

export const isOverdue = (row: { status: $Enums.SalaryPaymentStatus; due_at: Date }, now = new Date()) =>
  row.status === "DUE" && now.getTime() > row.due_at.getTime() + SALARY_GRACE_DAYS * DAY_MS;

const prorate = (amount: number, start: Date, end: Date, fullEnd: Date) =>
  end.getTime() >= fullEnd.getTime() ? amount : Math.round((amount * (end.getTime() - start.getTime())) / (fullEnd.getTime() - start.getTime()));

// Periods that have started by `until` (always the first); a dated contract is one period, anything else one per month - the last prorated when the engagement stops early.
export const salaryPeriods = (engagement: Engagement, until: Date, endedAt: Date | null): SalaryPeriod[] => {
  const stop = [engagement.ends_at, endedAt].filter((date): date is Date => !!date).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  if (stop && stop.getTime() <= engagement.starts_at.getTime()) return [];

  if (engagement.engagement_type === "CONTRACT" && engagement.ends_at) {
    const end = stop ?? engagement.ends_at;

    return [
      {
        period_start: engagement.starts_at,
        period_end: end,
        due_at: end,
        amount_minor: prorate(engagement.amount, engagement.starts_at, end, engagement.ends_at),
      },
    ];
  }

  const periods: SalaryPeriod[] = [];

  for (let index = 0; ; index++) {
    const start = addMonths(engagement.starts_at, index);

    if (index > 0 && start.getTime() > until.getTime()) break;
    if (stop && start.getTime() >= stop.getTime()) break;

    const fullEnd = addMonths(engagement.starts_at, index + 1);
    const end = stop && stop.getTime() < fullEnd.getTime() ? stop : fullEnd;

    periods.push({ period_start: start, period_end: end, due_at: end, amount_minor: prorate(engagement.amount, start, end, fullEnd) });
  }

  return periods;
};
