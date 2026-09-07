import { NextResponse } from "next/server";
import { loadSearchLiveSnapshot } from "@/lib/search-live-data";
import { requireWorkspace } from "@/lib/workspace";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { supabase, workspace } = await requireWorkspace();
  const snapshot = await loadSearchLiveSnapshot(supabase, workspace.id, id);
  if (!snapshot) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  return NextResponse.json(snapshot);
}
