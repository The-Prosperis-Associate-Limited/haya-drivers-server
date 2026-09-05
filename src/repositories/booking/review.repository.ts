import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class ReviewRepository {
  async create(data: Prisma.ReviewUncheckedCreateInput) {
    return prisma.review.create({ data });
  }

  async findByBooking(bookingId: string) {
    return prisma.review.findUnique({ where: { bookingId } });
  }

  async findForSubject(subjectId: string, { page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { subjectId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, first_name: true, last_name: true, profile_pic: true } },
          booking: { select: { reference: true, title: true, starts_at: true } },
        },
      }),
      prisma.review.count({ where: { subjectId } }),
    ]);

    return { reviews, total };
  }

  async summaryForSubject(subjectId: string) {
    const [aggregate, total] = await Promise.all([prisma.review.aggregate({ where: { subjectId }, _avg: { rating: true } }), prisma.review.count({ where: { subjectId } })]);

    return { average: aggregate._avg.rating ?? 0, total };
  }

  // One query for a whole page of search results — a summary per card would be
  // an N+1 on the marketplace's hottest path.
  async summariesForSubjects(subjectIds: string[]) {
    if (!subjectIds.length) return new Map<string, { average: number; total: number }>();

    const rows = await prisma.review.groupBy({
      by: ["subjectId"],
      where: { subjectId: { in: subjectIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return new Map(rows.map(row => [row.subjectId, { average: row._avg.rating ?? 0, total: row._count.rating }]));
  }

  async countByRatingForSubject(subjectId: string) {
    const rows = await prisma.review.groupBy({ by: ["rating"], where: { subjectId }, _count: { rating: true } });

    return rows.reduce<Record<number, number>>((accumulator, row) => {
      accumulator[row.rating] = row._count.rating;
      return accumulator;
    }, {});
  }

  // Tags are a small fixed vocabulary the client picks from, so counting them in
  // memory is cheaper than a lateral unnest and keeps the query portable.
  async tagCountsForSubject(subjectId: string) {
    const rows = await prisma.review.findMany({ where: { subjectId }, select: { tags: true } });

    const counts = new Map<string, number>();

    for (const row of rows) {
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }
}
