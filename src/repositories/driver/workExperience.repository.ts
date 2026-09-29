import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class WorkExperienceRepository {
  async findByDriver(driverId: string) {
    return prisma.workExperience.findMany({ where: { driverId }, orderBy: { started_at: "desc" } });
  }

  async findById(id: string) {
    return prisma.workExperience.findUnique({ where: { id } });
  }

  async create(data: Prisma.WorkExperienceUncheckedCreateInput) {
    return prisma.workExperience.create({ data });
  }

  async update(id: string, data: Prisma.WorkExperienceUncheckedUpdateInput) {
    return prisma.workExperience.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.workExperience.delete({ where: { id }, select: { id: true } });
  }

  // The onboarding step submits the whole list at once, so it replaces rather
  // than merges - a role the driver removed on screen has to disappear here too.
  async replaceForDriver(driverId: string, entries: Omit<Prisma.WorkExperienceUncheckedCreateInput, "driverId">[]) {
    return prisma.$transaction([
      prisma.workExperience.deleteMany({ where: { driverId } }),
      prisma.workExperience.createMany({ data: entries.map(entry => ({ ...entry, driverId })) }),
    ]);
  }

  async countForDriver(driverId: string) {
    return prisma.workExperience.count({ where: { driverId } });
  }
}
