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

const OPEN_STATUSES: $Enums.HireRequestStatus[] = ["PENDING_REVIEW", "INVOICED", "PAYMENT_REVIEW"];

const ASSIGNMENTS_INCLUDE = {
  include: { driver: DRIVER_SELECT },
  orderBy: { createdAt: "asc" as const },
};

export class HireRequestRepository {
  async create(data: Prisma.HireRequestUncheckedCreateInput) {
    return prisma.hireRequest.create({ data, include: { driver: DRIVER_SELECT, assignments: ASSIGNMENTS_INCLUDE, invoice: true } });
  }

  async findByReference(reference: string) {
    return prisma.hireRequest.findUnique({
      where: { reference },
      include: { driver: DRIVER_SELECT, assignments: ASSIGNMENTS_INCLUDE, client: CLIENT_SELECT, invoice: true, booking: { select: { id: true, reference: true, status: true } } },
    });
  }

  async findOpenForClientAndDriver(clientId: string, driverId: string) {
    return prisma.hireRequest.findFirst({
      where: {
        clientId,
        status: { in: ["PENDING_REVIEW", "INVOICED", "PAYMENT_REVIEW"] },
        OR: [{ driverId }, { assignments: { some: { driverId } } }],
      },
      select: { id: true, reference: true },
    });
  }

  async addAssignment(hireRequestId: string, driverId: string, respondBy: Date) {
    return prisma.hireAssignment.create({ data: { hireRequestId, driverId, respond_by: respondBy } });
  }

  // Only requests still being shortlisted - once invoiced, the crew is settled and nothing should flip.
  async findOverdueAssignments(now: Date) {
    return prisma.hireAssignment.findMany({
      where: { status: "PENDING", respond_by: { lt: now }, hire_request: { status: "PENDING_REVIEW" } },
      select: { id: true, driverId: true, hire_request: { select: { reference: true } } },
    });
  }

