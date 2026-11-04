import { toMinorUnits } from "./money";

export const PAYOUT_STEP_MINOR = toMinorUnits(Number(process.env.PAYOUT_STEP_MAJOR ?? 10000));

export const withdrawableMinor = (availableMinor: number) => Math.max(0, Math.floor(availableMinor / PAYOUT_STEP_MINOR)) * PAYOUT_STEP_MINOR;
