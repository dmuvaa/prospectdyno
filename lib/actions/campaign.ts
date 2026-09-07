"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { looseSupabase } from "@/lib/supabase-loose";
import { requireWorkspace } from "@/lib/workspace";

type CampaignChannel = "email" | "crm" | "csv" | "api" | "manual" | "export";

export async function createCampaignAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const listId = String(formData.get("list_id") ?? "").trim() || null;
  const objective = String(formData.get("objective") ?? "").trim() || null;
  const channel = (String(formData.get("channel") ?? "export") || "export") as CampaignChannel;
  const tone = String(formData.get("tone") ?? "").trim() || null;
  const cta = String(formData.get("cta") ?? "").trim() || null;

  if (!name) return;

  const { supabase, user, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const { data: campaign, error } = await db
    .from<{ id: string }>("campaigns")
    .insert({
      workspace_id: workspace.id,
      list_id: listId,
      name,
      objective,
      channel,
      tone,
      cta,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !campaign) return;

  if (listId) {
    const { data: members } = await supabase
      .from("list_members")
      .select("company_id")
      .eq("workspace_id", workspace.id)
      .eq("list_id", listId);

    const rows = (members ?? []).map((member) => ({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      company_id: member.company_id,
      status: "NEW",
    }));

    if (rows.length > 0) {
      await db.from("campaign_leads").upsert(rows, {
        onConflict: "campaign_id,company_id",
      });
    }
  }

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaign.id,
    metadata: { channel, list_id: listId },
  });

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaignStatusAction(
  campaignId: string,
  status: "draft" | "active" | "paused" | "completed" | "archived",
) {
  const { supabase, user, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const { error } = await db
    .from("campaigns")
    .update({ status })
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "campaign.status_updated",
    entityType: "campaign",
    entityId: campaignId,
    metadata: { status },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true };
}
