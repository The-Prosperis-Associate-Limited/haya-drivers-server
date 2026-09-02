import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

const bookingParties = {
  driver: { select: { id: true, first_name: true, last_name: true, profile_pic: true, phone_no: true } },
  client: { select: { id: true, first_name: true, last_name: true, profile_pic: true, phone_no: true, client_profile: { select: { organisation_name: true, client_type: true } } } },
} satisfies Prisma.BookingInclude;

/*
  The three tabs the driver app files requests under, defined once so the list
  and the summary cannot disagree about where a request belongs. CANCELLED
  splits on accepted_at: a job the driver took on that the client later called
  off is not a decline, and one that expired before they answered is not an
  acceptance.
*/
const bucketFilters = {
  open: { status: "REQUESTED" },
  accepted: {
    OR: [{ status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "DISPUTED"] } }, { status: "CANCELLED", accepted_at: { not: null } }],
  },
  declined: {
    OR: [{ status: "DECLINED" }, { status: "CANCELLED", accepted_at: null }],
  },
} satisfies Record<string, Prisma.BookingWhereInput>;

export type JobRequestBucket = keyof typeof bucketFilters;

export const JOB_REQUEST_BUCKETS = Object.keys(bucketFilters) as JobRequestBucket[];

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

  async findForDriver(driverId: string, params: { page: number; limit: number; bucket?: JobRequestBucket }) {
    const { page, limit, bucket } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { driverId, ...(bucket && bucketFilters[bucket]) };

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

  async countBucketForDriver(driverId: string, bucket: JobRequestBucket) {
    return prisma.booking.count({ where: { driverId, ...bucketFilters[bucket] } });
  }

  // A request the driver themselves moved on. A client cancellation or an expiry
  // sweep leaves both stamps null, which is what makes it miss the response rate.
  async countAnsweredForDriver(driverId: string) {
    return prisma.booking.count({
      where: { driverId, OR: [{ accepted_at: { not: null } }, { declined_at: { not: null } }] },
    });
  }

  async countClosedForDriver(driverId: string) {
    return prisma.booking.count({ where: { driverId, status: { not: "REQUESTED" } } });
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
