import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";
import { notifyUser } from "../../helper/socket";
import { ExpoPushService } from "../../services/shared/expoPush.service";

const expoPush = new ExpoPushService();

export class NotificationRepository {
  // Created on first read so a driver who has never opened settings still has a
  // row to toggle, with the defaults the schema declares.
  async ensurePreferences(userId: string) {
    return prisma.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  async updatePreferences(userId: string, data: Prisma.NotificationPreferenceUncheckedUpdateInput) {
    return prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...(data as object) }, update: data });
  }

  /*
    Every notification in the platform goes through here — several services call
    the repository directly rather than via NotificationService, so the socket
    emit and the push both hang off this one method. Adding a notification
    anywhere gets both for free.
  */
  async sendNotificationToUser(data: {
    recipientId: string;
    senderId?: string;
    type: $Enums.NotificationType;
    title?: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Prisma.InputJsonValue;
    isSystemGenerated?: boolean;
  }) {
    const notification = await prisma.notification.create({ data });

    notifyUser(data.recipientId, notification);

    // Deliberately not awaited. The row exists and the socket has fired, so the
    // user can already see it — a slow Expo call must not hold up the request
    // that produced it.
    void expoPush.sendToUser(data.recipientId, {
      title: data.title ?? "TEGAT",
      body: data.message,
      data: { notificationId: notification.id, type: data.type },
    });

    return notification;
  }

  async findForUser(userId: string, params: { page: number; limit: number; status?: $Enums.NotificationStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { recipientId: userId, ...(status && { status }) };

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { recipientId: userId, status: "UNREAD" } }),
    ]);

    return { notifications, total, unread };
  }

  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { status: "READ", readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { recipientId: userId, status: "UNREAD" },
      data: { status: "READ", readAt: new Date() },
    });
  }

  async countUnread(userId: string) {
    return prisma.notification.count({ where: { recipientId: userId, status: "UNREAD" } });
  }

  async delete(id: string, userId: string) {
    return prisma.notification.deleteMany({ where: { id, recipientId: userId } });
  }
}
