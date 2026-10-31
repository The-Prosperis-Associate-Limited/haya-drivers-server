import crypto from "crypto";
import type { $Enums } from "../../generated/prisma/client";
import { AccountSignalRepository } from "../../repositories/referral/accountSignal.repository";
import type { RequestContext } from "../../utils/requestContext";

const { SIGNAL_HASH_SECRET, ACCESS_TOKEN_SECRET } = process.env;

const keyedHash = (value: string) =>
  crypto
    .createHmac("sha256", (SIGNAL_HASH_SECRET || ACCESS_TOKEN_SECRET) as string)
    .update(value)
    .digest("hex");

const normaliseIp = (ip: string) => ip.replace(/^::ffff:/, "");

export class AccountSignalService {
  private signalRepo = new AccountSignalRepository();

  async record(userId: string, event: $Enums.AccountSignalEvent, context?: RequestContext) {
    if (!context?.ip && !context?.deviceId) return;

    try {
      await this.signalRepo.create({
        userId,
        event,
        ip_hash: context.ip ? keyedHash(`ip:${normaliseIp(context.ip)}`) : null,
        device_hash: context.deviceId ? keyedHash(`device:${context.deviceId}`) : null,
        user_agent: context.userAgent ?? null,
      });
    } catch (error) {
      console.error("Failed to record account signal", error);
    }
  }

  async pruneOlderThan(days: number) {
    return this.signalRepo.deleteOlderThan(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  }
}
