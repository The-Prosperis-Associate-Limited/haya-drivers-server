import type { $Enums, Prisma } from "../../generated/prisma/client";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { generateReference } from "../../utils/reference";

// A completed job does not become withdrawable the same minute. The hold gives
// a client room to dispute before the money leaves the platform.
const EARNINGS_HOLD_DAYS = 3;

export class WalletService {
  private walletRepo = new WalletRepository();
  private transactionRepo = new WalletTransactionRepository();

  async ensure(userId: string, currency = "NGN") {
    return this.walletRepo.ensureForUser(userId, currency);
  }

  async credit(userId: string, input: { amount_minor: number; currency?: string; type: $Enums.WalletTransactionType; bookingId?: string; description?: string; available_at?: Date }) {
    const wallet = await this.ensure(userId, input.currency ?? "NGN");

    const transaction = await this.transactionRepo.create({
      walletId: wallet.id,
      bookingId: input.bookingId,
      type: input.type,
      status: "PENDING",
      amount_minor: input.amount_minor,
      currency: wallet.currency,
      description: input.description,
      reference: generateReference("TXN"),
      available_at: input.available_at ?? new Date(Date.now() + EARNINGS_HOLD_DAYS * 24 * 60 * 60 * 1000),
    });

    await this.rebuildBalances(wallet.id);

    return transaction;
  }

  async debit(userId: string, input: { amount_minor: number; type: $Enums.WalletTransactionType; payoutId?: string; description?: string }) {
    const wallet = await this.ensure(userId);

    const transaction = await this.transactionRepo.create({
      walletId: wallet.id,
      payoutId: input.payoutId,
      type: input.type,
      // A debit is settled the moment it is written - there is nothing to wait
      // for on the way out.
      status: "PAID_OUT",
      amount_minor: -Math.abs(input.amount_minor),
      currency: wallet.currency,
      description: input.description,
      reference: generateReference("TXN"),
      available_at: new Date(),
    });

    await this.rebuildBalances(wallet.id);

    return transaction;
  }

  // Only a credit still on hold can be voided outright; once it is withdrawable the money may already have left, so it is clawed back with a debit instead.
  async voidPending(transactionId: string) {
    const voided = await this.transactionRepo.markReversedIfPending(transactionId);

    if (!voided) return false;

    await this.rebuildBalances(voided.walletId);

    return true;
  }

  /*
    The single writer of the cached balances. Every number is re-derived from
    the ledger rather than incremented, so a concurrent write cannot invent
    money - the worst case is a stale cache that the next call corrects.
  */
  async rebuildBalances(walletId: string) {
    const [available, pending, lifetime] = await Promise.all([
      this.transactionRepo.sumByStatus(walletId, "AVAILABLE"),
      this.transactionRepo.sumByStatus(walletId, "PENDING"),
      this.transactionRepo.sumCredits(walletId),
    ]);

    // Payout debits carry PAID_OUT and a negative amount, so adding this sum
    // nets them off rather than double-counting them.
    const paidOut = await this.transactionRepo.sumByStatus(walletId, "PAID_OUT");

    return this.walletRepo.writeBalances(walletId, {
      available_minor: available + paidOut,
      pending_minor: pending,
      lifetime_minor: lifetime,
    });
  }

  async releaseDuePending() {
    const due = await this.transactionRepo.findDuePending(new Date());

    if (!due.length) return 0;

    await this.transactionRepo.markAvailable(due.map(transaction => transaction.id));

    const walletIds = [...new Set(due.map(transaction => transaction.walletId))];

    for (const walletId of walletIds) {
      await this.rebuildBalances(walletId);
    }

    return due.length;
  }

  async getWallet(userId: string) {
    return this.ensure(userId);
  }

  async findTransaction(reference: string): Promise<Prisma.WalletTransactionGetPayload<object> | null> {
    return this.transactionRepo.findByReference(reference);
  }
}
