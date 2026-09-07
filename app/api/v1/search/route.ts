import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkspace } from "@/lib/api";
import { createSearchJobForWorkspace } from "@/lib/actions/search";

const createSearchSchema = z.object({
  icpId: z.string().uuid().optional(),
  name: z.string().trim().min(1).optional(),
  provider: z.enum(["apify", "csv", "website", "manual"]).optional(),
  csv: z.string().optional(),
  urls: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("searches")
    .select("id, name, provider, status, result_count, opportunity_count, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ searches: data });
}

export async function POST(request: Request) {
  const auth = await requireApiWorkspace(request);
  if (!auth.ok) return auth.response;

  const parsed = createSearchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search payload" }, { status: 400 });
  }
  const body = parsed.data;

  const result = await createSearchJobForWorkspace(auth.supabase, {
    workspaceId: auth.workspaceId,
    userId: auth.user?.id ?? null,
    input: {
      icpId: body.icpId ?? "",
      name: body.name ?? "API search",
      provider: body.provider ?? (body.csv ? "csv" : "website"),
      csv: body.csv,
      urls: body.urls,
    },
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
