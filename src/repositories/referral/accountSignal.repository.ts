import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class AccountSignalRepository {
  async create(data: Prisma.AccountSignalUncheckedCreateInput) {
    return prisma.accountSignal.create({ data });
  }

  async hashesForUser(userId: string, since: Date) {
    const signals = await prisma.accountSignal.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { ip_hash: true, device_hash: true },
    });

    return {
      ip: [...new Set(signals.map(signal => signal.ip_hash).filter((hash): hash is string => !!hash))],
      device: [...new Set(signals.map(signal => signal.device_hash).filter((hash): hash is string => !!hash))],
    };
  }

  async userIdsSharing(params: { ipHashes?: string[]; deviceHashes?: string[]; excludeUserIds: string[]; onlyUserIds?: string[]; since: Date }) {
    const { ipHashes = [], deviceHashes = [], excludeUserIds, onlyUserIds, since } = params;

    if (!ipHashes.length && !deviceHashes.length) return [];

    const rows = await prisma.accountSignal.findMany({
      where: {
        createdAt: { gte: since },
        userId: { notIn: excludeUserIds, ...(onlyUserIds && { in: onlyUserIds }) },
        OR: [...(ipHashes.length ? [{ ip_hash: { in: ipHashes } }] : []), ...(deviceHashes.length ? [{ device_hash: { in: deviceHashes } }] : [])],
      },
      distinct: ["userId"],
      select: { userId: true },
    });

    return rows.map(row => row.userId);
  }

  async deleteOlderThan(cutoff: Date) {
    const { count } = await prisma.accountSignal.deleteMany({ where: { createdAt: { lt: cutoff } } });

    return count;
  }
}
