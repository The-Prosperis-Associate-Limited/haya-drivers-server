import type { $Enums } from "../../generated/prisma/client";
import { PayoutRepository } from "../../repositories/earnings/payout.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { paginate, parsePagination } from "../../utils/pagination";
import { WalletService } from "../earnings/wallet.service";

const TYPE_FILTERS: Record<string, $Enums.WalletTransactionType[]> = {
  referrals: ["REFERRAL_BONUS"],
  withdrawals: ["PAYOUT", "PAYOUT_REVERSAL"],
};

export class DriverWalletService {
  private walletService = new WalletService();
  private transactionRepo = new WalletTransactionRepository();
  private payoutRepo = new PayoutRepository();

  async summary(userId: string) {
    const wallet = await this.walletService.getWallet(userId);

    const [inTransit, withdrawn, referralEarned, open] = await Promise.all([
      this.payoutRepo.sumForUser(userId, ["REQUESTED", "PROCESSING"]),
      this.payoutRepo.sumForUser(userId, ["PAID"]),
      this.transactionRepo.sumCreditsByType(wallet.id, "REFERRAL_BONUS"),
      this.payoutRepo.hasOpenPayout(userId),
    ]);

    return {
      currency: wallet.currency,
      available_minor: wallet.available_minor,
      pending_minor: wallet.pending_minor,
      in_transit_minor: inTransit,
      withdrawn_minor: withdrawn,
      referral_earned_minor: referralEarned,
      has_open_payout: open,
      minimum_payout_minor: Math.round(Number(process.env.MINIMUM_PAYOUT_MAJOR ?? 1000) * 100),
    };
  }

  async transactions(userId: string, query: Record<string, unknown>) {
    const wallet = await this.walletService.getWallet(userId);
    const pagination = parsePagination(query);

    const { transactions, total } = await this.transactionRepo.findForWallet(wallet.id, { ...pagination, type: TYPE_FILTERS[String(query.type ?? "")] });

    const rows = transactions.map(transaction => ({
      id: transaction.id,
      reference: transaction.reference,
      type: transaction.type,
      status: transaction.status,
      amount_minor: transaction.amount_minor,
      currency: transaction.currency,
      description: transaction.description,
      available_at: transaction.available_at,
      created_at: transaction.createdAt,
      payout: transaction.payout
        ? {
            reference: transaction.payout.reference,
            status: transaction.payout.status,
            failure_reason: transaction.payout.failure_reason,
            bank_name: transaction.payout.bankAccount?.bank_name ?? null,
            account_last4: transaction.payout.bankAccount?.account_number.slice(-4) ?? null,
          }
        : null,
    }));

    return paginate(rows, total, pagination);
  }
}
