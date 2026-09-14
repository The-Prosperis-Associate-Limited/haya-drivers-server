import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class EnrollmentRepository {
  async findForUserAndCourse(userId: string, courseId: string) {
    return prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { module_progress: true, course: { include: { modules: { orderBy: { position: "asc" } } } } },
    });
  }

  async ensure(userId: string, courseId: string) {
    return prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
      include: { module_progress: true },
    });
  }

  async findForUser(userId: string, params: { page: number; limit: number; status?: $Enums.EnrollmentStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseEnrollmentWhereInput = { userId, ...(status && { status }) };

    const [enrollments, total] = await Promise.all([
      prisma.courseEnrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { started_at: "desc" },
        include: { course: { select: { id: true, slug: true, title: true, summary: true, cover_image: true, estimated_minutes: true } } },
      }),
      prisma.courseEnrollment.count({ where }),
    ]);

    return { enrollments, total };
  }

  async findAllForAdmin(params: { page: number; limit: number; status?: $Enums.EnrollmentStatus; search?: string }) {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseEnrollmentWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { user: { first_name: { contains: search, mode: "insensitive" as const } } },
          { user: { last_name: { contains: search, mode: "insensitive" as const } } },
          { user: { email: { contains: search, mode: "insensitive" as const } } },
          { course: { title: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    const [enrollments, total] = await Promise.all([
      prisma.courseEnrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { started_at: "desc" },
        include: {
          user: { select: { id: true, first_name: true, last_name: true, email: true, profile_pic: true } },
          course: { select: { id: true, slug: true, title: true, is_required: true, estimated_minutes: true } },
        },
      }),
      prisma.courseEnrollment.count({ where }),
    ]);

    return { enrollments, total };
  }

  async update(id: string, data: Prisma.CourseEnrollmentUncheckedUpdateInput) {
    return prisma.courseEnrollment.update({ where: { id }, data });
  }

  async upsertModuleProgress(enrollmentId: string, moduleId: string, data: { completed_at?: Date | null; minutes_spent?: number; last_position_seconds?: number; duration_seconds?: number | null }) {
    return prisma.moduleProgress.upsert({
      where: { enrollmentId_moduleId: { enrollmentId, moduleId } },
      create: { enrollmentId, moduleId, ...data },
      update: data,
    });
  }

  async findModuleProgress(enrollmentId: string, moduleId: string) {
    return prisma.moduleProgress.findUnique({ where: { enrollmentId_moduleId: { enrollmentId, moduleId } } });
  }

  async countCompletedModules(enrollmentId: string) {
    return prisma.moduleProgress.count({ where: { enrollmentId, completed_at: { not: null } } });
  }

  async sumMinutesForUser(userId: string) {
    const result = await prisma.courseEnrollment.aggregate({ where: { userId }, _sum: { minutes_spent: true } });

    return result._sum.minutes_spent ?? 0;
  }

  async countForUser(userId: string, status: $Enums.EnrollmentStatus) {
    return prisma.courseEnrollment.count({ where: { userId, status } });
  }

  async countRequiredCompletedForUser(userId: string) {
    return prisma.courseEnrollment.count({
      where: { userId, status: "COMPLETED", course: { is_required: true, status: "PUBLISHED" } },
    });
  }
}
