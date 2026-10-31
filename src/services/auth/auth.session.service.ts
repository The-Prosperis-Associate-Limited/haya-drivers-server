import jwt, { Secret } from "jsonwebtoken";
import { UserRepository } from "../../repositories/user/user.repository";
import { AdminProfileRepository } from "../../repositories/user/adminProfile.repository";
import { comparePassword } from "../../helper/hashPassword";
import { generateTokenPair, generateAccessToken } from "../../helper/generateToken";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { CustomJwtPayload } from "../../interface";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { AuthOtpService } from "./auth.otp.service";

const { EMAIL_VERIFICATION_TOKEN, CLIENT_URL } = process.env;

export class AuthSessionService {
  private userRepo = new UserRepository();
  private adminProfileRepo = new AdminProfileRepository();
  private otpService = new AuthOtpService();

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);

    if (!user) throw new BadRequestError("Invalid credentials");

    // Dormant accounts (90-day inactivity sweep) may sign in - the dashboard
    // prompts them to reactivate. Admin-made deactivation stays a hard block.
    if (user.account_status === "DEACTIVATED" && !user.deactivated_for_inactivity) throw new ForbiddenError("This account has been deactivated. Please contact support.");
    if (user.account_status === "SUSPENDED") throw new ForbiddenError("This account is suspended. Please contact support.");
    if (user.isLocked) throw new ForbiddenError("Too many failed attempts. Reset your password to unlock this account.");
    if (!user.has_validated_email) throw new BadRequestError("Please verify your email before signing in");
    if (user.googleId && !user.password) throw new BadRequestError("Please sign in with Google");

    const isMatch = await comparePassword(password, user.password as string);

    if (!isMatch) {
      await this.userRepo.incrementFailedLogin(user.id, user.failedLoginAttempts);

      throw new BadRequestError("Invalid credentials");
    }

    await this.userRepo.resetLoginAttempts(user.id);

    const { password: _, ...safeUser } = user;

    // The admin console needs must_change_password at sign-in to route the
    // invitee straight to the password screen.
    const admin_profile = user.role === "ADMIN" ? await this.adminProfileRepo.findByUserId(user.id) : undefined;

    return { user: admin_profile !== undefined ? { ...safeUser, admin_profile } : safeUser, tokens: generateTokenPair({ id: user.id, role: user.role }) };
  }

  async refresh(userId: string, role: string) {
    const user = await this.userRepo.findById(userId, { id: true, account_status: true, deactivated_for_inactivity: true });

    if (!user) throw new NotFoundError("Account no longer exists");

    const dormant = user.account_status === "DEACTIVATED" && user.deactivated_for_inactivity;

    if (user.account_status !== "ACTIVE" && !dormant) throw new ForbiddenError("This account is not active");

    // A refresh is activity - without this, a long-lived session would look
    // idle to the inactivity sweep and get deactivated mid-use.
    if (user.account_status === "ACTIVE") this.userRepo.updateUser(userId, { lastLogin: new Date() }).catch(() => {});

    return { accessToken: generateAccessToken({ id: userId, role }) };
  }

  async reactivate(userId: string) {
    const user = (await this.userRepo.findById(userId, {
      id: true,
      account_status: true,
      deactivated_for_inactivity: true,
      role: true,
      driver_profile: { select: { verification_status: true } },
    })) as {
      id: string;
      account_status: string;
      deactivated_for_inactivity: boolean;
      role: string;
      driver_profile: { verification_status: string } | null;
    } | null;

    if (!user) throw new NotFoundError("Account no longer exists");
    if (user.account_status === "ACTIVE") return { reactivated: true };
    if (!(user.account_status === "DEACTIVATED" && user.deactivated_for_inactivity)) throw new ForbiddenError("This account cannot be reactivated here. Please contact support.");

    await this.userRepo.updateUser(userId, {
      account_status: "ACTIVE",
      deactivated_for_inactivity: false,
      lastLogin: new Date(),
      // The sweep hid dormant drivers from search - an approved driver comes back.
      ...(user.role === "DRIVER" &&
        user.driver_profile?.verification_status === "APPROVED" && {
          driver_profile: { update: { is_discoverable: true } },
        }),
    });

    return { reactivated: true };
  }

  async validateEmailByToken(token: string) {
    const { id } = jwt.verify(token, EMAIL_VERIFICATION_TOKEN as Secret) as CustomJwtPayload;

    const user = await this.userRepo.findUniqueUser({ id }, { id: true, first_name: true, email: true, has_validated_email: true, role: true });

    if (!user) throw new NotFoundError("Account not found");

    const name = encodeURIComponent(user.first_name ?? "there");
    const baseUrl = CLIENT_URL as string;

    if (user.has_validated_email) return `${baseUrl}/auth/email-verified?name=${name}`;

    await this.userRepo.updateUser(id, { has_validated_email: true });

    await queueEmail(JOB_KEY.EMAIL_VERIFIED, {
      email: user.email as string,
      first_name: user.first_name ?? "there",
      baseUrl,
    });

    return `${baseUrl}/auth/email-verified?name=${name}`;
  }

  // Same response whether or not the address has an account - anything else
  // turns this endpoint into an account-enumeration oracle.
  async sendEmailVerificationOtp(email: string) {
    const user = await this.userRepo.findByEmail(email);

    if (!user || user.has_validated_email) return;

    await this.otpService.issue(user.id, user.email, user.first_name ?? "there", "EMAIL_VERIFICATION");
  }

  // Verification returns a session, so the driver is not made to sign in again
  // straight after proving they own the address.
  async verifyEmailOtp(email: string, code: string) {
    const user = await this.userRepo.findByEmail(email);

    if (!user) throw new BadRequestError("That code is not valid.");

    await this.otpService.consumeOrThrow(user.id, code, "EMAIL_VERIFICATION");

    if (!user.has_validated_email) {
      await this.userRepo.updateUser(user.id, { has_validated_email: true });

      await queueEmail(JOB_KEY.EMAIL_VERIFIED, {
        email: user.email,
        first_name: user.first_name ?? "there",
        baseUrl: CLIENT_URL as string,
      });
    }

    const { password: _, ...safeUser } = user;

    return { user: { ...safeUser, has_validated_email: true }, tokens: generateTokenPair({ id: user.id, role: user.role }) };
  }
}
