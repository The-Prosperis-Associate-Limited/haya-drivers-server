import { EmailOtpRepository } from "../../repositories/user/emailOtp.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { UserMediaService } from "../shared/userMedia.service";

const userRepo = new UserRepository();
const emailOtpRepo = new EmailOtpRepository();
const mediaService = new UserMediaService();

const UNVERIFIED_ACCOUNT_TTL_DAYS = 30;

// Accounts that never proved their email, plus expired codes; rows cascade and uploaded files are cleared after.
export const deleteUnverifiedAccounts = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNVERIFIED_ACCOUNT_TTL_DAYS);

  const [stale] = await Promise.all([userRepo.findUnverifiedBefore(cutoff), emailOtpRepo.deleteExpiredBefore(new Date())]);

  if (!stale.length) return "0 unverified account(s) deleted";

  const ids = stale.map(user => user.id);
  const { count } = await userRepo.deleteUnverifiedByIds(ids);
  const kept = new Set((await userRepo.findManyByIds(ids, { id: true })).map(user => user.id));

  for (const user of stale) if (!kept.has(user.id)) await mediaService.purge(user.id, user.role, { includePayments: true });

  return `${count} unverified account(s) deleted`;
};
