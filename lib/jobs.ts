import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prospectdyno/supabase/types";
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

  await enqueueBullJob(data.id, input.jobType);

  return data.id;
}
