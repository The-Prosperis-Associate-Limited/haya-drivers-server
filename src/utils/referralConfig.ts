import { toMinorUnits } from "./money";

const { REFERRAL_REWARD_MAJOR, REFERRAL_HOLD_HOURS, REFERRAL_DAILY_CAP, REFERRAL_ATTACH_WINDOW_DAYS } = process.env;

export const REFERRAL_CONFIG = {
  rewardMinor: toMinorUnits(Number(REFERRAL_REWARD_MAJOR ?? 1000)),
  currency: "NGN",
  holdHours: Number(REFERRAL_HOLD_HOURS ?? 72),
  dailyCap: Number(REFERRAL_DAILY_CAP ?? 5),
  attachWindowDays: Number(REFERRAL_ATTACH_WINDOW_DAYS ?? 30),
  signalLookbackDays: 90,
};
