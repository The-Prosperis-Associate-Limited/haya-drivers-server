import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { generateReference } from "../../utils/reference";
import { resolveProvider } from "../payments/provider.registry";
import { WalletService } from "../earnings/wallet.service";
import { NotificationService } from "../shared/notification.service";
import { formatMoney } from "../../utils/money";

const { PAYMENT_FEE_PERCENT, PAYMENT_FEE_MIN_MINOR, PAYMENT_FEE_MAX_MINOR } = process.env;

const feePercent = Number(PAYMENT_FEE_PERCENT ?? 1);
const feeFloor = Number(PAYMENT_FEE_MIN_MINOR ?? 10_000);
const feeCap = Number(PAYMENT_FEE_MAX_MINOR ?? 200_000);

// The platform's cut on a wallet payment. The client pays it on top - the
// driver always receives the full agreed amount.
export const paymentFeeFor = (amountMinor: number) => Math.min(Math.max(Math.round((amountMinor * feePercent) / 100), feeFloor), feeCap);

export class ClientWalletService {
  private walletRepo = new WalletRepository();
  private transactionRepo = new WalletTransactionRepository();
  private userRepo = new UserRepository();
  private bookingRepo = new BookingRepository();
  private walletService = new WalletService();
  private notificationService = new NotificationService();

  // Provisioned lazily on first read - a client who never opens the wallet
  // never becomes a Paystack customer.
  async getWallet(userId: string) {
    const wallet = await this.walletRepo.ensureForUser(userId);

    if (wallet.dva_account_number) return wallet;

    const user = await this.userRepo.findById(userId, { email: true, first_name: true, last_name: true, phone_no: true });

    if (!user) throw new NotFoundError("Account not found");

    // A provisioning failure (or a missing Paystack key in dev) must not take
    // the whole wallet down - the balance still renders, deposits wait, and the
    // next read retries.
    try {
      const provider = resolveProvider(wallet.currency);

      const account = await provider.createDedicatedAccount({
        email: user.email as string,
        first_name: user.first_name ?? "Client",
        last_name: user.last_name,
        phone: user.phone_no,
      });

      return await this.walletRepo.writeDedicatedAccount(wallet.id, {
        dva_account_number: account.account_number,
        dva_account_name: account.account_name,
        dva_bank_name: account.bank_name,
        dva_customer_code: account.customer_code,
      });
    } catch (error) {
      console.warn(`⚠️  Could not provision a virtual account for ${userId}:`, error instanceof Error ? error.message : error);
      return wallet;
    }
  }

  async listTransactions(userId: string, params: { page: number; limit: number; type?: "FUNDING" | "BOOKING_CHARGE" | "PLATFORM_FEE" }) {
    const wallet = await this.walletRepo.ensureForUser(userId);

    return this.transactionRepo.findForWallet(wallet.id, params);
  }

  /*
    The transactions page header. "Pending this cycle" is the month's committed
    salaries not yet paid - commitment minus what already went out since the 1st
    - because no payment scheduler exists; the figure is derived, not promised.
  */
  async summary(userId: string) {
    const wallet = await this.walletRepo.ensureForUser(userId);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [totalPaid, paidThisMonth, commitment] = await Promise.all([
      this.transactionRepo.sumDebitsByType(wallet.id, "BOOKING_CHARGE"),
      this.transactionRepo.sumDebitsByType(wallet.id, "BOOKING_CHARGE", monthStart),
      this.bookingRepo.sumActiveMonthlyCommitment(userId),
    ]);

    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    return {
      total_paid_minor: totalPaid,
      monthly_commitment_minor: commitment,
      pending_cycle_minor: Math.max(commitment - paidThisMonth, 0),
      cycle_ends_at: monthEnd,
      currency: wallet.currency,
    };
  }

