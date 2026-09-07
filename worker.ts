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

async function pollLoop() {
  for (;;) {
    await poll();
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

function assertWorkerEnv() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && !process.env.SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (missing.length) {
    throw new Error(
      `Render worker is missing ${missing.join(", ")}. Add the same values as Vercel in the worker Environment tab.`,
    );
  }
}

async function main() {
  console.log("ProspectDyno worker started");
  assertWorkerEnv();

  if (isRedisQueueConfigured()) {
    const worker = createBullWorker((jobId) => processJob(jobId));
    if (!worker) {
      throw new Error("REDIS_URL is configured, but the BullMQ worker could not start.");
    }
    worker.on("completed", (job) => console.log("completed", job.id));
    worker.on("failed", (job, error) => console.error("failed", job?.id, error));
    console.log("BullMQ worker listening. Also polling Supabase for Vercel-created jobs.");
  } else {
    console.log("REDIS_URL not usable here; polling Supabase for jobs.");
  }

  await pollLoop();
}

void main();
