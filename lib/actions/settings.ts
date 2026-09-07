"use server";

import { normalizeDomain } from "@prospectdyno/engine";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { looseSupabase } from "@/lib/supabase-loose";
import { requireWorkspace } from "@/lib/workspace";

export async function addSuppressionAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim() || null;
  const domain = String(formData.get("domain") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!email && !domain) return;

  const { supabase, user, workspace } = await requireWorkspace();
  await looseSupabase(supabase).from("suppression_records").upsert({
    workspace_id: workspace.id,
    email,
    domain,
    normalized_email: email?.toLowerCase() ?? null,
    normalized_domain: normalizeDomain(domain),
    reason,
    created_by: user.id,
  }, { onConflict: email ? "workspace_id,normalized_email" : "workspace_id,normalized_domain" });
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "suppression.added",
    entityType: "suppression_record",
    metadata: { email: Boolean(email), domain: normalizeDomain(domain) },
  });
  revalidatePath("/settings");
}

export async function removeSuppressionAction(id: string): Promise<void> {
  const { supabase, workspace } = await requireWorkspace();
  await supabase
    .from("suppression_records")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "suppression.removed",
    entityType: "suppression_record",
    entityId: id,
  });
  revalidatePath("/settings");
}

export async function updateWorkspaceProfileAction(formData: FormData) {
  const { supabase, workspace, role } = await requireWorkspace();
  if (role !== "owner" && role !== "admin") {
    return { error: "Only owners and admins can update the workspace." };
  }
  const { error } = await supabase
    .from("workspaces")
    .update({
      name: String(formData.get("name") ?? workspace.name).trim() || workspace.name,
      company_name: String(formData.get("company_name") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
    })
    .eq("id", workspace.id);
  if (error) return { error: error.message };
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "workspace.updated",
    entityType: "workspace",
    entityId: workspace.id,
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