  /*
    Idempotent on the provider's reference - Paystack retries webhooks and the
    poll fallback replays the same list, and money must only land once. Funding
    is AVAILABLE immediately: it is the client's own money, not earnings on a
    dispute hold.
  */
  async credit(userId: string, event: { reference: string; amount_minor: number }) {
    if (event.amount_minor <= 0) throw new BadRequestError("Credit amounts must be positive");

    const wallet = await this.walletRepo.ensureForUser(userId);

    const existing = await this.transactionRepo.findByReference(event.reference);
    if (existing) return { transaction: existing, fresh: false };

    const transaction = await this.transactionRepo.create({
      walletId: wallet.id,
      type: "FUNDING",
      status: "AVAILABLE",
      amount_minor: event.amount_minor,
      currency: wallet.currency,
      description: "Wallet deposit",
      reference: event.reference,
      available_at: new Date(),
    });

    await this.walletService.rebuildBalances(wallet.id);

    await this.notificationService.notify({
      recipientId: userId,
      type: "PAYMENT",
      title: "Wallet funded",
      message: `${formatMoney(event.amount_minor, wallet.currency)} just landed in your wallet.`,
      actionUrl: "/dashboard/wallet",
      metadata: { reference: event.reference, amount_minor: event.amount_minor },
    });

    return { transaction, fresh: true };
  }

  async handleFundingWebhook(customerCode: string, event: { reference: string; amount_minor: number }) {
    const wallet = await this.walletRepo.findByCustomerCode(customerCode);

    if (!wallet) {
      console.warn(`⚠️  Funding webhook for unknown customer ${customerCode} (ref ${event.reference})`);
      return;
    }

    await this.credit(wallet.userId, event);
  }

  // Poll fallback for funding webhooks that never arrived - local dev has no
  // reachable webhook url, and credit() makes replaying the whole list safe.
  async syncFunding(userId: string) {
    const wallet = await this.walletRepo.ensureForUser(userId);

    if (!wallet.dva_customer_code) return { credited: 0 };

    const provider = resolveProvider(wallet.currency);
    const events = await provider.listFundingEvents(wallet.dva_customer_code);

    let credited = 0;

    for (const event of events) {
      const { fresh } = await this.credit(userId, event);
      if (fresh) credited += 1;
    }

    return { credited };
  }

  /*
    The client pays the fee on top; the driver is credited the full agreed
    amount. Two debit legs so the fee is itemised on the client's statement
    rather than hidden inside the salary figure. The driver's credit keeps the
    standard earnings hold, so the dispute window still exists.
  */
  async payDriver(clientId: string, input: { reference: string; amount_minor: number; note?: string }) {
    if (input.amount_minor <= 0) throw new BadRequestError("Enter an amount to pay");

    const booking = await this.bookingRepo.findByReference(input.reference);

    if (!booking || booking.clientId !== clientId) throw new NotFoundError("Booking not found");
    if (!booking.driverId) throw new BadRequestError("This request has no driver attached yet");
    if (!["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(booking.status)) {
      throw new BadRequestError("Payments only apply to an engagement the driver has accepted");
    }

    const fee = paymentFeeFor(input.amount_minor);
    const total = input.amount_minor + fee;

    const wallet = await this.walletRepo.ensureForUser(clientId);

    if (wallet.available_minor < total) {
      throw new BadRequestError("Insufficient wallet balance. Fund your wallet to continue.");
    }

    const reference = generateReference("PAY");
    const driverName = [booking.driver?.first_name, booking.driver?.last_name].filter(Boolean).join(" ") || "your driver";

    await this.transactionRepo.create({
      walletId: wallet.id,
      bookingId: booking.id,
      type: "BOOKING_CHARGE",
      status: "PAID_OUT",
      amount_minor: -input.amount_minor,
      currency: wallet.currency,
      description: input.note || `Payment to ${driverName}`,
      reference,
      available_at: new Date(),
    });

    await this.transactionRepo.create({
      walletId: wallet.id,
      bookingId: booking.id,
      type: "PLATFORM_FEE",
      status: "PAID_OUT",
      amount_minor: -fee,
      currency: wallet.currency,
      description: "Payment fee",
      reference: `${reference}-FEE`,
      available_at: new Date(),
    });

    await this.walletService.rebuildBalances(wallet.id);

    await this.walletService.credit(booking.driverId, {
      amount_minor: input.amount_minor,
      currency: wallet.currency,
      type: "BOOKING_PAYMENT",
      bookingId: booking.id,
      description: input.note || booking.title,
    });

    await this.notificationService.notify({
      recipientId: booking.driverId,
      senderId: clientId,
      type: "PAYMENT",
      title: "You've been paid",
      message: `${formatMoney(input.amount_minor, wallet.currency)} for ${booking.title} is on its way to your wallet.`,
      actionUrl: "/dashboard/settings?tab=earnings",
      metadata: { reference, bookingId: booking.id, amount_minor: input.amount_minor },
    });

    return { reference, amount_minor: input.amount_minor, fee_minor: fee, total_minor: total };
  }
}
