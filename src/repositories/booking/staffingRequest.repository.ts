import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

const applicantDriver = {
  driver: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      profile_pic: true,
      city: true,
      state_of_residence: true,
      driver_profile: { select: { driver_type: true, trust_score: true, expected_monthly_rate: true, years_of_experience: true } },
    },
  },
} satisfies Prisma.RequestApplicationInclude;

export class StaffingRequestRepository {
  async create(data: Prisma.StaffingRequestUncheckedCreateInput) {
    return prisma.staffingRequest.create({ data });
  }

  async findByReference(reference: string) {
    return prisma.staffingRequest.findUnique({ where: { reference } });
  }

  async update(id: string, data: Prisma.StaffingRequestUncheckedUpdateInput) {
    return prisma.staffingRequest.update({ where: { id }, data });
  }

  async findForClient(clientId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([prisma.staffingRequest.findMany({ where: { clientId }, skip, take: limit, orderBy: { createdAt: "desc" } }), prisma.staffingRequest.count({ where: { clientId } })]);

    return { requests, total };
  }

  // A withdrawn or rejected application no longer counts as an applicant.
  async applicationCounts(requestIds: string[]) {
    if (!requestIds.length) return new Map<string, { applicants: number; shortlisted: number }>();

    const rows = await prisma.requestApplication.groupBy({
      by: ["requestId", "status"],
      where: { requestId: { in: requestIds } },
      _count: { _all: true },
    });

    const counts = new Map<string, { applicants: number; shortlisted: number }>();

    for (const row of rows) {
      const entry = counts.get(row.requestId) ?? { applicants: 0, shortlisted: 0 };
      if (row.status === "APPLIED" || row.status === "SHORTLISTED") entry.applicants += row._count._all;
      if (row.status === "SHORTLISTED") entry.shortlisted += row._count._all;
      counts.set(row.requestId, entry);
    }

    return counts;
  }

  async applicantsForRequest(requestId: string) {
    return prisma.requestApplication.findMany({
      where: { requestId, status: { in: ["APPLIED", "SHORTLISTED"] } },
      orderBy: { createdAt: "desc" },
      include: applicantDriver,
    });
  }
}
