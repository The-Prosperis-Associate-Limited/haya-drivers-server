import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

const bookingParties = {
  driver: { select: { id: true, first_name: true, last_name: true, profile_pic: true, phone_no: true } },
  client: { select: { id: true, first_name: true, last_name: true, profile_pic: true, phone_no: true, client_profile: { select: { organisation_name: true, client_type: true } } } },
} satisfies Prisma.BookingInclude;

export class BookingRepository {
  async create(data: Prisma.BookingUncheckedCreateInput) {
    return prisma.booking.create({ data, include: bookingParties });
  }

  async findById(id: string) {
    return prisma.booking.findUnique({ where: { id }, include: bookingParties });
  }

  async findByReference(reference: string) {
    return prisma.booking.findUnique({ where: { reference }, include: bookingParties });
  }

  async update(id: string, data: Prisma.BookingUncheckedUpdateInput) {
    return prisma.booking.update({ where: { id }, data, include: bookingParties });
  }

  async findForDriver(driverId: string, params: { page: number; limit: number; status?: $Enums.BookingStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { driverId, ...(status && { status }) };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({ where, skip, take: limit, orderBy: { starts_at: "desc" }, include: bookingParties }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  async findForClient(clientId: string, params: { page: number; limit: number; status?: $Enums.BookingStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { clientId, ...(status && { status }) };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: bookingParties }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  async findUpcomingForDriver(driverId: string, limit: number) {
    return prisma.booking.findMany({
      where: { driverId, status: { in: ["ACCEPTED", "IN_PROGRESS"] }, starts_at: { gte: new Date() } },
      take: limit,
      orderBy: { starts_at: "asc" },
      include: bookingParties,
    });
  }

  async countForDriver(driverId: string, status: $Enums.BookingStatus) {
    return prisma.booking.count({ where: { driverId, status } });
  }

  // Everything the driver actually took on, so "22 of 24 completed" has a
  // denominator that excludes requests they never accepted.
  async countEngagedForDriver(driverId: string) {
    return prisma.booking.count({
      where: { driverId, status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"] } },
    });
  }

  async countDistinctClientsForDriver(driverId: string) {
    const rows = await prisma.booking.findMany({
      where: { driverId, status: "COMPLETED" },
      distinct: ["clientId"],
      select: { clientId: true },
    });

    return rows.length;
  }

  // Requests nobody answered before the job was due to start. Left open they
  // sit in a driver dashboard forever and block the client from rebooking.
  async findStaleRequests(before: Date) {
    return prisma.booking.findMany({
      where: { status: "REQUESTED", starts_at: { lt: before } },
      include: bookingParties,
    });
  }

  async countByStatus(status: $Enums.BookingStatus) {
    return prisma.booking.count({ where: { status } });
  }
}
