import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class CourseRepository {
  async create(data: Prisma.CourseCreateInput) {
    return prisma.course.create({ data });
  }

  async findById(id: string) {
    return prisma.course.findUnique({ where: { id }, include: { modules: { orderBy: { position: "asc" } } } });
  }

  async findBySlug(slug: string) {
    return prisma.course.findUnique({ where: { slug }, include: { modules: { orderBy: { position: "asc" } } } });
  }

  async update(id: string, data: Prisma.CourseUpdateInput) {
    return prisma.course.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.course.delete({ where: { id }, select: { id: true } });
  }

  async adminStats() {
    const [published, drafts, archived, required] = await Promise.all([
      prisma.course.count({ where: { status: "PUBLISHED" } }),
      prisma.course.count({ where: { status: "DRAFT" } }),
      prisma.course.count({ where: { status: "ARCHIVED" } }),
      prisma.course.count({ where: { status: "PUBLISHED", is_required: true } }),
    ]);

    return { published, drafts, archived, required };
  }

  /*
    The caller's own enrollment is included so the course grid can show progress
    without a second round trip per card. Ordering is `position` first because
    the required path is meant to be read top to bottom.
  */
  async findPublished(params: { page: number; limit: number; search?: string; category?: string; userId?: string }) {
    const { page, limit, search, category, userId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {
      status: "PUBLISHED",
      ...(category && { category }),
      ...(search && { title: { contains: search, mode: "insensitive" } }),
    };

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        include: {
          _count: { select: { modules: true } },
          ...(userId && { enrollments: { where: { userId }, take: 1 } }),
        },
      }),
      prisma.course.count({ where }),
    ]);

    return { courses, total };
  }

  async findRequiredPath(userId: string) {
    return prisma.course.findMany({
      where: { status: "PUBLISHED", is_required: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { modules: true } },
        enrollments: { where: { userId }, take: 1 },
      },
    });
  }

  async countRequired() {
    return prisma.course.count({ where: { status: "PUBLISHED", is_required: true } });
  }

  async findAllForAdmin(params: { page: number; limit: number; status?: $Enums.CourseStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = status ? { status } : {};

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { modules: true, enrollments: true } } },
      }),
      prisma.course.count({ where }),
    ]);

    return { courses, total };
  }
}
