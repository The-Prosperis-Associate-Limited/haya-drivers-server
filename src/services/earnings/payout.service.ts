import type { $Enums } from "../../generated/prisma/client";
import { BankAccountRepository } from "../../repositories/earnings/bankAccount.repository";
import { PayoutRepository } from "../../repositories/earnings/payout.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { formatMoney, toMinorUnits } from "../../utils/money";
import { generateReference } from "../../utils/reference";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { paginate, parsePagination } from "../../utils/pagination";
import { resolveProvider } from "../payments/provider.registry";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { WalletService } from "./wallet.service";
import type { AddBankAccountInput } from "../../utils/types/earningsValidatorSchema";

const { CLIENT_URL, MINIMUM_PAYOUT_MAJOR } = process.env;

const minimumPayoutMinor = toMinorUnits(Number(MINIMUM_PAYOUT_MAJOR ?? 1000));

export class PayoutService {
  private payoutRepo = new PayoutRepository();
  private bankAccountRepo = new BankAccountRepository();
  private userRepo = new UserRepository();
  private walletService = new WalletService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async listBanks(country: string, currency: string) {
    return resolveProvider(currency).listBanks(country);
  }

  async listBankAccounts(userId: string) {
    return this.bankAccountRepo.findForUser(userId);
  }

  /*
    Provider-less rail: the driver types their own account name and no
    name-enquiry runs - settlement is a manual transfer from the organisation
    account, and the admin's banking app performs its own name check at the
    moment money is sent. recipient_code stays null, which is what keeps
    dispatch() from ever calling a payment provider for these accounts.
  */
  async addBankAccount(userId: string, data: AddBankAccountInput) {
    const isFirst = (await this.bankAccountRepo.countForUser(userId)) === 0;

    return this.bankAccountRepo.create({
      userId,
      provider: "MANUAL",
      bank_code: data.bank_code,
      bank_name: data.bank_name,
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

    return this.bankAccountRepo.delete(id);
  }

  async requestPayout(userId: string, amountMajor: number, bankAccountId?: string) {
    const wallet = await this.walletService.getWallet(userId);
    const amount_minor = toMinorUnits(amountMajor);

    if (amount_minor < minimumPayoutMinor) throw new BadRequestError(`The minimum withdrawal is ${formatMoney(minimumPayoutMinor, wallet.currency)}`);
    if (amount_minor > wallet.available_minor) throw new BadRequestError(`You can withdraw up to ${formatMoney(wallet.available_minor, wallet.currency)} right now`);

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
      provider: account.provider,
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

    await this.dispatch(payout.id);

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

    return this.payoutRepo.findById(payout.id);
  }

  async list(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { payouts, total } = await this.payoutRepo.findForUser(userId, { ...pagination, status: query.status as $Enums.PayoutStatus | undefined });

    return paginate(payouts, total, pagination);
  }

  // A provider failure here is not fatal: the payout stays REQUESTED and an
  // admin can retry it, which is better than a driver whose balance is gone and
  // whose withdrawal does not exist.
  private async dispatch(payoutId: string) {
    const payout = await this.payoutRepo.findById(payoutId);

    if (!payout?.bankAccount?.recipient_code) return;

    try {
      const provider = resolveProvider(payout.currency);

      const result = await provider.transfer({
        amount_minor: payout.amount_minor,
        currency: payout.currency,
        recipient_code: payout.bankAccount.recipient_code,
        reference: payout.reference,
      });

      await this.payoutRepo.update(payoutId, {
        provider_ref: result.provider_ref,
        status: result.status === "PAID" ? "PAID" : "PROCESSING",
        processed_at: result.status === "PAID" ? new Date() : null,
      });
    } catch (error) {
      console.error("Payout dispatch failed:", error);
    }
  }

  async settle(reference: string, status: $Enums.PayoutStatus, failureReason?: string) {
    const payout = await this.payoutRepo.findByReference(reference);

    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status === "PAID" || payout.status === "REVERSED") return payout;

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
      actionUrl: "/dashboard/earnings",
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
