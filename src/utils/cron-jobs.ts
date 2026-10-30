import { deleteUnverifiedAccounts } from "../services/scheduled/deleteUnverifiedAccounts.service";
import { deactivateInactiveAccounts } from "../services/scheduled/deactivateInactiveAccounts.service";
import { notifyExpiringLicences } from "../services/scheduled/licenceExpiry.service";
import { recomputeTrustScores } from "../services/scheduled/recomputeTrustScores.service";
import { releasePendingEarnings } from "../services/scheduled/releasePendingEarnings.service";
import { expireShortlists } from "../services/scheduled/expireShortlists.service";
import { salarySweep } from "../services/scheduled/salarySweep.service";
import { emailQueue } from "../workers/globalEmailQueueHandler";
import { SCHEDULED_JOB_KEY } from "../workers/jobKeys";

type ScheduledJobKey = (typeof SCHEDULED_JOB_KEY)[keyof typeof SCHEDULED_JOB_KEY];

// One sweep per file, one line each here. The worker dispatches through this
// map, so adding a sweep is a new import and a new entry - never a new branch
// in the worker.
const SCHEDULED_JOBS: Record<ScheduledJobKey, () => Promise<string>> = {
  [SCHEDULED_JOB_KEY.RELEASE_PENDING_EARNINGS]: releasePendingEarnings,
  [SCHEDULED_JOB_KEY.EXPIRE_SHORTLISTS]: expireShortlists,
  [SCHEDULED_JOB_KEY.SALARY_SWEEP]: salarySweep,
  [SCHEDULED_JOB_KEY.LICENCE_EXPIRY_SWEEP]: notifyExpiringLicences,
  [SCHEDULED_JOB_KEY.DELETE_UNVERIFIED_ACCOUNTS]: deleteUnverifiedAccounts,
  [SCHEDULED_JOB_KEY.RECOMPUTE_TRUST_SCORES]: recomputeTrustScores,
  [SCHEDULED_JOB_KEY.DEACTIVATE_INACTIVE_ACCOUNTS]: deactivateInactiveAccounts,
};

const SCHEDULE: { key: ScheduledJobKey; pattern: string }[] = [
  { key: SCHEDULED_JOB_KEY.RELEASE_PENDING_EARNINGS, pattern: "0 * * * *" },
  { key: SCHEDULED_JOB_KEY.EXPIRE_SHORTLISTS, pattern: "*/15 * * * *" },
  { key: SCHEDULED_JOB_KEY.SALARY_SWEEP, pattern: "20 * * * *" },
  { key: SCHEDULED_JOB_KEY.LICENCE_EXPIRY_SWEEP, pattern: "0 8 * * *" },
  { key: SCHEDULED_JOB_KEY.DELETE_UNVERIFIED_ACCOUNTS, pattern: "0 3 * * *" },
  { key: SCHEDULED_JOB_KEY.RECOMPUTE_TRUST_SCORES, pattern: "0 4 * * 0" },
  { key: SCHEDULED_JOB_KEY.DEACTIVATE_INACTIVE_ACCOUNTS, pattern: "30 2 * * *" },
];

export const runScheduledJob = async (jobType: ScheduledJobKey) => {
  const handler = SCHEDULED_JOBS[jobType];

  // A repeatable whose key was retired can linger in Redis - skip it quietly
  // instead of failing the worker every time it fires.
  if (!handler) return `Skipped retired scheduled job: ${jobType}`;

  return handler();
};

export const initializeCronJobs = async () => {
  console.log("🔧 Registering scheduled jobs...");

  for (const { key, pattern } of SCHEDULE) {
    // The job id is the schedule key, so re-registering on every boot replaces
    // the repeatable rather than stacking a second copy of it.
    await emailQueue.add(
      `scheduled_${key}`,
      { jobType: key },
      {
        repeat: { pattern },
        jobId: key,
        removeOnComplete: 5,
        removeOnFail: 10,
      },
    );
  }

  console.log(`✅ ${SCHEDULE.length} scheduled jobs registered`);
};
