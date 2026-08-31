import IORedis from "ioredis";

const { REDIS_HOST, REDIS_PASS, REDIS_USERNAME, REDIS_PORT, NODE_ENV } = process.env;

const config =
  NODE_ENV === "development"
    ? {
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        lazyConnect: false,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      }
    : {
        host: REDIS_HOST,
        username: REDIS_USERNAME,
        password: REDIS_PASS,
        port: REDIS_PORT as unknown as number,
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        lazyConnect: false,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      };

export const connection = new IORedis(config);

let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 30000;

connection.on("error", err => {
  const now = Date.now();
  if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
    console.error("❌ Redis connection error:", err.message);
    console.warn("⚠️  Email queueing will not work until Redis is available.");
    lastErrorLogTime = now;
  }
});

connection.on("connect", () => {
  console.log("✅ Redis connected successfully");
  lastErrorLogTime = 0;
});

connection.on("ready", () => {
  console.log("✅ Redis ready to accept commands");
});
