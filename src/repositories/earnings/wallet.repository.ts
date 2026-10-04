import { prisma } from "../../helper/prisma";

export class WalletRepository {
  async findByUserId(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  }

  async ensureForUser(userId: string, currency = "NGN") {
    return prisma.wallet.upsert({
      where: { userId },
      create: { userId, currency },
      update: {},
    });
  }

  // The cached balances are rebuilt from the transaction ledger, never
  // incremented in place - a lost update cannot invent money that way.
  async writeBalances(walletId: string, balances: { available_minor: number; pending_minor: number; lifetime_minor: number }) {
    return prisma.wallet.update({ where: { id: walletId }, data: balances });
  }
}
