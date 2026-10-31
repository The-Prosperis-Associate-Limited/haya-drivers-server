import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class GuarantorRepository {
  async findByDriver(driverId: string) {
    return prisma.guarantor.findMany({ where: { driverId }, orderBy: { createdAt: "asc" } });
  }

  async findForUsers(userIds: string[]) {
    return prisma.guarantor.findMany({ where: { driver: { userId: { in: userIds } } }, select: { phone_no: true, nin: true, driver: { select: { userId: true } } } });
  }

  async findById(id: string) {
    return prisma.guarantor.findUnique({ where: { id } });
  }

  async create(data: Prisma.GuarantorUncheckedCreateInput) {
    return prisma.guarantor.create({ data });
  }

  async update(id: string, data: Prisma.GuarantorUncheckedUpdateInput) {
    return prisma.guarantor.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.guarantor.delete({ where: { id }, select: { id: true } });
  }

  async replaceForDriver(driverId: string, entries: Omit<Prisma.GuarantorUncheckedCreateInput, "driverId">[]) {
    return prisma.$transaction([prisma.guarantor.deleteMany({ where: { driverId } }), prisma.guarantor.createMany({ data: entries.map(entry => ({ ...entry, driverId })) })]);
  }

  async countForDriver(driverId: string) {
    return prisma.guarantor.count({ where: { driverId } });
  }

  async findReferenceByDriver(driverId: string) {
    return prisma.reference.findUnique({ where: { driverId } });
  }

  async upsertReferenceForDriver(driverId: string, data: Omit<Prisma.ReferenceUncheckedCreateInput, "driverId" | "id">) {
    return prisma.reference.upsert({
      where: { driverId },
      create: { ...data, driverId },
      update: data,
    });
  }
}
