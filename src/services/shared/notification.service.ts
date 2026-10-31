import type { $Enums, Prisma } from "../../generated/prisma/client";
import { NotificationRepository } from "../../repositories/platform/notification.repository";
import { parsePagination, paginate } from "../../utils/pagination";
import type { NotificationPreferenceInput } from "../../utils/types/notificationValidatorSchema";
import type { PreferenceKey } from "../../utils/notificationPreferences";

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
    essential?: boolean;
  }) {
    return this.notificationRepo.sendNotificationToUser({ ...data, isSystemGenerated: !data.senderId });
  }

  // Emails in a category follow the same switch as its in-app notifications.
  async wants(userId: string, key: PreferenceKey) {
    return this.notificationRepo.wants(userId, key);
  }

  async getPreferences(userId: string) {
    return this.notificationRepo.ensurePreferences(userId);
  }

  async updatePreferences(userId: string, data: NotificationPreferenceInput) {
    return this.notificationRepo.updatePreferences(userId, data);
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
