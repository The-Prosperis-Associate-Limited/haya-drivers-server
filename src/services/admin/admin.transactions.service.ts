import { AdminFinanceRepository } from "../../repositories/earnings/adminFinance.repository";
import { paginate, parsePagination } from "../../utils/pagination";

export class AdminTransactionsService {
  private financeRepo = new AdminFinanceRepository();

  async stats() {
    const [clientWallets, payouts, pendingEarnings, serviceFees] = await Promise.all([this.financeRepo.clientWalletTotals(), this.financeRepo.payoutTotals(), this.financeRepo.pendingDriverEarnings(), this.financeRepo.serviceFeeTotals()]);

    return {
      held_in_client_wallets_minor: clientWallets.available_minor + clientWallets.pending_minor,
      client_wallets: clientWallets,
      paid_to_drivers_minor: payouts.paid_minor,
      paid_payouts: payouts.paid_count,
      awaiting_release: pendingEarnings,
      failed_payouts: payouts.failed_count,
      service_fees: serviceFees,
      currency: "NGN",
    };
  }

  async wallets(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const { wallets, total } = await this.financeRepo.findClientWallets({ ...pagination, search: query.search as string | undefined });

    const data = wallets.map(({ transactions, ...wallet }) => ({
      ...wallet,
      last_top_up: transactions[0] ?? null,
    }));

    return paginate(data, total, pagination);
  }

  async serviceFees(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const { fees, total } = await this.financeRepo.findServiceFees({ ...pagination, search: query.search as string | undefined });

    // Fees are stored as signed client debits; the ledger view wants positive figures.
    const data = fees.map(fee => ({ ...fee, amount_minor: Math.abs(fee.amount_minor) }));

    return paginate(data, total, pagination);
  }
}
