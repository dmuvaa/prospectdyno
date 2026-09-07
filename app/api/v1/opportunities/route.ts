import { NextResponse } from "next/server";
import { requireApiWorkspace } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("opportunities")
    .select("id, company_id, opportunity_score, fit_score, recommended_angle, status, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("opportunity_score", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ opportunities: data });
}
