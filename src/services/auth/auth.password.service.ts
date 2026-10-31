import jwt, { Secret } from "jsonwebtoken";
import { UserRepository } from "../../repositories/user/user.repository";
import { AdminProfileRepository } from "../../repositories/user/adminProfile.repository";
import { comparePassword, hashPassword } from "../../helper/hashPassword";
import { generatePasswordResetToken } from "../../helper/generateToken";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { CustomJwtPayload } from "../../interface";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { AuthOtpService } from "./auth.otp.service";

const { EMAIL_VERIFICATION_TOKEN, CLIENT_URL } = process.env;

export class AuthPasswordService {
  private userRepo = new UserRepository();
  private adminProfileRepo = new AdminProfileRepository();
  private otpService = new AuthOtpService();

  // Deliberately silent about whether the address has an account.
  async forgotPassword(email: string) {
    const user = await this.userRepo.findByEmail(email);

    if (!user || (user.googleId && !user.password)) return;

    await queueEmail(JOB_KEY.FORGOT_PASSWORD, {
      email: user.email,
      first_name: user.first_name ?? "there",
      baseUrl: CLIENT_URL as string,
      resetToken: generatePasswordResetToken(user.id),
    });
  }

  async sendPasswordResetOtp(email: string) {
    const user = await this.userRepo.findByEmail(email);

    if (!user || (user.googleId && !user.password)) return;

    await this.otpService.issue(user.id, user.email, user.first_name ?? "there", "PASSWORD_RESET");
  }

  // Returns the same ten-minute token the emailed link carries, so both routes
  // converge on one reset endpoint rather than growing a second one.
  async verifyPasswordResetOtp(email: string, code: string) {
    const user = await this.userRepo.findByEmail(email);

    if (!user) throw new BadRequestError("That code is not valid.");

    await this.otpService.consumeOrThrow(user.id, code, "PASSWORD_RESET");

    return { resetToken: generatePasswordResetToken(user.id) };
  }

  async resetPassword(token: string, password: string) {
    const { id } = jwt.verify(token, EMAIL_VERIFICATION_TOKEN as Secret) as CustomJwtPayload;

    const user = await this.userRepo.findUniqueUser({ id }, { id: true, email: true, first_name: true, role: true });

    if (!user) throw new NotFoundError("Account not found");

    await this.userRepo.updateUser(id, {
      password: await hashPassword(password),
      failedLoginAttempts: 0,
      isLocked: false,
      // Every existing session dies here. The success screen promises exactly
      // this, so it has to be true rather than reassuring copy.
      sessions_valid_from: new Date(),
    });

    await this.adminProfileRepo.clearMustChangePassword(id);

    await queueEmail(JOB_KEY.RESET_PASSWORD, {
      email: user.email as string,
      first_name: user.first_name ?? "there",
      baseUrl: CLIENT_URL as string,
    });
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findUniqueUser({ id: userId }, { id: true, password: true });

    if (!user) throw new NotFoundError("Account not found");
    if (!user.password) throw new BadRequestError("This account signs in with Google and has no password to change");

    const isMatch = await comparePassword(currentPassword, user.password as string);

    if (!isMatch) throw new BadRequestError("Your current password is incorrect");

    await this.userRepo.updateUser(userId, { password: await hashPassword(newPassword) });

    await this.adminProfileRepo.clearMustChangePassword(userId);
  }
}
