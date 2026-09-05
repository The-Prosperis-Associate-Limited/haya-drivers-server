import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class ClientProfileRepository {
  async create(data: Prisma.ClientProfileUncheckedCreateInput) {
    return prisma.clientProfile.create({ data });
  }

  async findByUserId(userId: string, select?: Prisma.ClientProfileSelect) {
    return prisma.clientProfile.findUnique({ where: { userId }, select });
  }

  async ensureForUser(userId: string) {
    return prisma.clientProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  async update(userId: string, data: Prisma.ClientProfileUncheckedUpdateInput) {
    return prisma.clientProfile.update({ where: { userId }, data });
  }
}
