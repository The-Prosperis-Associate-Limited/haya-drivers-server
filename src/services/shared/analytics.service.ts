import { createHash } from "crypto";
import { prisma } from "../../helper/prisma";

const PERIOD_DAYS = { "7d": 7, "14d": 14, "30d": 30 } as const;

type VisitorPeriod = keyof typeof PERIOD_DAYS;

const utcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export class AnalyticsService {
  // Fire-and-forget from the public beacon - the unique constraint makes a
  // repeat visit on the same day a no-op.
  async recordVisit(ip: string, userAgent: string) {
    const visitor_key = createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 32);

    await prisma.siteVisit.createMany({
      data: [{ day: utcDay(new Date()), visitor_key }],
      skipDuplicates: true,
    });

    return { ok: true };
  }

  async visitorSeries(period: VisitorPeriod) {
    const days = PERIOD_DAYS[period];
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));

    const rows = await prisma.siteVisit.groupBy({
      by: ["day"],
      where: { day: { gte: since } },
      _count: { _all: true },
    });

    const buckets = new Map<string, { date: string; visitors: number }>();

    for (let i = 0; i < days; i++) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, visitors: 0 });
    }

    for (const row of rows) {
      const bucket = buckets.get(row.day.toISOString().slice(0, 10));
      if (bucket) bucket.visitors = row._count._all;
    }

    const series = [...buckets.values()];

    return {
      period,
      series,
      total: series.reduce((sum, point) => sum + point.visitors, 0),
      today: series[series.length - 1]?.visitors ?? 0,
    };
  }
}
