import { SalaryPaymentRepository } from "../../repositories/booking/salaryPayment.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { isOverdue } from "../../utils/salarySchedule";
import { salaryWithParties } from "../booking/salary.service";
import { WalletService } from "../earnings/wallet.service";

const TREND_MONTHS = 12;

// Salaries are paid by the client directly, so earnings are the salary records the driver has confirmed; the wallet only holds balances from before that.
export class DriverEarningsService {
  private walletService = new WalletService();
  private salaryRepo = new SalaryPaymentRepository();
  private userRepo = new UserRepository();

  async statement(userId: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestError("Month must look like 2026-09");

    const [year, monthIndex] = month.split("-").map(Number);
    const from = new Date(Date.UTC(year, monthIndex - 1, 1));
    const to = new Date(Date.UTC(year, monthIndex, 1));

    const [rows, user] = await Promise.all([
      this.salaryRepo.findReceivedBetween(userId, from, to),
      this.userRepo.findById(userId, { first_name: true, last_name: true, email: true, state_of_residence: true }),
    ]);

    const now = new Date();
    const lines = rows.map(row => salaryWithParties(row, now));
    const received = lines.filter(line => line.status === "CONFIRMED").reduce((sum, line) => sum + line.amount_minor, 0);
    const awaiting = lines.filter(line => line.status === "PAID").reduce((sum, line) => sum + line.amount_minor, 0);

    return {
      month,
      reference: `PS-${month.replace("-", "")}-${userId.slice(-6).toUpperCase()}`,
      period_start: from,
      period_end: new Date(to.getTime() - 1),
      generated_at: now,
      currency: rows[0]?.currency ?? "NGN",
      driver: user,
      lines,
      totals: { received_minor: received, awaiting_minor: awaiting, total_minor: received + awaiting },
    };
  }

  async summary(userId: string) {
    const now = new Date();
    const [wallet, totals, due] = await Promise.all([this.walletService.getWallet(userId), this.salaryRepo.totalsByStatus(userId), this.salaryRepo.findDueForDriver(userId)]);

    const sumOf = (status: string) => totals.find(row => row.status === status)?._sum.amount_minor ?? 0;
    const countOf = (status: string) => totals.find(row => row.status === status)?._count._all ?? 0;
    const overdue = due.filter(row => isOverdue(row, now));
    const overdueMinor = overdue.reduce((sum, row) => sum + row.amount_minor, 0);

    return {
      currency: wallet.currency,
      received_minor: sumOf("CONFIRMED"),
      awaiting_confirmation_minor: sumOf("PAID"),
      awaiting_confirmation_count: countOf("PAID"),
      due_minor: sumOf("DUE") - overdueMinor,
      overdue_minor: overdueMinor,
      overdue_count: overdue.length,
      disputed_minor: sumOf("DISPUTED"),
      disputed_count: countOf("DISPUTED"),
      wallet: { available_minor: wallet.available_minor, pending_minor: wallet.pending_minor },
    };
  }

  async history(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const { rows, total } = await this.salaryRepo.findForDriver(userId, pagination);
    const now = new Date();

    return paginate(
      rows.map(row => salaryWithParties(row, now)),
      total,
      pagination,
    );
  }

  // Gaps come back as 0 so the chart's line never skips a month.
  async trend(userId: string) {
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));

    const rows = await this.salaryRepo.monthlyReceived(userId, since);

    const totals = new Map(rows.map(row => [new Date(row.month).toISOString().slice(0, 7), Number(row.total)]));

    return Array.from({ length: TREND_MONTHS }, (_, index) => {
      const month = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + index, 1));

      const key = month.toISOString().slice(0, 7);

      return { month: key, label: month.toLocaleString("en", { month: "short", timeZone: "UTC" }), total_minor: totals.get(key) ?? 0 };
    });
  }
}
