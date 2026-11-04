import type { $Enums } from "../../generated/prisma/client";
import { BankAccountRepository } from "../../repositories/earnings/bankAccount.repository";
import { PayoutRepository } from "../../repositories/earnings/payout.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { formatMoney, toMinorUnits } from "../../utils/money";
import { generateReference } from "../../utils/reference";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { NIGERIAN_BANKS } from "../../utils/nigerianBanks";
import { paginate, parsePagination } from "../../utils/pagination";
import { PAYOUT_STEP_MINOR, withdrawableMinor } from "../../utils/payoutRules";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { WalletService } from "./wallet.service";
import type { AddBankAccountInput } from "../../utils/types/earningsValidatorSchema";

const { CLIENT_URL } = process.env;

export class PayoutService {
  private payoutRepo = new PayoutRepository();
  private bankAccountRepo = new BankAccountRepository();
  private userRepo = new UserRepository();
  private walletService = new WalletService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  listBanks() {
    return NIGERIAN_BANKS;
  }

  async listBankAccounts(userId: string) {
    return this.bankAccountRepo.findForUser(userId);
  }

  async addBankAccount(userId: string, data: AddBankAccountInput) {
    const bank = NIGERIAN_BANKS.find(option => option.code === data.bank_code);

    if (!bank) throw new BadRequestError("Select your bank");

    const isFirst = (await this.bankAccountRepo.countForUser(userId)) === 0;

    return this.bankAccountRepo.create({
      userId,
      provider: "MANUAL",
      bank_code: bank.code,
      bank_name: bank.name,
      account_number: data.account_number,
      account_name: data.account_name,
      country: data.country,
      currency: data.currency,
      is_default: isFirst,
    });
  }

  async setDefaultBankAccount(userId: string, id: string) {
    const account = await this.bankAccountRepo.findById(id);

    if (!account) throw new NotFoundError("That account was not found");
    if (account.userId !== userId) throw new ForbiddenError("That account belongs to another driver");

    await this.bankAccountRepo.setDefault(userId, id);

    return this.bankAccountRepo.findForUser(userId);
  }

  async removeBankAccount(userId: string, id: string) {
    const account = await this.bankAccountRepo.findById(id);

    if (!account) throw new NotFoundError("That account was not found");
    if (account.userId !== userId) throw new ForbiddenError("That account belongs to another driver");
    if (await this.payoutRepo.hasOpenPayout(userId)) throw new BadRequestError("You have a withdrawal in progress. Try again once it settles.");

    const removed = await this.bankAccountRepo.delete(id);

    if (account.is_default) {
      const [next] = await this.bankAccountRepo.findForUser(userId);

      if (next) await this.bankAccountRepo.setDefault(userId, next.id);
    }

    return removed;
  }

