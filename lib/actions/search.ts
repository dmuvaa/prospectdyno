"use server";

import { planSearch } from "@prospectdyno/ai";
import { CREDIT_COSTS, type SearchPlan, type SearchProvider } from "@prospectdyno/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";
import { consumeCredits, idempotencyKey } from "@/lib/metering";
import { requireWorkspace } from "@/lib/workspace";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prospectdyno/supabase/types";

export async function generateSearchPlanAction(icpId: string) {
  const { supabase, user, workspace } = await requireWorkspace();
  const { data: icp, error } = await supabase
    .from("icps")
    .select("id, name, original_prompt, criteria, status")
    .eq("id", icpId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !icp) return { error: "ICP not found." };
  if (icp.status !== "approved") return { error: "Approve the ICP before searching." };

  try {
    const result = await planSearch(icp.original_prompt, icp.criteria);
    await consumeCredits(supabase, {
      workspaceId: workspace.id,
      userId: user.id,
      eventType: "plan_search",
      credits: CREDIT_COSTS.plan_search,
      totalCost: result.usage.costUsd,
      metadata: {
        icp_id: icpId,
        model: result.model,
        provider: result.provider,
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        duration_ms: result.durationMs,
      },
      idempotencyKey: idempotencyKey("plan_search", {
        workspaceId: workspace.id,
        icpId,
        criteria: icp.criteria,
      }),
    });
    return { plan: result.data };
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "Could not build a search plan." };
  }
}

export async function createAndRunSearchAction(input: {
  icpId: string;
  name: string;
  provider: SearchProvider;
  csv?: string;
  urls?: string;
  plan?: SearchPlan;
}) {
  const created = await createSearchJob(input);
  if ("error" in created) return created;
  revalidatePath("/searches");
  redirect(`/searches/${created.id}`);
}

export async function createSearchJob(input: {
  icpId: string;
  name: string;
  provider: SearchProvider;
  csv?: string;
  urls?: string;
  plan?: SearchPlan;
}) {
  const { supabase, user, workspace } = await requireWorkspace();
  return createSearchJobForWorkspace(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    input,
  });
}

export async function createSearchJobForWorkspace(
  supabase: SupabaseClient<Database>,
  context: {
    workspaceId: string;
    userId?: string | null;
    input: {
      icpId: string;
      name: string;
      provider: SearchProvider;
      csv?: string;
      urls?: string;
      plan?: SearchPlan;
    };
  },
) {
  const { input, workspaceId, userId } = context;
  if (!input.csv && !input.urls && input.provider !== "apify") {
    return { error: "Add a CSV, a list of websites, or configure Apify." };
  }

  const { data: search, error } = await supabase
    .from("searches")
    .insert({
      workspace_id: workspaceId,
      icp_id: input.icpId || null,
      name: input.name.trim() || "Untitled search",
      provider: input.provider,
      original_request: input.plan?.summary ?? null,
      strategy: (input.plan ?? {}) as never,
      input: {
        csv: input.csv,
        urls: input.urls,
        queries: input.plan?.queries ?? [],
        locations: input.plan?.locations ?? [],
      },
      status: "queued",
      created_by: userId ?? null,
    })
    .select("id")
    .single();

  if (error || !search) {
    return { error: error?.message ?? "Could not create search." };
  }

  await recordAudit(supabase, {
    workspaceId,
    userId,
    action: "search.created",
    entityType: "search",
    entityId: search.id,
    metadata: { provider: input.provider },
  });

  try {
    await enqueueJob(supabase, {
      workspaceId,
      jobType: "run_search",
      entityType: "search",
      entityId: search.id,
    });
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "Could not queue the search." };
  }

  return { id: search.id };
}

export async function retrySearchAction(searchId: string) {
  const { supabase, workspace } = await requireWorkspace();
  const { data: search } = await supabase
    .from("searches")
    .select("id, status")
    .eq("id", searchId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!search) return { error: "Search not found." };

  await supabase.from("searches").update({ status: "queued", error: null }).eq("id", searchId);
  try {
    await enqueueJob(supabase, {
      workspaceId: workspace.id,
      jobType: "run_search",
      entityType: "search",
      entityId: searchId,
    });
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "Could not queue the search." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/searches");
  revalidatePath(`/searches/${searchId}`);
  return { ok: true };
}
