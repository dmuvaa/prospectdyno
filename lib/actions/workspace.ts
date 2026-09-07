"use server";

import { createServerSupabaseClient } from "@prospectdyno/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

export async function createWorkspaceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  if (!name) {
    return { error: "Workspace name is required." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: name,
  });

  if (error || !data) {
    return { error: error?.message ?? "Could not create workspace." };
  }

  await recordAudit(supabase, {
    workspaceId: data.id,
    userId: user.id,
    action: "workspace.created",
    entityType: "workspace",
    entityId: data.id,
  });

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, data.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });

  const destination =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(destination);
}

export async function selectWorkspaceAction(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  redirect("/dashboard");
}
