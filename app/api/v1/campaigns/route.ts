import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkspace } from "@/lib/api";
import { looseSupabase } from "@/lib/supabase-loose";

const createCampaignSchema = z.object({
  name: z.string().trim().min(1),
  listId: z.string().uuid().optional(),
  objective: z.string().trim().optional(),
  channel: z.enum(["email", "crm", "csv", "api", "manual", "export"]).default("export"),
  tone: z.string().trim().optional(),
  cta: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;
  const db = looseSupabase(auth.supabase);

  const { data, error } = await db
    .from("campaigns")
    .select("id, name, objective, channel, status, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaigns: data });
}

export async function POST(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const parsed = createCampaignSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign payload" }, { status: 400 });
  }

  const db = looseSupabase(auth.supabase);
  const { data, error } = await db
    .from<{ id: string }>("campaigns")
    .insert({
      workspace_id: auth.workspaceId,
      list_id: parsed.data.listId ?? null,
      name: parsed.data.name,
      objective: parsed.data.objective ?? null,
      channel: parsed.data.channel,
      tone: parsed.data.tone ?? null,
      cta: parsed.data.cta ?? null,
      created_by: auth.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not create campaign" }, { status: 400 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
