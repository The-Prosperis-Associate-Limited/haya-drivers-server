import { AccountSignalRepository } from "../../repositories/referral/accountSignal.repository";
import { ReferralRepository } from "../../repositories/referral/referral.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { GuarantorRepository } from "../../repositories/driver/guarantor.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { canonicalEmail } from "../../utils/emailCanonical";
import { REFERRAL_CONFIG } from "../../utils/referralConfig";

export const RISK_FLAGS = {
  SELF_EMAIL_ALIAS: { weight: 100, blocks: true, label: "Email is an alias of the referrer's own address" },
  SAME_LICENCE_AS_REFERRER: { weight: 100, blocks: true, label: "Same driver's licence number as the referrer" },
  REFERRER_INACTIVE: { weight: 100, blocks: true, label: "Referrer is suspended, deactivated or erased" },
  REFERRER_NOT_VERIFIED: { weight: 30, blocks: false, label: "Referrer has not been verified yet" },
  SAME_DEVICE_AS_REFERRER: { weight: 40, blocks: false, label: "Signed up or submitted from the referrer's device" },
  LICENCE_REUSED: { weight: 40, blocks: false, label: "Licence number is on another driver account" },
  EMAIL_ALIAS_OF_OTHER_REFEREE: { weight: 30, blocks: false, label: "Email is an alias of another driver this referrer brought in" },
  SAME_NETWORK_AS_REFERRER: { weight: 25, blocks: false, label: "Same internet connection as the referrer" },
  DEVICE_SHARED: { weight: 25, blocks: false, label: "Device has been used by another account" },
  NETWORK_CLUSTER: { weight: 20, blocks: false, label: "Shares a connection with 2+ other drivers this referrer brought in" },
  GUARANTOR_REUSED: { weight: 20, blocks: false, label: "Guarantor phone or NIN already used by the referrer or their referrals" },
  DAILY_CAP_REACHED: { weight: 15, blocks: false, label: `Referrer already earned ${REFERRAL_CONFIG.dailyCap}+ rewards in 24 hours` },
} as const;

export type RiskFlag = keyof typeof RISK_FLAGS;

export interface RiskAssessment {
  flags: RiskFlag[];
  score: number;
  blocked: boolean;
}

const digits = (value: string) => value.replace(/\D/g, "").slice(-10);

export class ReferralRiskService {
  private signalRepo = new AccountSignalRepository();
  private referralRepo = new ReferralRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private guarantorRepo = new GuarantorRepository();
  private userRepo = new UserRepository();

  async assess(referrerId: string, refereeId: string): Promise<RiskAssessment> {
    const since = new Date(Date.now() - REFERRAL_CONFIG.signalLookbackDays * 24 * 60 * 60 * 1000);
    const flags = new Set<RiskFlag>();

    const [people, refereeProfile, referrerProfile, refereeSignals, referrerSignals, siblings, rewardedToday] = await Promise.all([
      this.userRepo.findManyByIds([referrerId, refereeId], { id: true, email: true, account_status: true, anonymised_at: true }),
      this.driverProfileRepo.findByUserId(refereeId, { license_number: true }),
      this.driverProfileRepo.findByUserId(referrerId, { license_number: true, verification_status: true }),
      this.signalRepo.hashesForUser(refereeId, since),
      this.signalRepo.hashesForUser(referrerId, since),
      this.referralRepo.refereesOf(referrerId),
      this.referralRepo.countRewardedSince(referrerId, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    ]);

    const referrer = people.find(person => person.id === referrerId);
    const referee = people.find(person => person.id === refereeId);
    const siblingIds = siblings.map(sibling => sibling.refereeId).filter(id => id !== refereeId);

    if (!referrer || referrer.account_status !== "ACTIVE" || referrer.anonymised_at) flags.add("REFERRER_INACTIVE");
    else if (referrerProfile?.verification_status !== "APPROVED") flags.add("REFERRER_NOT_VERIFIED");

    if (referrer && referee) {
      const refereeEmail = canonicalEmail(referee.email);

      if (refereeEmail === canonicalEmail(referrer.email)) flags.add("SELF_EMAIL_ALIAS");
      if (siblings.some(sibling => sibling.refereeId !== refereeId && canonicalEmail(sibling.referee.email) === refereeEmail)) flags.add("EMAIL_ALIAS_OF_OTHER_REFEREE");
    }

    const licence = refereeProfile?.license_number?.trim();

    if (licence) {
      if (referrerProfile?.license_number?.trim().toLowerCase() === licence.toLowerCase()) flags.add("SAME_LICENCE_AS_REFERRER");
      else if ((await this.driverProfileRepo.userIdsWithLicence(licence, refereeId)).length) flags.add("LICENCE_REUSED");
    }

    if (refereeSignals.device.some(hash => referrerSignals.device.includes(hash))) flags.add("SAME_DEVICE_AS_REFERRER");
    if (refereeSignals.ip.some(hash => referrerSignals.ip.includes(hash))) flags.add("SAME_NETWORK_AS_REFERRER");

    const [deviceSharers, networkSiblings, guarantors] = await Promise.all([
      this.signalRepo.userIdsSharing({ deviceHashes: refereeSignals.device, excludeUserIds: [refereeId, referrerId], since }),
      siblingIds.length ? this.signalRepo.userIdsSharing({ ipHashes: refereeSignals.ip, excludeUserIds: [refereeId], onlyUserIds: siblingIds, since }) : Promise.resolve([]),
      this.guarantorRepo.findForUsers([refereeId, referrerId, ...siblingIds]),
    ]);

    if (deviceSharers.length) flags.add("DEVICE_SHARED");
    if (networkSiblings.length >= 2) flags.add("NETWORK_CLUSTER");

    const own = guarantors.filter(guarantor => guarantor.driver.userId === refereeId);
    const others = guarantors.filter(guarantor => guarantor.driver.userId !== refereeId);

    if (own.some(mine => others.some(other => (mine.nin && mine.nin === other.nin) || digits(mine.phone_no) === digits(other.phone_no)))) flags.add("GUARANTOR_REUSED");

    if (rewardedToday >= REFERRAL_CONFIG.dailyCap) flags.add("DAILY_CAP_REACHED");

    const list = [...flags];

    return {
      flags: list,
      score: Math.min(100, list.reduce((total, flag) => total + RISK_FLAGS[flag].weight, 0)),
      blocked: list.some(flag => RISK_FLAGS[flag].blocks),
    };
  }
}
