import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

export const JOB_QUEUE_NAME = "prospectdyno-jobs";

let queue: Queue | null | undefined;
let connection: IORedis | null | undefined;

function redisConnection() {
  if (connection !== undefined) return connection;
  const url = process.env.REDIS_URL;
  if (!url) {
    connection = null;
    return connection;
  }

  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
  });
  return connection;
}

export function isRedisQueueConfigured() {
  return Boolean(process.env.REDIS_URL);
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

  await jobQueue.add(jobType, { jobId }, { jobId });
  return true;
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
