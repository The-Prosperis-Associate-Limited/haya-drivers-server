import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class DriverProfileRepository {
  async create(data: Prisma.DriverProfileUncheckedCreateInput) {
    return prisma.driverProfile.create({ data });
  }

  async findByUserId(userId: string, select?: Prisma.DriverProfileSelect) {
    return prisma.driverProfile.findUnique({ where: { userId }, select });
  }

  async findByUserIdWithUserState(userId: string) {
    return prisma.driverProfile.findUnique({
      where: { userId },
      select: { trust_score: true, verification_status: true, user: { select: { state_of_residence: true } } },
    });
  }

  async findByUserIdWithRelations(userId: string) {
    return prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        work_experiences: { orderBy: { started_at: "desc" } },
        guarantors: { orderBy: { createdAt: "asc" } },
        reference: true,
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_no: true,
            profile_pic: true,
            bio: true,
            gender: true,
            date_of_birth: true,
            marital_status: true,
            country: true,
            state_of_residence: true,
            city: true,
            address: true,
          },
        },
      },
    });
  }

  async upsertByUserId(userId: string, data: Prisma.DriverProfileUncheckedUpdateInput) {
    return prisma.driverProfile.upsert({
      where: { userId },
      create: { ...(data as Prisma.DriverProfileUncheckedCreateInput), userId },
      update: data,
    });
  }

  async update(userId: string, data: Prisma.DriverProfileUncheckedUpdateInput) {
    return prisma.driverProfile.update({ where: { userId }, data });
  }

  async setVerificationStatus(userId: string, status: $Enums.DriverVerificationStatus) {
    // is_discoverable rides on the status: an unverified driver is never
    // surfaced to a client, and a rejected one drops out of search immediately.
    return prisma.driverProfile.update({
      where: { userId },
      data: { verification_status: status, is_discoverable: status === "APPROVED" },
      select: { id: true, userId: true, verification_status: true, is_discoverable: true },
    });
  }

  async setTrustScore(userId: string, trust_score: number) {
    return prisma.driverProfile.update({
      where: { userId },
      data: { trust_score },
      select: { userId: true, trust_score: true },
    });
  }

  async search(params: {
    page: number;
    limit: number;
    driver_type?: $Enums.DriverType;
    licence_class?: $Enums.LicenceClass;
    country?: string;
    state?: string;
    city?: string;
    budget_min?: number;
    budget_max?: number;
    min_trust_score?: number;
    search?: string;
  }) {
    const { page, limit, driver_type, licence_class, country, state, city, budget_min, budget_max, min_trust_score, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.DriverProfileWhereInput = {
      verification_status: "APPROVED",
      is_discoverable: true,
      user: { account_status: "ACTIVE" },
    };

    if (driver_type) where.driver_type = driver_type;
    if (licence_class) where.licence_classes = { has: licence_class };
    if (min_trust_score) where.trust_score = { gte: min_trust_score };
    if (country) where.user = { ...(where.user as object), country };
    if (state) where.user = { ...(where.user as object), state_of_residence: state };
    if (city) where.user = { ...(where.user as object), city: { equals: city, mode: "insensitive" } };

    if (budget_min !== undefined || budget_max !== undefined) {
      where.OR = [{ expected_monthly_rate: null }, { expected_monthly_rate: { ...(budget_min !== undefined && { gte: budget_min }), ...(budget_max !== undefined && { lte: budget_max }) } }];
    }

    if (search) {
      where.user = {
        ...(where.user as object),
        OR: [{ first_name: { contains: search, mode: "insensitive" } }, { last_name: { contains: search, mode: "insensitive" } }],
      };
    }

    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { trust_score: "desc" },
        include: {
          user: { select: { id: true, first_name: true, last_name: true, profile_pic: true, country: true, state_of_residence: true, city: true } },
        },
      }),
      prisma.driverProfile.count({ where }),
    ]);

    return { drivers, total };
  }

  async findExpiringLicences(before: Date) {
    return prisma.driverProfile.findMany({
      where: { license_expires_at: { lte: before, gte: new Date() } },
      include: { user: { select: { id: true, email: true, first_name: true } } },
    });
  }

  async findApprovedIds() {
    return prisma.driverProfile.findMany({
      where: { verification_status: "APPROVED" },
      select: { userId: true },
    });
  }

  /*
    The "more trusted than X% of drivers in Lagos" line. Scoped to approved
    drivers in the same state, because a percentile against unverified accounts
    would flatter every verified driver into the high nineties.
  */
  async trustScorePercentile(userId: string, trust_score: number, state: string | null) {
    const where: Prisma.DriverProfileWhereInput = {
      verification_status: "APPROVED",
      userId: { not: userId },
      ...(state && { user: { state_of_residence: state } }),
    };

    const [total, below] = await Promise.all([prisma.driverProfile.count({ where }), prisma.driverProfile.count({ where: { ...where, trust_score: { lt: trust_score } } })]);

    if (!total) return null;

    return Math.round((below / total) * 100);
  }

  async countByStatus(status: $Enums.DriverVerificationStatus) {
    return prisma.driverProfile.count({ where: { verification_status: status } });
  }
}
