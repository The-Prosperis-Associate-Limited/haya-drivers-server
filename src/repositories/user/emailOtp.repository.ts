import type { $Enums } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class EmailOtpRepository {
  async create(data: { userId: string; purpose: $Enums.EmailOtpPurpose; codeHash: string; expiresAt: Date }) {
    return prisma.emailOtp.create({ data });
  }

  // The newest code wins. Older ones are consumed on issue rather than deleted,
  // so a resend cannot be used to reset a burnt attempt counter.
  async findLatestActive(userId: string, purpose: $Enums.EmailOtpPurpose) {
    return prisma.emailOtp.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async findLatest(userId: string, purpose: $Enums.EmailOtpPurpose) {
    return prisma.emailOtp.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: "desc" },
    });
  }

  async consumeAllFor(userId: string, purpose: $Enums.EmailOtpPurpose) {
    return prisma.emailOtp.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async incrementAttempts(id: string) {
    return prisma.emailOtp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { id: true, attempts: true },
    });
  }

  async markConsumed(id: string) {
    return prisma.emailOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
      select: { id: true },
    });
  }

  async deleteExpiredBefore(cutoff: Date) {
    return prisma.emailOtp.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  }
}
