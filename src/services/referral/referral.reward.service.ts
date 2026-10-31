import type { $Enums } from "../../generated/prisma/client";
import { ReferralRepository, type ReferralWithPeople } from "../../repositories/referral/referral.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { REFERRAL_CONFIG } from "../../utils/referralConfig";
import { WalletService } from "../earnings/wallet.service";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { ReferralRiskService } from "./referral.risk.service";

export const maskedName = (person: { first_name: string | null; last_name: string | null }) =>
  [person.first_name, person.last_name ? `${person.last_name[0]}.` : null].filter(Boolean).join(" ") || "A driver";

export class ReferralRewardService {
  private referralRepo = new ReferralRepository();
  private userRepo = new UserRepository();
  private riskService = new ReferralRiskService();
  private walletService = new WalletService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async qualify(refereeId: string) {
    const referral = await this.referralRepo.findByReferee(refereeId);

    if (!referral || referral.status !== "SIGNED_UP" || referral.qualified_at) return null;

    if (!(await this.referralRepo.transition(referral.id, ["SIGNED_UP"], { qualified_at: new Date() }, { qualified_at: null }))) return null;

    const risk = await this.riskService.assess(referral.referrerId, refereeId);
    const assessed = { risk_flags: risk.flags, risk_score: risk.score };
    const name = maskedName(referral.referee);

    if (risk.blocked) {
      await this.referralRepo.transition(referral.id, ["SIGNED_UP"], { ...assessed, status: "REJECTED", review_note: "Refused automatically by the referral checks" });
      await this.notifyReferrer(referral.referrerId, "Referral didn't qualify", `${name}'s sign-up didn't qualify for a referral reward.`);

      return "REJECTED";
    }

    if (risk.flags.length) {
      await this.referralRepo.transition(referral.id, ["SIGNED_UP"], { ...assessed, status: "HELD" });
      await this.notifyReferrer(referral.referrerId, "Referral reward under review", `${name} submitted their documents. Your ${formatMoney(REFERRAL_CONFIG.rewardMinor, REFERRAL_CONFIG.currency)} reward is being checked by our team.`);
      await this.notifyAdmins(`A referral reward for ${name} is held for review`, referral.id);

      return "HELD";
    }

    await this.referralRepo.update(referral.id, assessed);
    await this.pay(referral, ["SIGNED_UP"], new Date(Date.now() + REFERRAL_CONFIG.holdHours * 60 * 60 * 1000));

    return "REWARDED";
  }

  async approve(id: string, adminId: string, note?: string) {
    const referral = await this.require(id);

    if (referral.status !== "HELD" && !(referral.status === "SIGNED_UP" && referral.qualified_at)) throw new BadRequestError("Only a held referral can be approved");

    await this.pay(referral, [referral.status], new Date(), { reviewedById: adminId, reviewed_at: new Date(), review_note: note ?? null });
    await this.activityService.record(adminId, "REFERRAL_APPROVED", `Approved referral reward for ${maskedName(referral.referee)}`);

    return this.referralRepo.findById(id);
  }

  async reject(id: string, adminId: string, reason: string) {
    const referral = await this.require(id);

    if (!(await this.referralRepo.transition(id, ["HELD"], { status: "REJECTED", reviewedById: adminId, reviewed_at: new Date(), review_note: reason }))) throw new BadRequestError("Only a held referral can be rejected");

    await this.notifyReferrer(referral.referrerId, "Referral reward declined", `Your reward for referring ${maskedName(referral.referee)} was declined after review.`);
    await this.activityService.record(adminId, "REFERRAL_REJECTED", `Rejected referral reward for ${maskedName(referral.referee)}`);

    return this.referralRepo.findById(id);
  }

  async reverse(id: string, adminId: string, reason: string) {
    const referral = await this.require(id);

    if (!(await this.referralRepo.transition(id, ["REWARDED"], { status: "REVERSED", reviewedById: adminId, reviewed_at: new Date(), review_note: reason }))) throw new BadRequestError("Only a paid reward can be reversed");

    const voided = referral.walletTransactionId ? await this.walletService.voidPending(referral.walletTransactionId) : false;

    if (!voided) {
      const clawback = await this.walletService.debit(referral.referrerId, {
        amount_minor: referral.reward_minor,
        type: "ADJUSTMENT",
        description: `Referral reward reversed · ${maskedName(referral.referee)}`,
      });

      await this.referralRepo.update(id, { reversalTransactionId: clawback.id });
    }

    await this.notifyReferrer(referral.referrerId, "Referral reward reversed", `The ${formatMoney(referral.reward_minor, referral.currency)} reward for referring ${maskedName(referral.referee)} was reversed.`);
    await this.activityService.record(adminId, "REFERRAL_REVERSED", `Reversed referral reward for ${maskedName(referral.referee)}`);

    return this.referralRepo.findById(id);
  }

  private async pay(referral: ReferralWithPeople, from: $Enums.ReferralStatus[], availableAt: Date, review: Record<string, unknown> = {}) {
    const amount = REFERRAL_CONFIG.rewardMinor;

    if (!(await this.referralRepo.transition(referral.id, from, { status: "REWARDED", rewarded_at: new Date(), reward_minor: amount, currency: REFERRAL_CONFIG.currency, ...review }))) {
      throw new BadRequestError("This referral has already been settled");
    }

    try {
      const transaction = await this.walletService.credit(referral.referrerId, {
        amount_minor: amount,
        currency: REFERRAL_CONFIG.currency,
        type: "REFERRAL_BONUS",
        description: `Referral reward · ${maskedName(referral.referee)}`,
        available_at: availableAt,
      });

      await this.referralRepo.update(referral.id, { walletTransactionId: transaction.id });
    } catch (error) {
      await this.referralRepo.transition(referral.id, ["REWARDED"], { status: from[0], rewarded_at: null, reward_minor: 0 });
      throw error;
    }

    await this.notifyReferrer(referral.referrerId, "You earned a referral reward", `${maskedName(referral.referee)} submitted their documents - ${formatMoney(amount, REFERRAL_CONFIG.currency)} is in your wallet.`, "SUCCESS");
  }

  private async require(id: string) {
    const referral = await this.referralRepo.findById(id);

    if (!referral) throw new NotFoundError("Referral not found");

    return referral;
  }

  private async notifyReferrer(recipientId: string, title: string, message: string, type: $Enums.NotificationType = "PAYMENT") {
    await this.notificationService.notify({ recipientId, type, title, message, actionUrl: "/dashboard/referrals" });
  }

  private async notifyAdmins(message: string, referralId: string) {
    const adminIds = await this.userRepo.findAdminIds();

    await Promise.all(
      adminIds.map(admin =>
        this.notificationService.notify({ recipientId: admin, type: "WARNING", title: "Referral held for review", message, actionUrl: `/dashboard/referrals?review=${referralId}` }),
      ),
    );
  }
}
