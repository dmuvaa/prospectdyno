import { NextResponse } from "next/server";
import { z } from "zod";
import { apiKeyPrefix, createPlainApiKey, hashApiKey } from "@/lib/api-keys";
import { recordAudit } from "@/lib/audit";
import { requireApiWorkspace } from "@/lib/api";
import { looseSupabase } from "@/lib/supabase-loose";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1),
  scopes: z.array(z.string().trim().min(1)).default(["read", "write"]),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;
  const db = looseSupabase(auth.supabase);

  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ apiKeys: data });
}

export async function POST(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;
  if (!auth.user || auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createApiKeySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid API key payload" }, { status: 400 });
  }

  const key = createPlainApiKey();
  const db = looseSupabase(auth.supabase);
  const { data, error } = await db
    .from<{ id: string; key_prefix: string }>("api_keys")
    .insert({
      workspace_id: auth.workspaceId,
      name: parsed.data.name,
      key_hash: hashApiKey(key),
      key_prefix: apiKeyPrefix(key),
      scopes: parsed.data.scopes,
      expires_at: parsed.data.expiresAt ?? null,
      created_by: auth.user?.id ?? null,
    })
    .select("id, key_prefix")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not create API key" }, { status: 400 });
  }

  await recordAudit(auth.supabase, {
    workspaceId: auth.workspaceId,
    userId: auth.user?.id,
    action: "api_key.created",
    entityType: "api_key",
    entityId: data.id,
    metadata: { scopes: parsed.data.scopes },
  });

  return NextResponse.json({ id: data.id, key, keyPrefix: data.key_prefix }, { status: 201 });
}
