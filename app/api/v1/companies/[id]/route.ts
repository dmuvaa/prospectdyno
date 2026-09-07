import { NextResponse } from "next/server";
import { requireApiWorkspace } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiWorkspace(_request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ company: data });
}
