import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class DriverVerificationRepository {
  async findByUserId(userId: string) {
    return prisma.driverVerification.findUnique({ where: { userId } });
  }

  async upsert(userId: string, data: Prisma.DriverVerificationUncheckedUpdateInput) {
    return prisma.driverVerification.upsert({
      where: { userId },
      create: { ...(data as Prisma.DriverVerificationUncheckedCreateInput), userId },
      update: data,
    });
  }

  async submit(userId: string) {
    return prisma.driverVerification.upsert({
      where: { userId },
      create: { userId, status: "PENDING", submitted_at: new Date(), attempts: 1 },
      update: {
        status: "PENDING",
        submitted_at: new Date(),
        reviewed_at: null,
        reviewerId: null,
        rejection_reason: null,
        attempts: { increment: 1 },
      },
    });
  }

  async review(userId: string, data: { status: $Enums.DriverVerificationStatus; reviewerId: string; rejection_reason?: string | null }) {
    return prisma.driverVerification.update({
      where: { userId },
      data: { ...data, reviewed_at: new Date() },
    });
  }

  async findQueue(params: { page: number; limit: number; status?: $Enums.DriverVerificationStatus; search?: string }) {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.DriverVerificationWhereInput = { status: status ?? "PENDING" };

    if (search) {
      where.user = {
        OR: [{ first_name: { contains: search, mode: "insensitive" } }, { last_name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }],
      };
    }

    const [submissions, total] = await Promise.all([
      prisma.driverVerification.findMany({
        where,
        skip,
        take: limit,
        // Oldest submission first - the queue is a queue, not a stack.
        orderBy: { submitted_at: "asc" },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_no: true,
              profile_pic: true,
              country: true,
              state_of_residence: true,
              driver_profile: { select: { driver_type: true, years_of_experience: true, license_number: true, trust_score: true } },
              // Statuses only - the queue's "n/m verified" column counts them.
              documents: { select: { status: true } },
            },
          },
        },
      }),
      prisma.driverVerification.count({ where }),
    ]);

    return { submissions, total };
  }

  async countByStatus(status: $Enums.DriverVerificationStatus) {
    return prisma.driverVerification.count({ where: { status } });
  }
}
