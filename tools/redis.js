import IORedis from "ioredis";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured");
}

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

const REMINDER_QUEUE_NAME = "vaccine-reminders";

const reminderQueue = new Queue(REMINDER_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 200,
    removeOnFail: 500,
    backoff: {
      type: "exponential",
      delay: 30_000,
    },
  },
});

export { redisConnection, reminderQueue, REMINDER_QUEUE_NAME };
