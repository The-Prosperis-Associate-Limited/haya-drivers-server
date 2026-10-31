import type { $Enums } from "../../generated/prisma/client";
import { ReferralRepository } from "../../repositories/referral/referral.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { REFERRAL_CONFIG } from "../../utils/referralConfig";
import type { RequestContext } from "../../utils/requestContext";
import { ONBOARDING_STEP_LABELS } from "../../utils/onboardingSteps";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { AccountSignalService } from "./accountSignal.service";
import { ReferralCodeService } from "./referral.code.service";
import { maskedName } from "./referral.reward.service";

const STATUS_FILTERS: Record<string, $Enums.ReferralStatus[]> = {
  onboarding: ["SIGNED_UP"],
  qualified: ["REWARDED", "HELD"],
  rewarded: ["REWARDED"],
};

type Referee = {
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state_of_residence: string | null;
  has_validated_email: boolean;
  driver_profile: { verification_status: $Enums.DriverVerificationStatus; onboarding_step: $Enums.OnboardingStep; onboarding_completed_at: Date | null } | null;
};

const progressOf = (referee: Referee) => {
  const profile = referee.driver_profile;

  if (profile?.verification_status === "APPROVED") return { step: 4, label: "Verified driver" };
  if (profile?.verification_status === "REJECTED") return { step: 4, label: "Submitted · some documents need resubmitting" };
  if (profile?.onboarding_completed_at || profile?.verification_status === "PENDING") return { step: 4, label: "Submitted for verification" };
  if (profile && profile.onboarding_step !== "PERSONAL_INFORMATION") return { step: 3, label: `Onboarding · ${ONBOARDING_STEP_LABELS[profile.onboarding_step]}` };
  if (referee.has_validated_email) return { step: 2, label: "Email verified · not started onboarding" };

  return { step: 1, label: "Signed up · email not verified" };
};

export class ReferralService {
  private referralRepo = new ReferralRepository();
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private codeService = new ReferralCodeService();
  private signalService = new AccountSignalService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async attach(refereeId: string, rawCode: string, channel: $Enums.ReferralChannel, context?: RequestContext) {
    const { code, referrer } = await this.codeService.resolve(rawCode);

    const [referee, profile, existing, referrersReferrer] = await Promise.all([
      this.userRepo.findById(refereeId, { id: true, role: true, first_name: true, last_name: true, createdAt: true }),
      this.driverProfileRepo.findByUserId(refereeId, { verification_status: true }),
      this.referralRepo.findByReferee(refereeId),
      this.referralRepo.findReferrerOf(referrer.id),
    ]);

    if (!referee || referee.role !== "DRIVER") throw new BadRequestError("Only driver accounts can use a referral code");
    if (existing) throw new BadRequestError("A referral code is already linked to your account");
    if (referrer.id === refereeId) throw new BadRequestError("You can't use your own referral code");
    if (referrersReferrer?.referrerId === refereeId) throw new BadRequestError("You can't use the code of a driver you referred");
    if (referrer.createdAt >= referee.createdAt) throw new BadRequestError("That code belongs to an account newer than yours");

    if (channel === "ONBOARDING") {
      if (profile?.verification_status !== "UNSUBMITTED") throw new BadRequestError("A referral code can only be added before you submit for verification");
      if (Date.now() - referee.createdAt.getTime() > REFERRAL_CONFIG.attachWindowDays * 24 * 60 * 60 * 1000) throw new BadRequestError("The window for adding a referral code has closed");
    }

    const referral = await this.referralRepo.create({ referrerId: referrer.id, refereeId, code, channel, currency: REFERRAL_CONFIG.currency });

    await this.signalService.record(refereeId, "REFERRAL_ATTACH", context);
    await this.activityService.record(refereeId, "REFERRAL_ATTACHED", `Joined with ${maskedName(referrer)}'s referral code`);
    await this.notificationService.notify({
      recipientId: referrer.id,
      type: "INFO",
      title: "Someone joined with your code",
      message: `${maskedName(referee)} signed up with your referral code. You'll get your reward when they submit their documents.`,
      actionUrl: "/dashboard/referrals",
    });

    return referral;
  }

  async overview(userId: string) {
    const code = await this.codeService.ensureCode(userId);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [counts, thisMonth, referredBy] = await Promise.all([
      this.referralRepo.statusCountsForReferrer(userId),
      this.referralRepo.countSince(userId, monthStart),
      this.referralRepo.findReferrerOf(userId),
    ]);

    const count = (...statuses: $Enums.ReferralStatus[]) => counts.filter(row => statuses.includes(row.status)).reduce((total, row) => total + row._count._all, 0);

    return {
      code,
      link: this.codeService.inviteLink(code),
      reward_minor: REFERRAL_CONFIG.rewardMinor,
      currency: REFERRAL_CONFIG.currency,
      hold_hours: REFERRAL_CONFIG.holdHours,
      stats: {
        invited: count("SIGNED_UP", "REWARDED", "HELD", "REJECTED", "REVERSED"),
        invited_this_month: thisMonth,
        onboarding: count("SIGNED_UP"),
        qualified: count("REWARDED", "HELD"),
        under_review: count("HELD"),
        earned_minor: counts.find(row => row.status === "REWARDED")?._sum.reward_minor ?? 0,
        waiting_minor: count("SIGNED_UP") * REFERRAL_CONFIG.rewardMinor,
      },
      referred_by: referredBy ? { name: maskedName(referredBy.referrer) } : null,
    };
  }

  async list(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const status = STATUS_FILTERS[String(query.status ?? "")];

    const { referrals, total } = await this.referralRepo.findForReferrer(userId, { ...pagination, status });

    const rows = referrals.map(referral => {
      const verified = referral.referee.driver_profile?.verification_status === "APPROVED";

      return {
        id: referral.id,
        status: referral.status,
        reward_minor: referral.reward_minor,
        currency: referral.currency,
        joined_at: referral.createdAt,
        rewarded_at: referral.rewarded_at,
        referee: {
          name: verified ? [referral.referee.first_name, referral.referee.last_name].filter(Boolean).join(" ") : maskedName(referral.referee),
          initials: `${referral.referee.first_name?.[0] ?? ""}${referral.referee.last_name?.[0] ?? ""}`.toUpperCase() || "?",
          location: [referral.referee.city, referral.referee.state_of_residence].filter(Boolean).join(", ") || null,
          verified,
        },
        progress: progressOf(referral.referee),
      };
    });

    return paginate(rows, total, pagination);
  }

  async requireReferralFor(userId: string) {
    const referral = await this.referralRepo.findByReferee(userId);

    if (!referral) throw new NotFoundError("No referral is linked to this account");

    return referral;
  }
}
