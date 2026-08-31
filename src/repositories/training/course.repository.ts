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

  async findPublished(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {
      status: "PUBLISHED",
      ...(search && { title: { contains: search, mode: "insensitive" } }),
    };

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { modules: true } } },
      }),
      prisma.course.count({ where }),
    ]);

    return { courses, total };
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
