import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class CourseModuleRepository {
  async findByCourse(courseId: string) {
    return prisma.courseModule.findMany({ where: { courseId }, orderBy: { position: "asc" } });
  }

  async findById(id: string) {
    return prisma.courseModule.findUnique({ where: { id } });
  }

  async create(data: Prisma.CourseModuleUncheckedCreateInput) {
    return prisma.courseModule.create({ data });
  }

  async update(id: string, data: Prisma.CourseModuleUncheckedUpdateInput) {
    return prisma.courseModule.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.courseModule.delete({ where: { id }, select: { id: true } });
  }

  async countForCourse(courseId: string) {
    return prisma.courseModule.count({ where: { courseId } });
  }

  async nextPosition(courseId: string) {
    const last = await prisma.courseModule.findFirst({ where: { courseId }, orderBy: { position: "desc" }, select: { position: true } });

    return (last?.position ?? 0) + 1;
  }
}
