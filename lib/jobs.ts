import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prospectdyno/supabase/types";
import { processJob } from "@/lib/pipeline/run-search";
import { enqueueBullJob } from "@/lib/queue";

export async function enqueueJob(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    jobType: string;
    entityType: string;
    entityId: string;
  },
) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      workspace_id: input.workspaceId,
      job_type: input.jobType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not queue job.");
  }

  // Vercel only records the job. The Render background worker polls Supabase.
  if (process.env.VERCEL) {
    return data.id;
  }

  if (await notifyRenderWorker(data.id)) {
    return data.id;
  }

  const queued = await enqueueBullJob(data.id, input.jobType);
  if (!queued) {
    after(() => {
      void processJob(data.id);
    });
  }

  return data.id;
}

async function notifyRenderWorker(jobId: string) {
  const workerUrl = process.env.WORKER_URL?.trim();
  const secret = process.env.WORKER_SECRET?.trim();
  if (!workerUrl || !secret) return false;

  try {
    const endpoint = new URL("/api/jobs/process", workerUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jobId }),
    });
    return response.ok;
  } catch (error) {
    console.warn(
      "Could not reach a worker HTTP endpoint; job remains pending in Supabase.",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
