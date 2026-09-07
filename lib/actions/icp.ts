"use server";

import { interpretIcp } from "@prospectdyno/ai";
import type { IcpInterpretation } from "@prospectdyno/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { consumeCredits } from "@/lib/metering";
import { requireWorkspace } from "@/lib/workspace";

export async function interpretAndCreateIcp(prompt: string) {
  const trimmed = prompt.trim();
  if (trimmed.length < 8) {
    return { error: "Describe who you are looking for in a bit more detail." };
  }

  const { supabase, user, workspace } = await requireWorkspace();

  let result;
  try {
    result = await interpretIcp(trimmed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not interpret this ICP.";
    return { error: message };
  }

  const { data: icp, error } = await supabase
    .from("icps")
    .insert({
      workspace_id: workspace.id,
      name: result.data.name || "Untitled ICP",
      original_prompt: trimmed,
      interpretation: result.data,
      criteria: result.data,
      custom_criteria: result.data.custom_criteria,
      status: "pending_review",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !icp) {
    return { error: error?.message ?? "Could not save the ICP." };
  }

  await consumeCredits(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    eventType: "interpret_icp",
    credits: 1,
    unitCost: result.usage.costUsd,
    totalCost: result.usage.costUsd,
    metadata: {
      model: result.model,
      provider: result.provider,
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      duration_ms: result.durationMs,
      icp_id: icp.id,
    },
    idempotencyKey: `interpret_icp:${icp.id}`,
  });

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "icp.created",
    entityType: "icp",
    entityId: icp.id,
  });

  redirect(`/icps/${icp.id}`);
}

export async function saveIcpAction(
  icpId: string,
  input: {
    name: string;
    criteria: IcpInterpretation;
    status: "pending_review" | "approved";
  },
) {
  const { supabase, user, workspace } = await requireWorkspace();

  const { data: existing, error: existingError } = await supabase
    .from("icps")
    .select("id, original_prompt")
    .eq("id", icpId)
    .eq("workspace_id", workspace.id)
    .single();

  if (existingError || !existing) {
    return { error: "ICP not found." };
  }

  const { error } = await supabase
    .from("icps")
    .update({
      name: input.name.trim() || "Untitled ICP",
      criteria: input.criteria,
      custom_criteria: input.criteria.custom_criteria,
      status: input.status,
    })
    .eq("id", icpId)
    .eq("workspace_id", workspace.id);

  if (error) {
    return { error: error.message };
  }

  if (input.status === "approved") {
    const { data: versions } = await supabase
      .from("icp_versions")
      .select("version")
      .eq("icp_id", icpId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = (versions?.[0]?.version ?? 0) + 1;

    await supabase.from("icp_versions").insert({
      icp_id: icpId,
      workspace_id: workspace.id,
      version: nextVersion,
      original_prompt: existing.original_prompt,
      interpretation: input.criteria,
      criteria: input.criteria,
      created_by: user.id,
    });
  }

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: input.status === "approved" ? "icp.approved" : "icp.updated",
    entityType: "icp",
    entityId: icpId,
  });

  revalidatePath("/icps");
  revalidatePath(`/icps/${icpId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveIcpAction(icpId: string) {
  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase
    .from("icps")
    .update({ status: "archived" })
    .eq("id", icpId)
    .eq("workspace_id", workspace.id);

  if (error) {
    return { error: error.message };
  }

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "icp.archived",
    entityType: "icp",
    entityId: icpId,
  });

  revalidatePath("/icps");
  revalidatePath("/dashboard");
  redirect("/icps");
}
