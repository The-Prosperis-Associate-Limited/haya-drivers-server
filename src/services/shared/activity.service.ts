import type { $Enums, Prisma } from "../../generated/prisma/client";
import { ActivityRepository } from "../../repositories/user/activity.repository";
import { parsePagination, paginate } from "../../utils/pagination";

export class ActivityService {
  private activityRepo = new ActivityRepository();

  async record(userId: string, type: $Enums.ActivityType, title: string, description?: string, metadata?: Prisma.InputJsonValue) {
    return this.activityRepo.create({ userId, type, title, description, metadata });
  }

  async listForUser(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const { activities, total } = await this.activityRepo.findByUser(userId, pagination);

    return paginate(activities, total, pagination);
  }

  async listPlatformActivities(limit = 20) {
    return this.activityRepo.findRecentPlatformActivities(limit);
  }
}
