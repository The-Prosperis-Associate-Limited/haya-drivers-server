import { Queue, Worker } from "bullmq";
import { connection } from "./redisConnection";
import { SCHEDULED_JOB_KEY } from "./jobKeys";
import { EmailPayloadMap } from "./workerTypes";
import { runScheduledJob } from "../utils/cron-jobs";

export const emailQueue = new Queue("Emails", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
});

type EmailJobHandler = (data: any) => Promise<any>;

const jobHandlers: Record<string, EmailJobHandler> = {};

export const registerEmailHandler = (type: string, handler: EmailJobHandler) => {
  jobHandlers[type] = handler;
};

let globalEmailWorker: Worker | null = null;

export const initializeEmailWorker = function () {
  if (globalEmailWorker) {
    console.log("⚠️ Email worker already initialized");
    return globalEmailWorker;
  }

  globalEmailWorker = new Worker(
    "Emails",
    async job => {
      const { type, jobType, ...data } = job.data;

      if (jobType) {
        const message = await runScheduledJob(jobType as (typeof SCHEDULED_JOB_KEY)[keyof typeof SCHEDULED_JOB_KEY]);
        return { success: true, jobType, message };
      }

      if (!type) throw new Error("Job must have either 'type' or 'jobType' specified");

      const handler = jobHandlers[type];
      if (!handler) throw new Error(`No handler registered for email type: ${type}`);

      const result = await handler(data);
      return { success: true, email: data.email, type, result };
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    },
  );

  globalEmailWorker.on("completed", (_job, result) => {
    if (result?.jobType) {
      console.log(`✅ Scheduled job '${result.jobType}' completed: ${result.message}`);
    } else {
      console.log(`✅ Email sent for type: ${result?.type}`);
    }
  });

  globalEmailWorker.on("failed", (job, err) => {
    const jobType = job?.data?.jobType;
    console.error(jobType ? `❌ Scheduled job '${jobType}' failed: ${err.message}` : `❌ Email job failed: ${err.message}`);
  });

  globalEmailWorker.on("error", err => {
    if (err.message?.includes("ETIMEDOUT") || err.message?.includes("ECONNREFUSED")) {
      const now = Date.now();
      const worker = globalEmailWorker as any;
      if (!worker._lastRedisErrorLog || now - worker._lastRedisErrorLog > 60000) {
        console.warn("⚠️  Email worker: Redis connection issue. Email queueing unavailable until Redis is connected.");
        worker._lastRedisErrorLog = now;
      }
    } else {
      console.error("Worker error:", err);
    }
  });

  return globalEmailWorker;
};

export const queueEmail = async <T extends keyof EmailPayloadMap>(type: T, data: EmailPayloadMap[T]) => {
  try {
    if (!globalEmailWorker || !globalEmailWorker.isRunning()) {
      throw new Error("Email worker is not running. Call initializeEmailWorker() first.");
    }

    const job = await emailQueue.add(
      "send_email",
      { type, ...data },
      {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    console.log(`📨 Queued email job: ${job.id} - Type: ${type} for ${(data as { email?: string }).email}`);
    return job;
  } catch (error) {
    console.error("❌ Failed to queue email:", error);
    throw error;
  }
};

export const queueBulkEmail = async <T extends keyof EmailPayloadMap>(type: T, emailData: EmailPayloadMap[T][], timeoutMs = 10000) => {
  try {
    if (!globalEmailWorker || !globalEmailWorker.isRunning()) {
      throw new Error("Email worker is not running. Call initializeEmailWorker() first.");
    }

    const jobs = emailData.map((data, index) => ({
      name: "send_email",
      data: { type, ...data },
      opts: {
        removeOnComplete: 10,
        removeOnFail: 50,
        delay: index * 500,
        attempts: 3,
        backoff: { type: "exponential" as const, delay: 2000 },
      },
    }));

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Queue operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const result = await Promise.race([emailQueue.addBulk(jobs), timeoutPromise]);
    console.log(`📨 Queued ${jobs.length} bulk email jobs for type: ${type}`);
    return result;
  } catch (error) {
    console.error("❌ Failed to queue bulk emails:", error);
    throw error;
  }
};

export const queueScheduledJob = async (jobType: string, data: Record<string, unknown> = {}) => {
  try {
    if (!globalEmailWorker || !globalEmailWorker.isRunning()) {
      throw new Error("Email worker is not running. Call initializeEmailWorker() first.");
    }

    const job = await emailQueue.add(
      `scheduled_${jobType}`,
      { jobType, ...data },
      {
        removeOnComplete: 5,
        removeOnFail: 10,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    console.log(`📅 Queued scheduled job: ${job.id} - Type: ${jobType}`);
    return job;
  } catch (error) {
    console.error("❌ Failed to queue scheduled job:", error);
    throw error;
  }
};

export const getRegisteredHandlersCount = () => Object.keys(jobHandlers).length;

export const isWorkerReady = () => globalEmailWorker?.isRunning() || false;

export const closeWorker = async () => {
  await globalEmailWorker?.close();
};

export { globalEmailWorker };
