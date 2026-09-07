import { createServerSupabaseClient } from "@prospectdyno/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@prospectdyno/supabase/types";

export const WORKSPACE_COOKIE = "pd-workspace-id";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceRole = Database["public"]["Tables"]["workspace_members"]["Row"]["role"];

export async function getUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function getWorkspaceContext() {
  const { supabase, user } = await requireUser();
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const { data: memberRows, error: memberError } = await supabase
    .from("workspace_members")
    .select("role, workspace_id")
    .eq("user_id", user.id);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const workspaceIds = (memberRows ?? []).map((row) => row.workspace_id);
  if (workspaceIds.length === 0) {
    return { supabase, user, memberships: [], workspace: null, role: null };
  }

  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds);

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  const workspaceById = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const memberships = (memberRows ?? [])
    .map((row) => {
      const workspace = workspaceById.get(row.workspace_id);
      if (!workspace) return null;
      return { role: row.role, workspace };
    })
    .filter((row): row is { role: WorkspaceRole; workspace: Workspace } => row !== null);

  if (memberships.length === 0) {
    return { supabase, user, memberships, workspace: null, role: null };
  }

  const selected =
    memberships.find((item) => item.workspace.id === selectedId) ?? memberships[0]!;

  return {
    supabase,
    user,
    memberships,
    workspace: selected.workspace,
    role: selected.role,
  };
}

export async function requireWorkspace() {
  const context = await getWorkspaceContext();
  if (!context.workspace || !context.role) {
    redirect("/onboarding");
  }
  return {
    supabase: context.supabase,
    user: context.user,
    memberships: context.memberships,
    workspace: context.workspace,
    role: context.role,
  };
}
