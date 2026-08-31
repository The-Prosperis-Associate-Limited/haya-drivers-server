import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class DriverDocumentRepository {
  async findByUser(userId: string) {
    return prisma.driverDocument.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  }

  async findById(id: string) {
    return prisma.driverDocument.findUnique({ where: { id } });
  }

  async findByUserAndType(userId: string, type: $Enums.DocumentType) {
    return prisma.driverDocument.findUnique({ where: { userId_type: { userId, type } } });
  }

  // A re-upload replaces the existing row for that type, so a rejected licence
  // never sits in the queue beside its own replacement.
  async upsert(userId: string, type: $Enums.DocumentType, data: Omit<Prisma.DriverDocumentUncheckedCreateInput, "userId" | "type">) {
    return prisma.driverDocument.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, ...data },
      update: { ...data, status: "PENDING", rejection_reason: null, reviewerId: null, reviewed_at: null },
    });
  }

  async delete(id: string) {
    return prisma.driverDocument.delete({ where: { id }, select: { id: true, public_id: true } });
  }

  async review(id: string, data: { status: $Enums.DocumentStatus; rejection_reason?: string | null; reviewerId: string }) {
    return prisma.driverDocument.update({
      where: { id },
      data: { ...data, reviewed_at: new Date() },
    });
  }

  async findRejectedForUser(userId: string) {
    return prisma.driverDocument.findMany({ where: { userId, status: "REJECTED" } });
  }

  async countByStatusForUser(userId: string, status: $Enums.DocumentStatus) {
    return prisma.driverDocument.count({ where: { userId, status } });
  }

  async markAllPendingForUser(userId: string) {
    return prisma.driverDocument.updateMany({
      where: { userId },
      data: { status: "PENDING", rejection_reason: null, reviewerId: null, reviewed_at: null },
    });
  }
}
