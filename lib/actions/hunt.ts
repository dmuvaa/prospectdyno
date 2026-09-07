"use server";

import { interpretIcp, planSearch } from "@prospectdyno/ai";
import { isApifyConfigured } from "@prospectdyno/engine";
import { CREDIT_COSTS, type SearchPlan, type SearchProvider } from "@prospectdyno/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { createSearchJobForWorkspace } from "@/lib/actions/search";
import { consumeCredits, idempotencyKey } from "@/lib/metering";
import { requireWorkspace } from "@/lib/workspace";

export async function startHuntAction(input: {
  prompt: string;
  urls?: string;
  icpId?: string;
}) {
  const prompt = input.prompt.trim();
  const urls = input.urls?.trim() || undefined;
  const { supabase, user, workspace } = await requireWorkspace();

  let icpId = input.icpId?.trim() || "";
  let icpName = "Hunt";
  let originalPrompt = prompt;
  let criteria: unknown = {};

  if (icpId) {
    const { data: icp, error } = await supabase
      .from("icps")
      .select("id, name, original_prompt, criteria, status")
      .eq("id", icpId)
      .eq("workspace_id", workspace.id)
      .single();
    if (error || !icp) return { error: "Saved brief not found." };
    icpName = icp.name;
    originalPrompt = icp.original_prompt;
    criteria = icp.criteria;
    if (icp.status !== "approved") {
      await supabase
        .from("icps")
        .update({ status: "approved" })
        .eq("id", icp.id)
        .eq("workspace_id", workspace.id);
    }
  } else {
    if (prompt.length < 8) {
      return { error: "Describe who you want in a bit more detail." };
    }
    let interpreted;
    try {
      interpreted = await interpretIcp(prompt);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not interpret this brief." };
    }

    const { data: icp, error } = await supabase
      .from("icps")
      .insert({
        workspace_id: workspace.id,
        name: interpreted.data.name || "Untitled brief",
        original_prompt: prompt,
        interpretation: interpreted.data,
        criteria: interpreted.data,
        custom_criteria: interpreted.data.custom_criteria,
        status: "approved",
        created_by: user.id,
      })
      .select("id, name")
      .single();

    if (error || !icp) return { error: error?.message ?? "Could not save the brief." };

    await supabase.from("icp_versions").insert({
      icp_id: icp.id,
      workspace_id: workspace.id,
      version: 1,
      original_prompt: prompt,
      interpretation: interpreted.data,
      criteria: interpreted.data,
      created_by: user.id,
    });

    try {
      await consumeCredits(supabase, {
        workspaceId: workspace.id,
        userId: user.id,
        eventType: "interpret_icp",
        credits: CREDIT_COSTS.interpret_icp,
        unitCost: interpreted.usage.costUsd,
        totalCost: interpreted.usage.costUsd,
        metadata: { icp_id: icp.id, model: interpreted.model, provider: interpreted.provider },
        idempotencyKey: `interpret_icp:${icp.id}`,
      });
    } catch (error) {
      console.warn("Could not meter interpret_icp:", error instanceof Error ? error.message : error);
    }

    icpId = icp.id;
    icpName = icp.name;
    criteria = interpreted.data;
  }

  let provider: SearchProvider = "website";
  let plan: SearchPlan | undefined;

  if (urls) {
    provider = "website";
  } else if (isApifyConfigured()) {
    provider = "apify";
    try {
      const planned = await planSearch(originalPrompt, criteria);
      plan = planned.data;
      try {
        await consumeCredits(supabase, {
          workspaceId: workspace.id,
          userId: user.id,
          eventType: "plan_search",
          credits: CREDIT_COSTS.plan_search,
          totalCost: planned.usage.costUsd,
          metadata: { icp_id: icpId, model: planned.model, provider: planned.provider },
          idempotencyKey: idempotencyKey("plan_search", { workspaceId: workspace.id, icpId, criteria }),
        });
      } catch (error) {
        console.warn("Could not meter plan_search:", error instanceof Error ? error.message : error);
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not plan the hunt." };
    }
  } else {
    return {
      error: "Paste websites or domains to hunt. Automatic discovery needs Apify on the worker.",
      icpId,
    };
  }

  const created = await createSearchJobForWorkspace(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    input: {
      icpId,
      name: plan?.name || icpName,
      provider,
      urls,
      plan,
    },
  });

  if ("error" in created) return created;

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "hunt.started",
    entityType: "search",
    entityId: created.id,
    metadata: { provider, icp_id: icpId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/searches");
  revalidatePath("/opportunities");
  redirect(`/searches/${created.id}`);
}
