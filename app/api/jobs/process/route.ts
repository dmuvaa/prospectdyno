import { NextResponse } from "next/server";
import { claimNextJob, processJob } from "@/lib/pipeline/run-search";
import { createAdminClient } from "@prospectdyno/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "WORKER_SECRET is not configured" }, { status: 500 });
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { jobId?: string };
  if (body.jobId) {
    await processJob(body.jobId);
    return NextResponse.json({ ok: true, jobId: body.jobId });
  }

  const admin = createAdminClient();
  const processed: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const job = await claimNextJob(admin, "api-job-processor");
    if (!job) break;
    await processJob(job.id, { alreadyClaimed: true });
    processed.push(job.id);
  }

  return NextResponse.json({ ok: true, processed });
}
