import { EmailOtpRepository } from "../../repositories/user/emailOtp.repository";
import { UserRepository } from "../../repositories/user/user.repository";

const userRepo = new UserRepository();
const emailOtpRepo = new EmailOtpRepository();

const UNVERIFIED_ACCOUNT_TTL_DAYS = 30;

// Accounts that never proved their email address, plus the expired codes they
// left behind. Everything they own cascades from the user row.
export const deleteUnverifiedAccounts = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNVERIFIED_ACCOUNT_TTL_DAYS);

  const [users] = await Promise.all([userRepo.deleteUnverifiedBefore(cutoff), emailOtpRepo.deleteExpiredBefore(new Date())]);

  return `${users.count} unverified account(s) deleted`;
};
