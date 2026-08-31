import { UserRepository } from "../../repositories/user/user.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { hashPassword } from "../../helper/hashPassword";
import { generateEmailVerificationToken } from "../../helper/generateToken";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { BadRequestError } from "../../helper/errors";
import { RegisterInput } from "../../utils/types/authValidatorSchema";
import { ActivityService } from "../shared/activity.service";
import { AuthOtpService } from "./auth.otp.service";

export class AuthRegistrationService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private walletRepo = new WalletRepository();
  private activityService = new ActivityService();
  private otpService = new AuthOtpService();

  async register(data: RegisterInput) {
    const existingUser = await this.userRepo.findByEmail(data.email);

    if (existingUser) throw new BadRequestError("An account with this email already exists");

    const { confirm_password: _, client, accepted_terms, full_name, ...rest } = data;

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

    await this.activityService.record(user.id, "ACCOUNT_CREATED", "Account created");

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

    const { confirm_password: _, client: __, accepted_terms: ___, full_name, ...rest } = data;
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