  async requestPayout(userId: string, amountMajor: number, bankAccountId?: string) {
    const wallet = await this.walletService.getWallet(userId);
    const amount_minor = toMinorUnits(amountMajor);

    const withdrawable = withdrawableMinor(wallet.available_minor);

    if (withdrawable === 0) throw new BadRequestError(`Withdrawals open once your balance reaches ${formatMoney(PAYOUT_STEP_MINOR, wallet.currency)}`);
    if (amount_minor % PAYOUT_STEP_MINOR !== 0) throw new BadRequestError(`You can only withdraw in multiples of ${formatMoney(PAYOUT_STEP_MINOR, wallet.currency)}`);
    if (amount_minor > withdrawable) throw new BadRequestError(`You can withdraw up to ${formatMoney(withdrawable, wallet.currency)} right now`);

    // One open payout at a time. Two in flight against a balance that is only
    // debited on request would let a driver withdraw the same money twice.
    if (await this.payoutRepo.hasOpenPayout(userId)) throw new BadRequestError("You already have a withdrawal in progress");

    const account = bankAccountId ? await this.bankAccountRepo.findById(bankAccountId) : await this.bankAccountRepo.findDefaultForUser(userId);

    if (!account) throw new BadRequestError("Add a bank account before withdrawing");
    if (account.userId !== userId) throw new ForbiddenError("That account belongs to another driver");

    const reference = generateReference("PYT");

    const payout = await this.payoutRepo.create({
      reference,
      userId,
      bankAccountId: account.id,
      provider: "MANUAL",
      amount_minor,
      currency: wallet.currency,
      status: "REQUESTED",
    });

    // Debited on request, not on settlement - the money has to leave the
    // available balance immediately or it can be spent twice while in flight.
    await this.walletService.debit(userId, {
      amount_minor,
      type: "PAYOUT",
      payoutId: payout.id,
      description: `Withdrawal to ${account.bank_name}`,
    });

    const user = await this.userRepo.findById(userId, { email: true, first_name: true });

    await queueEmail(JOB_KEY.PAYOUT_STATUS, {
      email: user?.email as string,
      first_name: (user?.first_name as string) ?? "there",
      status: "REQUESTED",
      amount: formatMoney(amount_minor, wallet.currency),
      bankName: account.bank_name,
      accountNumber: account.account_number,
      reference,
      baseUrl: CLIENT_URL as string,
    });

    await this.activityService.record(userId, "PAYOUT_REQUESTED", `Withdrawal of ${formatMoney(amount_minor, wallet.currency)} requested`);

    const adminIds = await this.userRepo.findAdminIds();

    await Promise.all(
      adminIds.map(recipientId =>
        this.notificationService.notify({
          recipientId,
          senderId: userId,
          type: "PAYOUT",
          title: "Withdrawal to pay",
          message: `${reference}: transfer ${formatMoney(amount_minor, wallet.currency)} to ${account.account_name}, then mark it paid.`,
          actionUrl: "/dashboard/transactions",
        }),
      ),
    );

    return this.payoutRepo.findById(payout.id);
  }

  async list(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { payouts, total } = await this.payoutRepo.findForUser(userId, { ...pagination, status: query.status as $Enums.PayoutStatus | undefined });

    return paginate(payouts, total, pagination);
  }

  async settle(reference: string, status: $Enums.PayoutStatus, failureReason?: string) {
    const payout = await this.payoutRepo.findByReference(reference);

    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status === "PAID" || payout.status === "FAILED" || payout.status === "REVERSED") return payout;

    await this.payoutRepo.update(payout.id, {
      status,
      failure_reason: failureReason ?? null,
      processed_at: new Date(),
    });

    // A failed transfer puts the money back. Without this the driver is out of
    // pocket for a transfer that never happened.
    if (status === "FAILED") {
      await this.walletService.credit(payout.userId, {
        amount_minor: payout.amount_minor,
        currency: payout.currency,
        type: "PAYOUT_REVERSAL",
        description: `Reversal of ${payout.reference}`,
        available_at: new Date(),
      });
    }

    await this.notificationService.notify({
      recipientId: payout.userId,
      type: "PAYOUT",
      title: status === "PAID" ? "Withdrawal paid" : "Withdrawal failed",
      message: status === "PAID" ? `${formatMoney(payout.amount_minor, payout.currency)} has been sent to your bank account.` : `We could not complete your withdrawal. ${failureReason ?? "The money is back in your balance."}`,
      actionUrl: "/dashboard/wallet",
    });

    await queueEmail(JOB_KEY.PAYOUT_STATUS, {
      email: payout.user.email,
      first_name: payout.user.first_name ?? "there",
      status: status === "PAID" ? "PAID" : "FAILED",
      amount: formatMoney(payout.amount_minor, payout.currency),
      bankName: payout.bankAccount?.bank_name ?? "your bank",
      accountNumber: payout.bankAccount?.account_number ?? "",
      reference: payout.reference,
      baseUrl: CLIENT_URL as string,
      failureReason,
    });

    await this.activityService.record(payout.userId, status === "PAID" ? "PAYOUT_PAID" : "PAYOUT_FAILED", `Withdrawal ${payout.reference} ${status.toLowerCase()}`);

    return this.payoutRepo.findById(payout.id);
  }
}
