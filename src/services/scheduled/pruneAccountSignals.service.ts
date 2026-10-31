import { AccountSignalService } from "../referral/accountSignal.service";

const signalService = new AccountSignalService();

const RETENTION_DAYS = 180;

export const pruneAccountSignals = async () => {
  const removed = await signalService.pruneOlderThan(RETENTION_DAYS);

  return `${removed} account signal(s) pruned`;
};
