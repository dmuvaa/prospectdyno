"use server";

import type { ProspectStatus } from "@prospectdyno/shared";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireWorkspace } from "@/lib/workspace";

export async function updateCompanyStatusAction(companyId: string, status: ProspectStatus) {
  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase
    .from("companies")
    .update({ status })
    .eq("id", companyId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "company.status_updated",
    entityType: "company",
    entityId: companyId,
    metadata: { status },
  });
  revalidatePath("/prospects");
  revalidatePath(`/prospects/${companyId}`);
  return { ok: true };
}

export async function updateCompanyNotesAction(companyId: string, notes: string) {
  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase
    .from("companies")
    .update({ notes })
    .eq("id", companyId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "company.notes_updated",
    entityType: "company",
    entityId: companyId,
  });
  revalidatePath(`/prospects/${companyId}`);
  return { ok: true };
}
