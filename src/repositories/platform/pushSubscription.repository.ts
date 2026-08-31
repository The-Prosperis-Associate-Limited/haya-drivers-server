import { prisma } from "../../helper/prisma";

export class PushSubscriptionRepository {
  async upsertForUser(userId: string, data: { endpoint: string; p256dh?: string; auth?: string; expirationTime?: Date | null }) {
    return prisma.pushSubscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async findForUser(userId: string) {
    return prisma.pushSubscription.findUnique({ where: { userId } });
  }

  async deleteForUser(userId: string) {
    return prisma.pushSubscription.deleteMany({ where: { userId } });
  }
}
