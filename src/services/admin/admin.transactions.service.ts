import { AdminFinanceRepository } from "../../repositories/earnings/adminFinance.repository";

export class AdminTransactionsService {
  private financeRepo = new AdminFinanceRepository();

  async stats() {
    const [payouts, pendingEarnings] = await Promise.all([this.financeRepo.payoutTotals(), this.financeRepo.pendingDriverEarnings()]);

    return {
      paid_to_drivers_minor: payouts.paid_minor,
      paid_payouts: payouts.paid_count,
      awaiting_release: pendingEarnings,
      failed_payouts: payouts.failed_count,
      currency: "NGN",
    };
  }
}
