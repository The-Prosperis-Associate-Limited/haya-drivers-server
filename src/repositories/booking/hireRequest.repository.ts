import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

const DRIVER_SELECT = {
  select: {
    id: true,
    first_name: true,
    last_name: true,
    profile_pic: true,
    city: true,
    state_of_residence: true,
    driver_profile: {
      select: { driver_type: true, expected_monthly_rate: true, rate_currency: true, trust_score: true, years_of_experience: true },
    },
  },
};

const CLIENT_SELECT = {
  select: {
    id: true,
    first_name: true,
    last_name: true,
    email: true,
    client_profile: { select: { organisation_name: true, client_type: true } },
  },
};

export class HireRequestRepository {
  async create(data: Prisma.HireRequestUncheckedCreateInput) {
    return prisma.hireRequest.create({ data, include: { driver: DRIVER_SELECT, invoice: true } });
  }

  async findByReference(reference: string) {
    return prisma.hireRequest.findUnique({
      where: { reference },
      include: { driver: DRIVER_SELECT, client: CLIENT_SELECT, invoice: true, booking: { select: { id: true, reference: true, status: true } } },
    });
  }

  async findOpenForClientAndDriver(clientId: string, driverId: string) {
    return prisma.hireRequest.findFirst({
      where: { clientId, driverId, status: { in: ["PENDING_REVIEW", "INVOICED", "PAYMENT_REVIEW"] } },
      select: { id: true, reference: true },
    });
  }

  async update(id: string, data: Prisma.HireRequestUncheckedUpdateInput) {
    return prisma.hireRequest.update({
      where: { id },
      data,
      include: { driver: DRIVER_SELECT, client: CLIENT_SELECT, invoice: true, booking: { select: { id: true, reference: true, status: true } } },
    });
  }

  async listForClient(clientId: string, params: { page: number; limit: number; status?: $Enums.HireRequestStatus }) {
    const where: Prisma.HireRequestWhereInput = { clientId, ...(params.status && { status: params.status }) };

    const [requests, total] = await Promise.all([
      prisma.hireRequest.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: "desc" },
        include: { driver: DRIVER_SELECT, invoice: true },
      }),
      prisma.hireRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async listForAdmin(params: { page: number; limit: number; status?: $Enums.HireRequestStatus }) {
    const where: Prisma.HireRequestWhereInput = params.status ? { status: params.status } : {};

    const [requests, total] = await Promise.all([
      prisma.hireRequest.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: "desc" },
        include: { driver: DRIVER_SELECT, client: CLIENT_SELECT, invoice: true },
      }),
      prisma.hireRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async createInvoice(data: Prisma.HireInvoiceUncheckedCreateInput) {
    return prisma.hireInvoice.create({ data });
  }

  async updateInvoice(id: string, data: Prisma.HireInvoiceUncheckedUpdateInput) {
    return prisma.hireInvoice.update({ where: { id }, data });
  }

  async countByStatus() {
    const rows = await prisma.hireRequest.groupBy({ by: ["status"], _count: { _all: true } });

    return Object.fromEntries(rows.map(row => [row.status, row._count._all]));
  }
}
