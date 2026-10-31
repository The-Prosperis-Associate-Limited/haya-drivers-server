import { UserRepository } from "../../repositories/user/user.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { ClientProfileRepository } from "../../repositories/user/clientProfile.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { hashPassword } from "../../helper/hashPassword";
import { generateEmailVerificationToken } from "../../helper/generateToken";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { BadRequestError } from "../../helper/errors";
import { RegisterInput } from "../../utils/types/authValidatorSchema";
import { ActivityService } from "../shared/activity.service";
import { AuthOtpService } from "./auth.otp.service";
import type { RequestContext } from "../../utils/requestContext";
import { AccountSignalService } from "../referral/accountSignal.service";
import { ReferralCodeService } from "../referral/referral.code.service";
import { ReferralService } from "../referral/referral.service";

export class AuthRegistrationService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private clientProfileRepo = new ClientProfileRepository();
  private walletRepo = new WalletRepository();
  private activityService = new ActivityService();
  private otpService = new AuthOtpService();
  private signalService = new AccountSignalService();
  private referralCodeService = new ReferralCodeService();
  private referralService = new ReferralService();

  async register(data: RegisterInput, context?: RequestContext) {
    const existingUser = await this.userRepo.findByEmail(data.email);

    if (existingUser) throw new BadRequestError("An account with this email already exists");

    const { confirm_password: _, client, accepted_terms, full_name, client_type, organisation_name, referral_code, ...rest } = data;

    // Resolved before the account exists, so a mistyped code is a form error rather than an account created without its referral.
    const referral = rest.role === "DRIVER" && referral_code ? await this.referralCodeService.resolve(referral_code) : null;

    const [first_name, ...remaining] = full_name.trim().split(/\s+/);

    const user = await this.userRepo.createUser({
      ...rest,
      first_name,
      last_name: remaining.join(" ") || null,
      password: await hashPassword(data.password),
      terms_accepted_at: accepted_terms ? new Date() : null,
    });

    // A driver has a profile and a wallet from the first request, so no later
    // code has to guess whether they exist yet.
    if (user.role === "DRIVER") {
      await Promise.all([this.driverProfileRepo.create({ userId: user.id }), this.walletRepo.ensureForUser(user.id)]);
    }

    // A client gets the same guarantee - the profile carries what they hire as,
    // and the wallet is where deposits land.
    if (user.role === "CLIENT") {
      await Promise.all([
        this.clientProfileRepo.create({
          userId: user.id,
          client_type: client_type ?? "INDIVIDUAL",
          organisation_name: client_type === "ORGANISATION" ? (organisation_name ?? full_name) : null,
        }),
        this.walletRepo.ensureForUser(user.id),
      ]);
    }

    await this.activityService.record(user.id, "ACCOUNT_CREATED", "Account created");
    await this.signalService.record(user.id, "SIGNUP", context);

    if (referral) {
      try {
        await this.referralService.attach(user.id, referral.code, "SIGNUP", context);
      } catch (error) {
        console.error("Referral could not be attached at signup", error);
      }
    }

    // The design verifies with a 6-digit code on both surfaces, so a code goes
    // out by default; the emailed link stays available for anyone who prefers it.
    if (client === "mobile") {
      await this.otpService.issue(user.id, user.email, first_name, "EMAIL_VERIFICATION");
    } else {
      await queueEmail(JOB_KEY.REGISTRATION, {
        email: user.email,
        name: first_name,
        verificationToken: generateEmailVerificationToken(user.id),
      });
    }

    return user;
  }

  async createAdmin(data: RegisterInput) {
    const existingUser = await this.userRepo.findByEmail(data.email);

    if (existingUser) throw new BadRequestError("An account with this email already exists");

    const { confirm_password: _, client: __, accepted_terms: ___, referral_code: ____, full_name, ...rest } = data;
    const [first_name, ...remaining] = full_name.trim().split(/\s+/);

    return this.userRepo.createUser({
      ...rest,
      role: "ADMIN",
      first_name,
      last_name: remaining.join(" ") || null,
      password: await hashPassword(data.password),
      has_validated_email: true,
      terms_accepted_at: new Date(),
    });
  }
}
