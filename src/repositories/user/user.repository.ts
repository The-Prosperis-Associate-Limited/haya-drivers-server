import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class UserRepository {
  async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string, select?: Prisma.UserSelect) {
    return prisma.user.findUnique({ where: { id }, select });
  }

  async findUniqueUser(where: Prisma.UserWhereUniqueInput, select?: Prisma.UserSelect) {
    return prisma.user.findUnique({ where, select });
  }

  async findByGoogleId(googleId: string) {
    return prisma.user.findUnique({ where: { googleId } });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  }

  async incrementFailedLogin(id: string, currentAttempts: number) {
    const MAX_ATTEMPTS = 5;

    return prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
        isLocked: currentAttempts + 1 >= MAX_ATTEMPTS,
      },
      select: { id: true, isLocked: true },
    });
  }

  async resetLoginAttempts(id: string) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, isLocked: false, lastLogin: new Date() },
      select: { id: true },
    });
  }

  // Stamped on password reset. validateAccessToken refuses any token issued
  // before this instant, which is what makes "signed out everywhere" true.
  async invalidateSessions(id: string) {
    return prisma.user.update({
      where: { id },
      data: { sessions_valid_from: new Date() },
      select: { id: true },
    });
  }

  async findMany(params: { page: number; limit: number; search?: string; role?: $Enums.UserRole; status?: $Enums.AccountStatus; select?: Prisma.UserSelect }) {
    const { page, limit, search, role, status, select } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { role: role ?? { not: "ADMIN" } };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { phone_no: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) where.account_status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: select ?? {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_no: true,
          profile_pic: true,
          role: true,
          account_status: true,
          has_validated_email: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async count(where: Prisma.UserWhereInput) {
    return prisma.user.count({ where });
  }

  // Grouped in Postgres so the growth chart costs one query however long the range.
  async registrationSeries(since: Date) {
    return prisma.$queryRaw<{ day: Date; role: string; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, "role"::text AS role, COUNT(*) AS count
      FROM "User"
      WHERE "createdAt" >= ${since} AND "role" IN ('DRIVER', 'CLIENT')
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;
  }

  async deleteUser(id: string) {
    return prisma.user.delete({ where: { id }, select: { id: true } });
  }

  // Accounts that never proved their email address and have been idle since.
  // Everything they own cascades, so this is a plain delete.
  async deleteUnverifiedBefore(cutoff: Date) {
    return prisma.user.deleteMany({
      where: { has_validated_email: false, createdAt: { lt: cutoff } },
    });
  }
}
