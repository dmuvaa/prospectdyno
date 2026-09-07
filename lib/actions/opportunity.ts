"use server";

import { personalizeMessage } from "@prospectdyno/ai";
import { CREDIT_COSTS, type ProspectStatus } from "@prospectdyno/shared";
import { normalizeDomain } from "@prospectdyno/engine";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { consumeCredits } from "@/lib/metering";
import { looseSupabase } from "@/lib/supabase-loose";
import { requireWorkspace } from "@/lib/workspace";

export async function updateOpportunityStatusAction(opportunityId: string, status: ProspectStatus) {
  const { supabase, workspace } = await requireWorkspace();
  const { data: row, error } = await supabase
    .from("opportunities")
    .update({ status })
    .eq("id", opportunityId)
    .eq("workspace_id", workspace.id)
    .select("company_id")
    .single();
  if (error) return { error: error.message };
  if (row?.company_id) {
    await supabase
      .from("companies")
      .update({ status })
      .eq("id", row.company_id)
      .eq("workspace_id", workspace.id);
  }
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "opportunity.status_updated",
    entityType: "opportunity",
    entityId: opportunityId,
    metadata: { status },
  });
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunityId}`);
  return { ok: true };
}

export async function generateMessageAction(opportunityId: string) {
  const { supabase, user, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !opportunity) return { error: "Opportunity not found." };

  const [{ data: company }, { data: evidence }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", opportunity.company_id).single(),
    supabase
      .from("evidence_records")
      .select("claim, evidence, source_url, confidence")
      .eq("opportunity_id", opportunityId)
      .eq("workspace_id", workspace.id),
  ]);

  const normalizedDomain = normalizeDomain(company?.domain ?? company?.website);
  if (normalizedDomain) {
    const { data: suppression } = await db
      .from<{ id: string }>("suppression_records")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("normalized_domain", normalizedDomain)
      .maybeSingle();
    if (suppression) {
      return { error: "This company is suppressed for this workspace." };
    }
  }

  try {
    const result = await personalizeMessage({
      company,
      report: opportunity.report,
      evidence: evidence ?? [],
    });

    const { data: message, error: messageError } = await db
      .from<{ id: string }>("messages")
      .insert({
        workspace_id: workspace.id,
        company_id: opportunity.company_id,
        opportunity_id: opportunityId,
        opening_line: result.data.opening_line,
        angle: result.data.angle,
        cta: result.data.cta,
        body: result.data.body,
        evidence: result.data.claims_used,
        created_by: user.id,
        generated_by: user.id,
        provider: result.provider,
        model: result.model,
        prompt_version: "personalize-v1",
        token_usage: result.usage,
        cost: result.usage.costUsd,
      })
      .select("id")
      .single();

    if (messageError || !message) {
      return { error: messageError?.message ?? "Could not save the draft." };
    }

    await consumeCredits(supabase, {
      workspaceId: workspace.id,
      userId: user.id,
      eventType: "personalization",
      credits: CREDIT_COSTS.personalization,
      totalCost: result.usage.costUsd,
      metadata: { opportunity_id: opportunityId, model: result.model, provider: result.provider },
      idempotencyKey: `personalization:${message.id}`,
    });

    await recordAudit(supabase, {
      workspaceId: workspace.id,
      userId: user.id,
      action: "message.generated",
      entityType: "message",
      entityId: message.id,
      metadata: { opportunity_id: opportunityId },
    });

    revalidatePath(`/opportunities/${opportunityId}`);
    return { messageId: message.id };
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "Could not generate a message." };
  }
}
