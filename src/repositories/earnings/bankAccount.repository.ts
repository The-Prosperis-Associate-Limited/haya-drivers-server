import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class BankAccountRepository {
  async findForUser(userId: string) {
    return prisma.bankAccount.findMany({ where: { userId }, orderBy: [{ is_default: "desc" }, { createdAt: "desc" }] });
  }

  async findById(id: string) {
    return prisma.bankAccount.findUnique({ where: { id } });
  }

  async findDefaultForUser(userId: string) {
    return prisma.bankAccount.findFirst({ where: { userId, is_default: true } });
  }

  async create(data: Prisma.BankAccountUncheckedCreateInput) {
    return prisma.bankAccount.create({ data });
  }

  async update(id: string, data: Prisma.BankAccountUncheckedUpdateInput) {
    return prisma.bankAccount.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.bankAccount.delete({ where: { id }, select: { id: true } });
  }

  // One default per user, so promoting an account demotes the rest in the same
  // transaction rather than leaving two rows both claiming to be default.
  async setDefault(userId: string, id: string) {
    return prisma.$transaction([
      prisma.bankAccount.updateMany({ where: { userId }, data: { is_default: false } }),
      prisma.bankAccount.update({ where: { id }, data: { is_default: true } }),
    ]);
  }

  async countForUser(userId: string) {
    return prisma.bankAccount.count({ where: { userId } });
  }
}
