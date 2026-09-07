import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@prospectdyno/supabase/server";
import { createServiceRoleClient } from "@prospectdyno/supabase/admin";
import { cookies } from "next/headers";
import { hashApiKey } from "@/lib/api-keys";
import { looseSupabase } from "@/lib/supabase-loose";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

type ApiKeyAuthRow = {
  id: string;
  workspace_id: string;
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
};

export async function requireApiWorkspace(request?: Request) {
  const header = request?.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;

  if (bearer?.startsWith("pd_")) {
    const admin = createServiceRoleClient();
    const { data: apiKey, error } = await looseSupabase(admin)
      .from<ApiKeyAuthRow>("api_keys")
      .select("id, workspace_id, scopes, revoked_at, expires_at")
      .eq("key_hash", hashApiKey(bearer))
      .maybeSingle();

    if (error || !apiKey || apiKey.revoked_at) {
      return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() <= Date.now()) {
      return { ok: false as const, response: NextResponse.json({ error: "API key expired" }, { status: 401 }) };
    }

    await looseSupabase(admin)
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id);

    return {
      ok: true as const,
      supabase: admin,
      user: null,
      workspaceId: apiKey.workspace_id,
      role: "api" as const,
      scopes: apiKey.scopes,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspace_id")
    .eq("user_id", user.id);

  const membership =
    memberships?.find((item) => item.workspace_id === selectedId) ?? memberships?.[0];

  if (!membership) {
    return { ok: false as const, response: NextResponse.json({ error: "No workspace" }, { status: 403 }) };
  }

  return {
    ok: true as const,
    supabase,
    user,
    workspaceId: membership.workspace_id,
    role: membership.role,
    scopes: ["*"],
  };
}
