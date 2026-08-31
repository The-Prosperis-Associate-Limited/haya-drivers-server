import type { $Enums } from "../../generated/prisma/client";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { paginate, parsePagination } from "../../utils/pagination";
import { WalletService } from "../earnings/wallet.service";

const TREND_MONTHS = 12;

export class DriverEarningsService {
  private walletService = new WalletService();
  private transactionRepo = new WalletTransactionRepository();

  async summary(userId: string) {
    const wallet = await this.walletService.getWallet(userId);

    return {
      currency: wallet.currency,
      total_earnings_minor: wallet.lifetime_minor,
      available_minor: wallet.available_minor,
      pending_minor: wallet.pending_minor,
    };
  }

  async history(userId: string, query: Record<string, unknown>) {
    const wallet = await this.walletService.getWallet(userId);
    const pagination = parsePagination(query);

    const { transactions, total } = await this.transactionRepo.findForWallet(wallet.id, {
      ...pagination,
      status: query.status as $Enums.WalletTransactionStatus | undefined,
      type: query.type as $Enums.WalletTransactionType | undefined,
    });

    return paginate(transactions, total, pagination);
  }

  /*
    Twelve months, gaps filled with zero. The chart draws a continuous line, so
    a month with no work has to come back as 0 rather than be missing — leaving
    it out would make the line skip that month entirely.
  */
  async trend(userId: string) {
    const wallet = await this.walletService.getWallet(userId);

    const since = new Date();
    since.setMonth(since.getMonth() - (TREND_MONTHS - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.transactionRepo.monthlyTotals(wallet.id, since);

    const totals = new Map(rows.map(row => [new Date(row.month).toISOString().slice(0, 7), Number(row.total)]));

    return Array.from({ length: TREND_MONTHS }, (_, index) => {
      const month = new Date(since);
      month.setMonth(since.getMonth() + index);

      const key = month.toISOString().slice(0, 7);

      return { month: key, label: month.toLocaleString("en", { month: "short" }), total_minor: totals.get(key) ?? 0 };
    });
  }
}
