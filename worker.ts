import { createAdminClient } from "@prospectdyno/supabase/admin";
import { describeSupabaseKey } from "@prospectdyno/supabase/env";
import { claimNextJob, processJob } from "./lib/pipeline/run-search";
import { createBullWorker, isRedisQueueConfigured } from "./lib/queue";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid api key|jwt|invalid token|not authorized/i.test(message);
}

function secretKeyValue() {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

async function poll() {
  const admin = createAdminClient();
  const job = await claimNextJob(admin, `poller:${process.pid}`);
  if (!job) return;

  try {
    console.log("running", job.job_type, job.id);
    await processJob(job.id, { alreadyClaimed: true });
    console.log("completed", job.id);
  } catch (error) {
    console.error("failed", job.id, error);
  }
}

async function pollLoop() {
  for (;;) {
    try {
      await poll();
    } catch (error) {
      console.error("poll failed", error);
      if (isAuthError(error)) {
        console.error(
          "Supabase rejected the worker key. Set SUPABASE_SECRET_KEY to the secret key (sb_secret_…), not the publishable key.",
        );
        await sleep(15_000);
        continue;
      }
    }
    await sleep(4000);
  }
}

function assertWorkerEnv() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && !process.env.SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!secretKeyValue()) {
    missing.push("SUPABASE_SECRET_KEY");
  }
  if (missing.length) {
    throw new Error(
      `Render worker is missing ${missing.join(", ")}. Add the same values as Vercel in the worker Environment tab.`,
    );
  }

  console.log(`Supabase key type: ${describeSupabaseKey(secretKeyValue())}`);
}

async function waitForSupabase() {
  for (;;) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("jobs").select("id").limit(1);
      if (!error) {
        console.log("Supabase connection ok");
        return;
      }
      console.error("Supabase key rejected:", error.message);
    } catch (error) {
      console.error(
        "Could not reach Supabase:",
        error instanceof Error ? error.message : error,
      );
    }
    console.error(
      "The worker needs SUPABASE_SECRET_KEY = secret key (sb_secret_…) from Supabase → API Keys. Do not paste the publishable key.",
    );
    await sleep(15_000);
  }
}

async function main() {
  console.log("ProspectDyno worker started");
  assertWorkerEnv();
  await waitForSupabase();

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
