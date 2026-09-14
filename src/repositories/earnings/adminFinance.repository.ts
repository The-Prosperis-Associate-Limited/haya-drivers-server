import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class AdminFinanceRepository {
  async clientWalletTotals() {
    const result = await prisma.wallet.aggregate({
      where: { user: { role: "CLIENT" } },
      _sum: { available_minor: true, pending_minor: true },
    });

    return {
      available_minor: result._sum.available_minor ?? 0,
      pending_minor: result._sum.pending_minor ?? 0,
    };
  }

  async payoutTotals() {
    const [paid, failed] = await Promise.all([prisma.payout.aggregate({ where: { status: "PAID" }, _sum: { amount_minor: true }, _count: true }), prisma.payout.count({ where: { status: "FAILED" } })]);

    return { paid_minor: paid._sum.amount_minor ?? 0, paid_count: paid._count, failed_count: failed };
  }

  // Driver earnings still inside the hold window — the "awaiting release" card.
  async pendingDriverEarnings() {
    const result = await prisma.walletTransaction.aggregate({
      where: { status: "PENDING", amount_minor: { gt: 0 }, wallet: { user: { role: "DRIVER" } } },
      _sum: { amount_minor: true },
      _count: true,
    });

    return { amount_minor: result._sum.amount_minor ?? 0, count: result._count };
  }

  async findClientWallets(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.WalletWhereInput = {
      user: {
        role: "CLIENT",
        ...(search && {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { first_name: { contains: search, mode: "insensitive" as const } },
            { last_name: { contains: search, mode: "insensitive" as const } },
            { client_profile: { organisation_name: { contains: search, mode: "insensitive" as const } } },
          ],
        }),
      },
    };

    const [wallets, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              profile_pic: true,
              client_profile: { select: { client_type: true, organisation_name: true } },
            },
          },
          transactions: { where: { type: "FUNDING" }, orderBy: { createdAt: "desc" }, take: 1, select: { amount_minor: true, createdAt: true } },
        },
      }),
      prisma.wallet.count({ where }),
    ]);

    return { wallets, total };
  }

  async findServiceFees(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.WalletTransactionWhereInput = {
      type: "PLATFORM_FEE",
      ...(search && {
        OR: [{ reference: { contains: search, mode: "insensitive" as const } }, { booking: { reference: { contains: search, mode: "insensitive" as const } } }],
      }),
    };

    const [fees, total] = await Promise.all([
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
              amount: true,
              currency: true,
              engagement_type: true,
              client: { select: { id: true, first_name: true, last_name: true, client_profile: { select: { organisation_name: true } } } },
              driver: { select: { id: true, first_name: true, last_name: true, profile_pic: true } },
            },
          },
        },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { fees, total };
  }

  async serviceFeeTotals() {
    const result = await prisma.walletTransaction.aggregate({
      where: { type: "PLATFORM_FEE", status: { not: "REVERSED" } },
      _sum: { amount_minor: true },
      _count: true,
    });

    return { amount_minor: Math.abs(result._sum.amount_minor ?? 0), count: result._count };
  }
}
