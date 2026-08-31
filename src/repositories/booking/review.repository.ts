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
        include: { author: { select: { id: true, first_name: true, last_name: true, profile_pic: true } } },
      }),
      prisma.review.count({ where: { subjectId } }),
    ]);

    return { reviews, total };
  }

  async summaryForSubject(subjectId: string) {
    const [aggregate, total] = await Promise.all([
      prisma.review.aggregate({ where: { subjectId }, _avg: { rating: true } }),
      prisma.review.count({ where: { subjectId } }),
    ]);

    return { average: aggregate._avg.rating ?? 0, total };
  }
}
