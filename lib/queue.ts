import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

export const JOB_QUEUE_NAME = "prospectdyno-jobs";

let queue: Queue | null | undefined;
let connection: IORedis | null | undefined;

function redisUrl() {
  return process.env.REDIS_URL?.trim() || "";
}

function isRenderInternalRedis(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.startsWith("red-") && !hostname.includes(".");
  } catch {
    return false;
  }
}

function isOnRender() {
  return Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
}

function isOnVercel() {
  return Boolean(process.env.VERCEL);
}

export function isRedisQueueConfigured() {
  const url = redisUrl();
  if (!url) return false;
  // Vercel cannot reach Render's private Redis hostname.
  if (isOnVercel()) return false;
  if (isRenderInternalRedis(url) && !isOnRender()) return false;
  return true;
}

function redisConnection() {
  if (connection !== undefined) return connection;
  if (!isRedisQueueConfigured()) {
    connection = null;
    return connection;
  }

  connection = new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 8) return null;
      return Math.min(times * 250, 2000);
    },
  });
  connection.on("error", (error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Redis connection error:", error.message);
    }
  });
  return connection;
}

export function getJobQueue() {
  if (queue !== undefined) return queue;
  const redis = redisConnection();
  if (!redis) {
    queue = null;
    return queue;
  }

  queue = new Queue(JOB_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
  return queue;
}

export async function enqueueBullJob(jobId: string, jobType: string) {
  const jobQueue = getJobQueue();
  if (!jobQueue) return false;

  try {
    const redis = redisConnection();
    if (redis?.status === "wait") {
      await redis.connect();
    }
    await jobQueue.add(jobType, { jobId }, { jobId });
    return true;
  } catch (error) {
    console.warn(
      "Could not enqueue BullMQ job; falling back to in-process processing.",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export function createBullWorker(handler: (jobId: string) => Promise<unknown>) {
  const redis = redisConnection();
  if (!redis) return null;

  return new Worker(
    JOB_QUEUE_NAME,
    async (job) => {
      const jobId = String(job.data?.jobId ?? "");
      if (!jobId) {
        throw new Error("Missing Supabase job id");
      }
      return handler(jobId);
    },
    {
      connection: redis,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
    },
  );
}
