import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class PayoutRepository {
  async create(data: Prisma.PayoutUncheckedCreateInput) {
    return prisma.payout.create({ data, include: { bankAccount: true } });
  }

  async findById(id: string) {
    return prisma.payout.findUnique({ where: { id }, include: { bankAccount: true, user: { select: { id: true, email: true, first_name: true } } } });
  }

  async findByReference(reference: string) {
    return prisma.payout.findUnique({ where: { reference }, include: { bankAccount: true, user: { select: { id: true, email: true, first_name: true } } } });
  }

  async update(id: string, data: Prisma.PayoutUncheckedUpdateInput) {
    return prisma.payout.update({ where: { id }, data, include: { bankAccount: true } });
  }

  async findForUser(userId: string, params: { page: number; limit: number; status?: $Enums.PayoutStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutWhereInput = { userId, ...(status && { status }) };

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { bankAccount: true } }),
      prisma.payout.count({ where }),
    ]);

    return { payouts, total };
  }

  async hasOpenPayout(userId: string) {
    const open = await prisma.payout.count({ where: { userId, status: { in: ["REQUESTED", "PROCESSING"] } } });

    return open > 0;
  }

  async findQueue(params: { page: number; limit: number; status?: $Enums.PayoutStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutWhereInput = { status: status ?? "REQUESTED" };

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
        include: { bankAccount: true, user: { select: { id: true, first_name: true, last_name: true, email: true } } },
      }),
      prisma.payout.count({ where }),
    ]);

    return { payouts, total };
  }
}
