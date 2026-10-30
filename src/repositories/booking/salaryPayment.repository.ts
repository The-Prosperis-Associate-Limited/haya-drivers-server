import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

const person = { select: { id: true, first_name: true, last_name: true, profile_pic: true } } as const;

const withBooking = {
  booking: {
    select: {
      id: true,
      reference: true,
      title: true,
      engagement_type: true,
      starts_at: true,
      ends_at: true,
      driver: person,
      client: { select: { ...person.select, client_profile: { select: { organisation_name: true } } } },
    },
  },
} satisfies Prisma.SalaryPaymentInclude;

export type SalaryPaymentWithBooking = Prisma.SalaryPaymentGetPayload<{ include: typeof withBooking }>;

export type AdminSalaryFilter = "disputed" | "overdue" | "awaiting" | "all";

export class SalaryPaymentRepository {
  async createMany(data: Prisma.SalaryPaymentCreateManyInput[]) {
    if (!data.length) return;

    await prisma.salaryPayment.createMany({ data, skipDuplicates: true });
  }

  async findById(id: string) {
    return prisma.salaryPayment.findUnique({ where: { id }, include: withBooking });
  }

  async findForBooking(bookingId: string) {
    return prisma.salaryPayment.findMany({ where: { bookingId }, orderBy: { period_start: "desc" } });
  }

  async update(id: string, data: Prisma.SalaryPaymentUncheckedUpdateInput) {
    return prisma.salaryPayment.update({ where: { id }, data, include: withBooking });
  }

  async deleteMany(ids: string[]) {
    if (!ids.length) return;

    await prisma.salaryPayment.deleteMany({ where: { id: { in: ids }, status: "DUE" } });
  }

  async findOverdueToRemind(dueBefore: Date, remindedBefore: Date) {
    return prisma.salaryPayment.findMany({
      where: { status: "DUE", due_at: { lt: dueBefore }, OR: [{ last_reminded_at: null }, { last_reminded_at: { lt: remindedBefore } }] },
      include: withBooking,
      take: 500,
    });
  }

  async markReminded(ids: string[], at: Date) {
    await prisma.salaryPayment.updateMany({ where: { id: { in: ids } }, data: { last_reminded_at: at } });
  }

  async findForDriver(driverId: string, params: { page: number; limit: number }) {
    const where: Prisma.SalaryPaymentWhereInput = { driverId };

    const [rows, total] = await Promise.all([
      prisma.salaryPayment.findMany({ where, skip: (params.page - 1) * params.limit, take: params.limit, orderBy: [{ period_start: "desc" }, { createdAt: "desc" }], include: withBooking }),
      prisma.salaryPayment.count({ where }),
    ]);

    return { rows, total };
  }

  async findReceivedBetween(driverId: string, from: Date, to: Date) {
    return prisma.salaryPayment.findMany({
      where: { driverId, status: { in: ["PAID", "CONFIRMED"] }, paid_at: { gte: from, lt: to } },
      orderBy: { paid_at: "asc" },
      include: withBooking,
    });
  }

  async totalsByStatus(driverId: string) {
    return prisma.salaryPayment.groupBy({ by: ["status"], where: { driverId }, _sum: { amount_minor: true }, _count: { _all: true } });
  }

  async findDueForDriver(driverId: string) {
    return prisma.salaryPayment.findMany({ where: { driverId, status: "DUE" }, select: { amount_minor: true, due_at: true, status: true } });
  }

  async monthlyReceived(driverId: string, since: Date) {
    return prisma.$queryRaw<{ month: Date; total: bigint }[]>`
      SELECT date_trunc('month', "paid_at") AS month, SUM("amount_minor")::bigint AS total
      FROM "SalaryPayment"
      WHERE "driverId" = ${driverId} AND "status" = 'CONFIRMED' AND "paid_at" >= ${since}
      GROUP BY 1
    `;
  }

  async findForAdmin(filter: AdminSalaryFilter, overdueBefore: Date, params: { page: number; limit: number }) {
    const where = adminWhere(filter, overdueBefore);

    const [rows, total] = await Promise.all([
      prisma.salaryPayment.findMany({ where, skip: (params.page - 1) * params.limit, take: params.limit, orderBy: [{ due_at: "asc" }, { createdAt: "asc" }], include: withBooking }),
      prisma.salaryPayment.count({ where }),
    ]);

    return { rows, total };
  }

  async countForAdmin(overdueBefore: Date) {
    const [disputed, overdue, awaiting] = await Promise.all([
      prisma.salaryPayment.count({ where: adminWhere("disputed", overdueBefore) }),
      prisma.salaryPayment.count({ where: adminWhere("overdue", overdueBefore) }),
      prisma.salaryPayment.count({ where: adminWhere("awaiting", overdueBefore) }),
    ]);

    return { disputed, overdue, awaiting };
  }

  async countByStatusForClient(clientId: string, status: $Enums.SalaryPaymentStatus, dueBefore?: Date) {
    return prisma.salaryPayment.count({ where: { clientId, status, ...(dueBefore && { due_at: { lt: dueBefore } }) } });
  }
}

const adminWhere = (filter: AdminSalaryFilter, overdueBefore: Date): Prisma.SalaryPaymentWhereInput => {
  if (filter === "disputed") return { status: "DISPUTED" };
  if (filter === "overdue") return { status: "DUE", due_at: { lt: overdueBefore } };
  if (filter === "awaiting") return { status: "PAID" };

  return {};
};
