import { NextResponse } from "next/server";
import { requireApiWorkspace } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("usage_events")
    .select("event_type, credits, total_cost, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ usage: data });
}
