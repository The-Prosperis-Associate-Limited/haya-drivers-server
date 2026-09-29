import { prisma } from "../../helper/prisma";

export class WalletRepository {
  async findByUserId(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  }

  async findByCustomerCode(customerCode: string) {
    return prisma.wallet.findUnique({ where: { dva_customer_code: customerCode } });
  }

  async ensureForUser(userId: string, currency = "NGN") {
    return prisma.wallet.upsert({
      where: { userId },
      create: { userId, currency },
      update: {},
    });
  }

  async writeDedicatedAccount(walletId: string, account: { dva_account_number: string; dva_account_name: string; dva_bank_name: string; dva_customer_code: string }) {
    return prisma.wallet.update({ where: { id: walletId }, data: account });
  }

  // The cached balances are rebuilt from the transaction ledger, never
  // incremented in place - a lost update cannot invent money that way.
  async writeBalances(walletId: string, balances: { available_minor: number; pending_minor: number; lifetime_minor: number }) {
    return prisma.wallet.update({ where: { id: walletId }, data: balances });
  }
}
