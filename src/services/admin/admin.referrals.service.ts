import type { $Enums } from "../../generated/prisma/client";
import { ReferralRepository, type ReferralWithPeople } from "../../repositories/referral/referral.repository";
import { NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { ReferralRewardService } from "../referral/referral.reward.service";
import { RISK_FLAGS, type RiskFlag } from "../referral/referral.risk.service";

const STATUSES: $Enums.ReferralStatus[] = ["SIGNED_UP", "REWARDED", "HELD", "REJECTED", "REVERSED"];

const person = (user: ReferralWithPeople["referee"]) => ({
  id: user.id,
  name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed driver",
  email: user.email,
  profile_pic: user.profile_pic,
  location: [user.city, user.state_of_residence].filter(Boolean).join(", ") || null,
  account_status: user.account_status,
  verification_status: user.driver_profile?.verification_status ?? null,
  onboarding_step: user.driver_profile?.onboarding_step ?? null,
  code: user.driver_profile?.referral_code ?? null,
});

const shape = (referral: ReferralWithPeople) => ({
  id: referral.id,
  code: referral.code,
  channel: referral.channel,
  status: referral.status,
  reward_minor: referral.reward_minor,
  currency: referral.currency,
  risk_score: referral.risk_score,
  risk_flags: referral.risk_flags.map(flag => ({ key: flag, label: RISK_FLAGS[flag as RiskFlag]?.label ?? flag, blocks: RISK_FLAGS[flag as RiskFlag]?.blocks ?? false })),
  qualified_at: referral.qualified_at,
  rewarded_at: referral.rewarded_at,
  reward_available_at: referral.walletTransaction?.available_at ?? null,
  reward_transaction_status: referral.walletTransaction?.status ?? null,
  reviewed_at: referral.reviewed_at,
  review_note: referral.review_note,
  reviewed_by: referral.reviewedBy ? [referral.reviewedBy.first_name, referral.reviewedBy.last_name].filter(Boolean).join(" ") : null,
  created_at: referral.createdAt,
  referee: person(referral.referee),
  referrer: person(referral.referrer),
});

export class AdminReferralsService {
  private referralRepo = new ReferralRepository();
  private rewardService = new ReferralRewardService();

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const status = STATUSES.find(candidate => candidate === query.status);

    const { referrals, total } = await this.referralRepo.list({
      ...pagination,
      status,
      search: typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined,
      flagged: query.flagged === "true",
      referrerId: typeof query.referrerId === "string" ? query.referrerId : undefined,
    });

    return paginate(referrals.map(shape), total, pagination);
  }

  async get(id: string) {
    const referral = await this.referralRepo.findById(id);

    if (!referral) throw new NotFoundError("Referral not found");

    return shape(referral);
  }

  async approve(id: string, adminId: string, note?: string) {
    await this.rewardService.approve(id, adminId, note);

    return this.get(id);
  }

  async reject(id: string, adminId: string, reason: string) {
    await this.rewardService.reject(id, adminId, reason);

    return this.get(id);
  }

  async reverse(id: string, adminId: string, reason: string) {
    await this.rewardService.reverse(id, adminId, reason);

    return this.get(id);
  }
}
