import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class ActivityRepository {
  async create(data: { userId: string; type: $Enums.ActivityType; title: string; description?: string; metadata?: Prisma.InputJsonValue }) {
    return prisma.activity.create({ data });
  }

  async findByUser(userId: string, { page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({ where: { userId }, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.activity.count({ where: { userId } }),
    ]);

    return { activities, total };
  }

  async findByUserAndTypes(userId: string, types: $Enums.ActivityType[], limit: number) {
    return prisma.activity.findMany({
      where: { userId, type: { in: types } },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  // Platform-wide, not scoped to the calling admin — admins generate almost no
  // activity of their own, so a per-user query renders an empty feed.
  async findRecentPlatformActivities(limit: number) {
    return prisma.activity.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, first_name: true, last_name: true, role: true, profile_pic: true } } },
    });
  }
}