  async expireAssignments(ids: string[], now: Date) {
    return prisma.hireAssignment.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "DECLINED", responded_at: now, expired_at: now },
    });
  }

  async removeAssignment(hireRequestId: string, driverId: string) {
    return prisma.hireAssignment.deleteMany({ where: { hireRequestId, driverId } });
  }

  async findAssignmentById(id: string) {
    return prisma.hireAssignment.findUnique({
      where: { id },
      include: { hire_request: { select: { id: true, reference: true, status: true, clientId: true } } },
    });
  }

  async respondToAssignment(id: string, status: "CONFIRMED" | "DECLINED") {
    return prisma.hireAssignment.update({ where: { id }, data: { status, responded_at: new Date() } });
  }

  // The driver-facing shortlist: engagement facts only, never the client.
  async findPendingAssignmentsForDriver(driverId: string) {
    return prisma.hireAssignment.findMany({
      where: {
        driverId,
        status: "PENDING",
        hire_request: { status: "PENDING_REVIEW" },
        OR: [{ respond_by: null }, { respond_by: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        hire_request: {
          select: {
            reference: true,
            engagement_type: true,
            starts_at: true,
            schedule: true,
            resumption_time: true,
            closing_time: true,
            transmission: true,
            driver_type: true,
            duration_months: true,
            provides_accommodation: true,
            state: true,
            nearest_area: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.HireRequestUncheckedUpdateInput) {
    return prisma.hireRequest.update({
      where: { id },
      data,
      include: { driver: DRIVER_SELECT, assignments: ASSIGNMENTS_INCLUDE, client: CLIENT_SELECT, invoice: true, booking: { select: { id: true, reference: true, status: true } } },
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
        include: { driver: DRIVER_SELECT, assignments: ASSIGNMENTS_INCLUDE, invoice: true },
      }),
      prisma.hireRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async listForAdmin(params: { page: number; limit: number; status?: $Enums.HireRequestStatus; q?: string }) {
    const match = params.q ? { contains: params.q, mode: "insensitive" as const } : undefined;
    const where: Prisma.HireRequestWhereInput = {
      ...(params.status && { status: params.status }),
      ...(match && {
        OR: [
          { reference: match },
          { invoice: { reference: match } },
          { client: { OR: [{ first_name: match }, { last_name: match }, { email: match }, { client_profile: { organisation_name: match } }] } },
        ],
      }),
    };

    const [requests, total] = await Promise.all([
      prisma.hireRequest.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: "desc" },
        include: { driver: DRIVER_SELECT, assignments: ASSIGNMENTS_INCLUDE, client: CLIENT_SELECT, invoice: true },
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

  async countOpenForUser(userId: string) {
    return prisma.hireRequest.count({
      where: {
        status: { in: ["PENDING_REVIEW", "INVOICED", "PAYMENT_REVIEW"] },
        OR: [{ clientId: userId }, { driverId: userId }, { assignments: { some: { driverId: userId } } }],
      },
    });
  }

  async countByStatus() {
    const rows = await prisma.hireRequest.groupBy({ by: ["status"], _count: { _all: true } });

    return Object.fromEntries(rows.map(row => [row.status, row._count._all]));
  }

  async listOpenForClient(clientId: string, take: number) {
    return prisma.hireRequest.findMany({
      where: { clientId, status: { in: OPEN_STATUSES } },
      take,
      orderBy: { createdAt: "desc" },
      include: {
        assignments: { select: { status: true } },
        invoice: { select: { status: true, total_minor: true, currency: true, proof_rejected_reason: true } },
      },
    });
  }

  async countOpenForClient(clientId: string) {
    return prisma.hireRequest.count({ where: { clientId, status: { in: OPEN_STATUSES } } });
  }

  // INVOICED sorts before PAYMENT_REVIEW in the enum, so an invoice still waiting on the client wins.
  async findInvoiceDueForClient(clientId: string) {
    return prisma.hireRequest.findFirst({
      where: { clientId, status: { in: ["INVOICED", "PAYMENT_REVIEW"] }, invoice: { isNot: null } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: {
        reference: true,
        status: true,
        drivers_needed: true,
        driver_type: true,
        invoice: {
          select: {
            reference: true,
            status: true,
            amount_minor: true,
            per_driver_minor: true,
            vat_percent: true,
            vat_minor: true,
            fee_minor: true,
            total_minor: true,
            breakdown: true,
            currency: true,
            proof_submitted_at: true,
            proof_rejected_reason: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async sumPaidInvoicesForClient(clientId: string, from: Date, to?: Date) {
    const result = await prisma.hireInvoice.aggregate({
      where: { status: "PAID", hire_request: { clientId }, paid_at: { gte: from, ...(to && { lt: to }) } },
      _sum: { total_minor: true },
    });

    return result._sum.total_minor ?? 0;
  }

  async recentPaidInvoicesForClient(clientId: string, take: number) {
    return prisma.hireInvoice.findMany({
      where: { status: "PAID", hire_request: { clientId } },
      take,
      orderBy: { paid_at: "desc" },
      select: {
        id: true,
        reference: true,
        total_minor: true,
        currency: true,
        paid_at: true,
        hire_request: { select: { reference: true, drivers_needed: true, driver_type: true } },
      },
    });
  }

  async listInvoicesForClient(clientId: string, params: { page: number; limit: number; status?: $Enums.HireInvoiceStatus }) {
    const where: Prisma.HireInvoiceWhereInput = { hire_request: { clientId }, ...(params.status && { status: params.status }) };

    const [invoices, total] = await Promise.all([
      prisma.hireInvoice.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          total_minor: true,
          currency: true,
          paid_at: true,
          proof_submitted_at: true,
          proof_rejected_reason: true,
          createdAt: true,
          hire_request: { select: { reference: true, status: true, drivers_needed: true, driver_type: true, engagement_type: true, starts_at: true } },
        },
      }),
      prisma.hireInvoice.count({ where }),
    ]);

    return { invoices, total };
  }

  async invoiceTotalsForClient(clientId: string) {
    const groups = await prisma.hireInvoice.groupBy({
      by: ["status"],
      where: { hire_request: { clientId } },
      _sum: { total_minor: true },
      _count: { _all: true },
    });

    return groups.map(group => ({ status: group.status, total_minor: group._sum.total_minor ?? 0, count: group._count._all }));
  }
}
