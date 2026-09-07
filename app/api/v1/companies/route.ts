import { NextResponse } from "next/server";
import { requireApiWorkspace } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = auth.supabase
    .from("companies")
    .select("id, name, domain, website, country, industry, status, employee_count, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq(
      "status",
      status as
        | "NEW"
        | "RESEARCHING"
        | "QUALIFIED"
        | "SAVED"
        | "CONTACTED"
        | "REPLIED"
        | "INTERESTED"
        | "MEETING"
        | "CUSTOMER"
        | "NOT_INTERESTED"
        | "SUPPRESSED",
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ companies: data });
}
