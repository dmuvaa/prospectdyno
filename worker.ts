import { createServiceRoleClient } from "@prospectdyno/supabase/admin";
import { claimNextJob, processJob } from "./lib/pipeline/run-search";
import { createBullWorker, isRedisQueueConfigured } from "./lib/queue";

async function poll() {
  const admin = createServiceRoleClient();
  const job = await claimNextJob(admin, `poller:${process.pid}`);
  if (!job) return;

  try {
    await processJob(job.id, { alreadyClaimed: true });
    console.log("completed", job.id);
  } catch (error) {
    console.error("failed", job.id, error);
  }
}

async function main() {
  console.log("ProspectDyno worker started");

  if (isRedisQueueConfigured()) {
    const worker = createBullWorker((jobId) => processJob(jobId));
    if (!worker) {
      throw new Error("REDIS_URL is configured, but the BullMQ worker could not start.");
    }
    worker.on("completed", (job) => console.log("completed", job.id));
    worker.on("failed", (job, error) => console.error("failed", job?.id, error));
    return;
  }

  console.log("REDIS_URL not set; falling back to Supabase polling.");
  for (;;) {
    await poll();
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

void main();
