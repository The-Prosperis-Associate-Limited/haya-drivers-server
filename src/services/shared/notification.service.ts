import type { $Enums, Prisma } from "../../generated/prisma/client";
import { NotificationRepository } from "../../repositories/platform/notification.repository";
import { parsePagination, paginate } from "../../utils/pagination";

export class NotificationService {
  private notificationRepo = new NotificationRepository();

  async notify(data: {
    recipientId: string;
    senderId?: string;
    type: $Enums.NotificationType;
    title?: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.notificationRepo.sendNotificationToUser({ ...data, isSystemGenerated: !data.senderId });
  }

  async list(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const status = query.status as $Enums.NotificationStatus | undefined;

    const { notifications, total, unread } = await this.notificationRepo.findForUser(userId, { ...pagination, status });

    return { ...paginate(notifications, total, pagination), unread };
  }

  async markAsRead(id: string, userId: string) {
    return this.notificationRepo.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepo.markAllAsRead(userId);
  }

  async countUnread(userId: string) {
    return this.notificationRepo.countUnread(userId);
  }

  async delete(id: string, userId: string) {
    return this.notificationRepo.delete(id, userId);
  }
}
