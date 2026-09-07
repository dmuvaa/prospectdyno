"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireWorkspace } from "@/lib/workspace";

export async function createListAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { supabase, user, workspace } = await requireWorkspace();
  const { data, error } = await supabase
    .from("lists")
    .insert({
      workspace_id: workspace.id,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return;
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "list.created",
    entityType: "list",
    entityId: data.id,
  });
  revalidatePath("/lists");
  redirect(`/lists/${data.id}`);
}

export async function addToListAction(listId: string, companyId: string) {
  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase.from("list_members").upsert({
    list_id: listId,
    company_id: companyId,
    workspace_id: workspace.id,
  });
  if (error) return { error: error.message };
  await supabase
    .from("companies")
    .update({ status: "SAVED" })
    .eq("id", companyId)
    .eq("workspace_id", workspace.id);
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "list.member_added",
    entityType: "list",
    entityId: listId,
    metadata: { company_id: companyId },
  });
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  revalidatePath(`/prospects/${companyId}`);
  return { ok: true };
}

export async function removeFromListAction(listId: string, companyId: string): Promise<void> {
  const { supabase, workspace } = await requireWorkspace();
  await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("company_id", companyId)
    .eq("workspace_id", workspace.id);
  await recordAudit(supabase, {
    workspaceId: workspace.id,
    action: "list.member_removed",
    entityType: "list",
    entityId: listId,
    metadata: { company_id: companyId },
  });
  revalidatePath(`/lists/${listId}`);
}
