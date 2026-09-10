import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class WalletTransactionRepository {
  async create(data: Prisma.WalletTransactionUncheckedCreateInput) {
    return prisma.walletTransaction.create({ data });
  }

  async findByReference(reference: string) {
    return prisma.walletTransaction.findUnique({ where: { reference } });
  }

  async existsForBooking(bookingId: string, type: $Enums.WalletTransactionType) {
    const row = await prisma.walletTransaction.findFirst({ where: { bookingId, type }, select: { id: true } });
    return !!row;
  }

  // Debits are stored negative; the caller wants a positive figure.
  async sumDebitsByType(walletId: string, type: $Enums.WalletTransactionType, since?: Date) {
    const result = await prisma.walletTransaction.aggregate({
      where: { walletId, type, amount_minor: { lt: 0 }, ...(since && { createdAt: { gte: since } }) },
      _sum: { amount_minor: true },
    });

    return Math.abs(result._sum.amount_minor ?? 0);
  }

  async findForWallet(walletId: string, params: { page: number; limit: number; status?: $Enums.WalletTransactionStatus; type?: $Enums.WalletTransactionType }) {
    const { page, limit, status, type } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.WalletTransactionWhereInput = { walletId, ...(status && { status }), ...(type && { type }) };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          booking: {
            select: {
              reference: true,
              title: true,
              client: { select: { first_name: true, last_name: true } },
              driver: { select: { first_name: true, last_name: true } },
            },
          },
        },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { transactions, total };
  }

  async sumByStatus(walletId: string, status: $Enums.WalletTransactionStatus) {
    const result = await prisma.walletTransaction.aggregate({
      where: { walletId, status },
      _sum: { amount_minor: true },
    });

    return result._sum.amount_minor ?? 0;
  }

  async sumCredits(walletId: string) {
    const result = await prisma.walletTransaction.aggregate({
      where: { walletId, amount_minor: { gt: 0 }, status: { not: "REVERSED" } },
      _sum: { amount_minor: true },
    });

    return result._sum.amount_minor ?? 0;
  }

  async markAvailable(ids: string[]) {
    return prisma.walletTransaction.updateMany({
      where: { id: { in: ids } },
      data: { status: "AVAILABLE" },
    });
  }

  async findDuePending(now: Date) {
    return prisma.walletTransaction.findMany({
      where: { status: "PENDING", available_at: { lte: now } },
      select: { id: true, walletId: true },
    });
  }

  // Monthly totals for the earnings trend chart. Grouped in Postgres rather
  // than in the service so a driver with years of history still costs one query.
  async monthlyTotals(walletId: string, since: Date) {
    return prisma.$queryRaw<{ month: Date; total: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS month, SUM("amount_minor") AS total
      FROM "WalletTransaction"
      WHERE "walletId" = ${walletId}
        AND "amount_minor" > 0
        AND "status" <> 'REVERSED'
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }
}
