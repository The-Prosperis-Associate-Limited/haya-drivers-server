import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class AttendanceRepository {
  async create(data: Prisma.AttendanceUncheckedCreateInput) {
    return prisma.attendance.create({ data });
  }

  async findForDay(bookingId: string, workDate: Date) {
    return prisma.attendance.findUnique({ where: { bookingId_work_date: { bookingId, work_date: workDate } } });
  }

  async findById(id: string) {
    return prisma.attendance.findUnique({ where: { id } });
  }

  async findOpenForDriver(driverId: string, since: Date) {
    return prisma.attendance.findFirst({
      where: { driverId, checked_out_at: null, checked_in_at: { gt: since } },
      orderBy: { checked_in_at: "desc" },
      include: { booking: { select: { reference: true, title: true } } },
    });
  }

  async findOpenForBooking(bookingId: string, since: Date) {
    return prisma.attendance.findFirst({
      where: { bookingId, checked_out_at: null, checked_in_at: { gt: since } },
      orderBy: { checked_in_at: "desc" },
    });
  }

  async update(id: string, data: Prisma.AttendanceUncheckedUpdateInput) {
    return prisma.attendance.update({ where: { id }, data });
  }

  async findForMonth(bookingId: string, from: Date, to: Date) {
    return prisma.attendance.findMany({
      where: { bookingId, work_date: { gte: from, lt: to } },
      orderBy: { work_date: "desc" },
    });
  }

  async findFirstDay(bookingId: string) {
    const first = await prisma.attendance.findFirst({ where: { bookingId }, orderBy: { work_date: "asc" }, select: { work_date: true } });
    return first?.work_date ?? null;
  }

  async latestForBookings(bookingIds: string[]) {
    if (!bookingIds.length) return [];

    return prisma.attendance.findMany({
      where: { bookingId: { in: bookingIds } },
      orderBy: [{ bookingId: "asc" }, { work_date: "desc" }],
      distinct: ["bookingId"],
    });
  }

  async findFlags(status: "open" | "resolved", params: { page: number; limit: number }) {
    const where = { flagged_at: { not: null }, flag_resolved_at: status === "open" ? null : { not: null } };
    const person = { select: { id: true, first_name: true, last_name: true, profile_pic: true } };

    const [rows, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: status === "open" ? { flagged_at: "asc" } : { flag_resolved_at: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          booking: {
            select: {
              reference: true,
              title: true,
              resumption_time: true,
              closing_time: true,
              driver: person,
              client: { select: { ...person.select, client_profile: { select: { organisation_name: true } } } },
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return { rows, total };
  }

  async countFlags() {
    const [open, resolved] = await Promise.all([
      prisma.attendance.count({ where: { flagged_at: { not: null }, flag_resolved_at: null } }),
      prisma.attendance.count({ where: { flagged_at: { not: null }, flag_resolved_at: { not: null } } }),
    ]);

    return { open, resolved };
  }

  async findTimedCheckIns(scope: { driverId: string } | { clientId: string }, take: number) {
    return prisma.attendance.findMany({
      where: {
        OR: [{ minutes_late: { not: null } }, { flag_resolution: "UPHELD" }],
        ...("driverId" in scope ? { driverId: scope.driverId } : { booking: { clientId: scope.clientId } }),
      },
      select: { checked_in_at: true, minutes_late: true, flag_resolution: true },
      orderBy: { checked_in_at: "desc" },
      take,
    });
  }

  async countOnDutyForClient(clientId: string, since: Date) {
    return prisma.attendance.count({
      where: { checked_out_at: null, checked_in_at: { gt: since }, booking: { clientId, status: "IN_PROGRESS" } },
    });
  }
}
