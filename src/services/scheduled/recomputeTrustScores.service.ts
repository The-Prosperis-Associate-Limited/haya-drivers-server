import { TrustScoreService } from "../shared/trustScore.service";

const trustScoreService = new TrustScoreService();

/*
  A safety net, not the primary path. Trust score is recomputed the moment
  anything that feeds it changes; this catches drift from a failed write or a
  weight change shipped without a backfill.
*/
export const recomputeTrustScores = async () => {
  const count = await trustScoreService.recomputeAll();

  return `${count} trust score(s) recomputed`;
};
