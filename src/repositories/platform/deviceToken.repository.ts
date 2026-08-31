import type { $Enums } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class DeviceTokenRepository {
  // Keyed on the token, not the user: a driver can carry two phones, and a
  // device changing hands re-points its token at the new owner rather than
  // delivering their notifications to the previous one.
  async register(data: { userId: string; token: string; platform?: $Enums.DevicePlatform; deviceName?: string }) {
    return prisma.deviceToken.upsert({
      where: { token: data.token },
      create: data,
      update: { userId: data.userId, platform: data.platform, deviceName: data.deviceName, lastUsedAt: new Date() },
    });
  }

  async findForUser(userId: string) {
    return prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
  }

  async unregister(token: string) {
    return prisma.deviceToken.deleteMany({ where: { token } });
  }

  async deleteMany(tokens: string[]) {
    return prisma.deviceToken.deleteMany({ where: { token: { in: tokens } } });
  }
}
