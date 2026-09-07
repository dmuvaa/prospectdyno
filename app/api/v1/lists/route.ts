import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkspace } from "@/lib/api";

const createListSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("lists")
    .select("id, name, description, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lists: data });
}

export async function POST(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;
  const parsed = createListSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid list payload" }, { status: 400 });
  }
  const body = parsed.data;
  const { data, error } = await auth.supabase
    .from("lists")
    .insert({
      workspace_id: auth.workspaceId,
      name: body.name,
      description: body.description?.trim() || null,
      created_by: auth.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
