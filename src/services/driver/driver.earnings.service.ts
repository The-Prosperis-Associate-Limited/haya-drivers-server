import type { $Enums } from "../../generated/prisma/client";
import { BankAccountRepository } from "../../repositories/earnings/bankAccount.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { WalletService } from "../earnings/wallet.service";

const TREND_MONTHS = 12;

export class DriverEarningsService {
  private walletService = new WalletService();
  private transactionRepo = new WalletTransactionRepository();
  private bankAccountRepo = new BankAccountRepository();
  private userRepo = new UserRepository();

  // One UTC month of the ledger as a payslip: every line, what was earned, what left, what is held.
  async statement(userId: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestError("Month must look like 2026-09");

    const [year, monthIndex] = month.split("-").map(Number);
    const from = new Date(Date.UTC(year, monthIndex - 1, 1));
    const to = new Date(Date.UTC(year, monthIndex, 1));

    const wallet = await this.walletService.getWallet(userId);

    const [transactions, user, bank] = await Promise.all([
      this.transactionRepo.findForWalletBetween(wallet.id, from, to),
      this.userRepo.findById(userId, { first_name: true, last_name: true, email: true, state_of_residence: true }),
      this.bankAccountRepo.findDefaultForUser(userId),
    ]);

    const live = transactions.filter(transaction => transaction.status !== "REVERSED");
    const earned = live.filter(transaction => transaction.amount_minor > 0).reduce((sum, transaction) => sum + transaction.amount_minor, 0);
    const deducted = live.filter(transaction => transaction.amount_minor < 0).reduce((sum, transaction) => sum + transaction.amount_minor, 0);
    const onHold = live.filter(transaction => transaction.status === "PENDING" && transaction.amount_minor > 0).reduce((sum, transaction) => sum + transaction.amount_minor, 0);

    return {
      month,
      reference: `PS-${month.replace("-", "")}-${userId.slice(-6).toUpperCase()}`,
      period_start: from,
      period_end: new Date(to.getTime() - 1),
      generated_at: new Date(),
      currency: wallet.currency,
      driver: user,
      payout_account: bank ? { bank_name: bank.bank_name, account_name: bank.account_name, account_number_last4: bank.account_number.slice(-4) } : null,
      lines: transactions.map(transaction => ({
        id: transaction.id,
        reference: transaction.reference,
        type: transaction.type,
        status: transaction.status,
        description: transaction.description,
        amount_minor: transaction.amount_minor,
        createdAt: transaction.createdAt,
        booking: transaction.booking,
      })),
      totals: { earned_minor: earned, deducted_minor: deducted, net_minor: earned + deducted, on_hold_minor: onHold },
    };
  }

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
    a month with no work has to come back as 0 rather than be missing - leaving
    it out would make the line skip that month entirely.
  */
  async trend(userId: string) {
    const wallet = await this.walletService.getWallet(userId);

    // date_trunc buckets by UTC month; local-time keys shift every bar a month east of Greenwich.
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));

    const rows = await this.transactionRepo.monthlyTotals(wallet.id, since);

    const totals = new Map(rows.map(row => [new Date(row.month).toISOString().slice(0, 7), Number(row.total)]));

    return Array.from({ length: TREND_MONTHS }, (_, index) => {
      const month = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + index, 1));

      const key = month.toISOString().slice(0, 7);

      return { month: key, label: month.toLocaleString("en", { month: "short", timeZone: "UTC" }), total_minor: totals.get(key) ?? 0 };
    });
  }
}
