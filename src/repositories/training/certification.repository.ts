import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class CertificationRepository {
  async create(data: Prisma.CertificationUncheckedCreateInput) {
    return prisma.certification.create({ data, include: { course: { select: { title: true } } } });
  }

  async findForUser(userId: string) {
    return prisma.certification.findMany({
      where: { userId },
      orderBy: { issued_at: "desc" },
      include: { course: { select: { id: true, title: true, slug: true } } },
    });
  }

  // One query for a page of search results — the marketplace cards each carry
  // certification chips.
  async titlesForUsers(userIds: string[]) {
    if (!userIds.length) return new Map<string, string[]>();

    const rows = await prisma.certification.findMany({
      where: { userId: { in: userIds } },
      orderBy: { issued_at: "desc" },
      select: { userId: true, course: { select: { title: true } } },
    });

    const map = new Map<string, string[]>();

    for (const row of rows) {
      map.set(row.userId, [...(map.get(row.userId) ?? []), row.course.title]);
    }

    return map;
  }

  async findForUserAndCourse(userId: string, courseId: string) {
    return prisma.certification.findUnique({ where: { userId_courseId: { userId, courseId } } });
  }

  async countForUser(userId: string) {
    return prisma.certification.count({ where: { userId } });
  }

  async findExpiringBefore(before: Date) {
    return prisma.certification.findMany({
      where: { expires_at: { lte: before, gte: new Date() } },
      include: { user: { select: { id: true, email: true, first_name: true } }, course: { select: { title: true } } },
    });
  }
}
