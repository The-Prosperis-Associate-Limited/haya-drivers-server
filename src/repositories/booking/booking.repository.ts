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
  active: { status: { in: ["ACCEPTED", "IN_PROGRESS", "DISPUTED"] } },
  completed: {
    OR: [{ status: "COMPLETED" }, { status: "CANCELLED", accepted_at: { not: null } }],
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

    const [bookings, total] = await Promise.all([prisma.booking.findMany({ where, skip, take: limit, orderBy: { starts_at: "desc" }, include: bookingParties }), prisma.booking.count({ where })]);

    return { bookings, total };
  }

  async findForClient(clientId: string, params: { page: number; limit: number; status?: $Enums.BookingStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { clientId, ...(status && { status }) };

    const [bookings, total] = await Promise.all([prisma.booking.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: bookingParties }), prisma.booking.count({ where })]);

    return { bookings, total };
  }

  // No date floor: a monthly job started weeks ago is still current work.
  async findUpcomingForDriver(driverId: string, limit: number) {
    return prisma.booking.findMany({
      where: { driverId, status: { in: ["ACCEPTED", "IN_PROGRESS"] } },
      take: limit,
      orderBy: [{ status: "desc" }, { starts_at: "asc" }],
      include: bookingParties,
    });
  }

  async findStartedForClient(clientId: string, take: number) {
    return prisma.booking.findMany({
      where: { clientId, started_at: { not: null } },
      select: { starts_at: true, started_at: true },
      orderBy: { starts_at: "desc" },
      take,
    });
  }

  async findStartedForDriver(driverId: string, take: number) {
    return prisma.booking.findMany({
      where: { driverId, started_at: { not: null } },
      select: { starts_at: true, started_at: true },
      orderBy: { starts_at: "desc" },
      take,
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

  async countForUser(userId: string) {
    return prisma.booking.count({ where: { OR: [{ clientId: userId }, { driverId: userId }] } });
  }

  async countOpenForUser(userId: string) {
    return prisma.booking.count({
      where: { OR: [{ clientId: userId }, { driverId: userId }], status: { in: ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "DISPUTED"] } },
    });
  }

  // What the client owes per month across active monthly hires - drives the
  // "monthly commitment" figure, never a charge.
  async sumActiveMonthlyCommitment(clientId: string) {
    const result = await prisma.booking.aggregate({
      where: { clientId, engagement_type: "MONTHLY", status: { in: ["ACCEPTED", "IN_PROGRESS"] } },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }

  // "Hired staff" is not a table - it is the client's active monthly
  // engagements, with the driver's profile alongside for the roster rows.
  async findActiveHires(clientId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      clientId,
      engagement_type: { in: ["MONTHLY", "CONTRACT"] },
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
    };

    const include = {
      driver: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          profile_pic: true,
          gender: true,
          city: true,
          state_of_residence: true,
          driver_profile: {
            select: { driver_type: true, expected_monthly_rate: true, rate_currency: true, trust_score: true },
          },
        },
      },
    } satisfies Prisma.BookingInclude;

    const [bookings, total] = await Promise.all([prisma.booking.findMany({ where, skip, take: limit, orderBy: { starts_at: "desc" }, include }), prisma.booking.count({ where })]);

    return { bookings, total };
  }
}
