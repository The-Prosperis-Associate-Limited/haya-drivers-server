import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { generateReferralCode, normaliseReferralCode, REFERRAL_CODE_PATTERN } from "../../utils/referralCode";

const { CLIENT_URL } = process.env;

const INVALID_CODE = "We couldn't find that referral code. Check it with the driver who sent it, or leave it blank.";

export class ReferralCodeService {
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();

  async ensureCode(userId: string) {
    const profile = await this.driverProfileRepo.findByUserId(userId, { referral_code: true });

    if (!profile) throw new NotFoundError("Driver profile not found");
    if (profile.referral_code) return profile.referral_code;

    const user = await this.userRepo.findById(userId, { first_name: true });

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (await this.driverProfileRepo.claimReferralCode(userId, generateReferralCode(user?.first_name))) break;
      } catch {
        continue;
      }
    }

    const claimed = await this.driverProfileRepo.findByUserId(userId, { referral_code: true });

    if (!claimed?.referral_code) throw new BadRequestError("Could not create a referral code. Please try again.");

    return claimed.referral_code;
  }

  inviteLink(code: string) {
    return `${CLIENT_URL}/driver/auth/signup?ref=${encodeURIComponent(code)}`;
  }

  async resolve(rawCode: string) {
    const code = normaliseReferralCode(rawCode);

    if (!REFERRAL_CODE_PATTERN.test(code)) throw new BadRequestError(INVALID_CODE);

    const profile = await this.driverProfileRepo.findByReferralCode(code);
    const referrer = profile?.user;

    if (!referrer || referrer.role !== "DRIVER" || referrer.account_status !== "ACTIVE" || referrer.anonymised_at) throw new BadRequestError(INVALID_CODE);

    return { code, referrer };
  }

  async preview(rawCode: string) {
    const { code, referrer } = await this.resolve(rawCode);

    return { code, referrer_name: [referrer.first_name, referrer.last_name ? `${referrer.last_name[0]}.` : null].filter(Boolean).join(" ") || "A Haya Drivers driver" };
  }
}
