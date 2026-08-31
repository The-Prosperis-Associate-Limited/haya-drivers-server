import crypto from "crypto";
import type { $Enums } from "../../generated/prisma/client";
import { EmailOtpRepository } from "../../repositories/user/emailOtp.repository";
import { BadRequestError, TooManyRequestsError } from "../../helper/errors";
import { generateNumericCode } from "../../utils/reference";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;

const hashOtp = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

// Both operands are fixed-length sha256 hex, so this never throws on a length
// mismatch the way timingSafeEqual does on raw user input.
const timingSafeEqualHex = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class AuthOtpService {
  private emailOtpRepo = new EmailOtpRepository();

  async issue(userId: string, email: string, firstName: string, purpose: $Enums.EmailOtpPurpose) {
    await this.throttleResend(userId, purpose);

    const code = generateNumericCode(6);

    // Issuing consumes every outstanding code. Without this a resend would reset
    // the attempt counter, and five guesses per resend is not a cap.
    await this.emailOtpRepo.consumeAllFor(userId, purpose);

    await this.emailOtpRepo.create({
      userId,
      purpose,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });

    // The code is stored hashed and cannot be read back, so a local environment
    // with no email provider configured would have no way to finish a signup.
    if (process.env.NODE_ENV === "development") {
      console.log(`🔑 ${purpose} code for ${email}: ${code}`);
    }

    await queueEmail(JOB_KEY.EMAIL_OTP, {
      email,
      first_name: firstName,
      code,
      expiresInMinutes: OTP_TTL_MINUTES,
      purpose,
    });
  }

  async consumeOrThrow(userId: string, code: string, purpose: $Enums.EmailOtpPurpose) {
    const otp = await this.emailOtpRepo.findLatestActive(userId, purpose);

    if (!otp) throw new BadRequestError("That code is not valid. Request a new one.");
    if (otp.expiresAt < new Date()) throw new BadRequestError("That code has expired. Request a new one.");
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new BadRequestError("Too many attempts on that code. Request a new one.");

    // Counted before the comparison, so a crash mid-verify cannot hand back a
    // free guess.
    await this.emailOtpRepo.incrementAttempts(otp.id);

    if (!timingSafeEqualHex(otp.codeHash, hashOtp(code))) throw new BadRequestError("That code is not valid.");

    await this.emailOtpRepo.markConsumed(otp.id);
  }

  private async throttleResend(userId: string, purpose: $Enums.EmailOtpPurpose) {
    const latest = await this.emailOtpRepo.findLatest(userId, purpose);

    if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_INTERVAL_MS) {
      const seconds = Math.ceil((OTP_RESEND_INTERVAL_MS - (Date.now() - latest.createdAt.getTime())) / 1000);

      throw new TooManyRequestsError(`Please wait ${seconds} seconds before requesting another code.`);
    }
  }
}
