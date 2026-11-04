import { prisma } from "../../helper/prisma";

export class AdminFinanceRepository {
  async payoutTotals() {
    const [paid, failed] = await Promise.all([prisma.payout.aggregate({ where: { status: "PAID" }, _sum: { amount_minor: true }, _count: true }), prisma.payout.count({ where: { status: "FAILED" } })]);

    return { paid_minor: paid._sum.amount_minor ?? 0, paid_count: paid._count, failed_count: failed };
  }

  async payoutsToSend() {
    const result = await prisma.payout.aggregate({ where: { status: { in: ["REQUESTED", "PROCESSING"] } }, _sum: { amount_minor: true }, _count: true });

    return { amount_minor: result._sum.amount_minor ?? 0, count: result._count };
  }
}
