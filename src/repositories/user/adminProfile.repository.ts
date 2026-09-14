import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class AdminProfileRepository {
  async findByUserId(userId: string) {
    return prisma.adminProfile.findUnique({ where: { userId } });
  }

  async create(data: Prisma.AdminProfileUncheckedCreateInput) {
    return prisma.adminProfile.create({ data });
  }

  async updateByUserId(userId: string, data: Prisma.AdminProfileUncheckedUpdateInput) {
    return prisma.adminProfile.update({ where: { userId }, data });
  }

  // updateMany so a non-admin (no profile row) is a no-op rather than a throw.
  async clearMustChangePassword(userId: string) {
    return prisma.adminProfile.updateMany({ where: { userId }, data: { must_change_password: false } });
  }

  async touchLastActive(userId: string) {
    return prisma.adminProfile.updateMany({ where: { userId }, data: { last_active_at: new Date() } });
  }

  async listTeam(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: "ADMIN",
      ...(search && {
        OR: [{ email: { contains: search, mode: "insensitive" as const } }, { first_name: { contains: search, mode: "insensitive" as const } }, { last_name: { contains: search, mode: "insensitive" as const } }],
      }),
    };

    const [admins, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          profile_pic: true,
          account_status: true,
          lastLogin: true,
          createdAt: true,
          admin_profile: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { admins, total };
  }

  // Admins created before roles existed carry no profile and count as supers.
  async countActiveSuperAdmins(excludeUserId?: string) {
    return prisma.user.count({
      where: {
        role: "ADMIN",
        account_status: "ACTIVE",
        ...(excludeUserId && { id: { not: excludeUserId } }),
        OR: [{ admin_profile: null }, { admin_profile: { admin_role: "SUPER_ADMIN" } }],
      },
    });
  }

  async countByRole(role: $Enums.AdminRole) {
    return prisma.adminProfile.count({ where: { admin_role: role } });
  }
}
