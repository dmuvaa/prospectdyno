import Link from "next/link";
import { notFound } from "next/navigation";
import { RetrySearchButton } from "@/components/retry-search";
import { RefreshWhile } from "@/components/refresh-while";
import { SearchLivePanel } from "@/components/search-live";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { SearchActivityStep } from "@/lib/search-activity";
import { looseSupabase } from "@/lib/supabase-loose";
import { requireWorkspace } from "@/lib/workspace";

export default async function SearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const { data: search } = await supabase
    .from("searches")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!search) notFound();

  const [{ data: results }, { data: opportunities }, { data: jobs }] = await Promise.all([
    supabase.from("search_results").select("company_id").eq("search_id", id),
    supabase
      .from("opportunities")
      .select("id, company_id, opportunity_score, recommended_angle, status")
      .eq("workspace_id", workspace.id)
      .eq("search_id", id),
    supabase
      .from("jobs")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const companyIds = (results ?? []).map((row) => row.company_id);
  const { data: companies } = companyIds.length
    ? await supabase
        .from("companies")
        .select("id, name, domain, status, created_at")
        .in("id", companyIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const jobIds = (jobs ?? []).map((job) => job.id);
  const { data: runs } = jobIds.length
    ? await db
        .from<Array<{ id: string }>>("agent_runs")
        .select("id")
        .eq("workspace_id", workspace.id)
        .in("job_id", jobIds)
    : { data: [] };

  const runIds = (runs ?? []).map((run) => run.id);
  const { data: rawSteps } = runIds.length
    ? await db
        .from<SearchActivityStep[]>("agent_steps")
        .select("id, step_type, tool_name, status, error, created_at, input, output")
        .eq("workspace_id", workspace.id)
        .in("agent_run_id", runIds)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [] };

  const steps = (rawSteps ?? []).map((step) => ({
    ...step,
    input: (step.input ?? null) as SearchActivityStep["input"],
    output: (step.output ?? null) as SearchActivityStep["output"],
  }));

  const opportunityByCompany = new Map((opportunities ?? []).map((row) => [row.company_id, row]));
  const companyRows = (companies ?? []).map((company) => {
    const opportunity = opportunityByCompany.get(company.id);
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      status: opportunity?.status ?? company.status,
      score: opportunity?.opportunity_score ?? null,
      angle: opportunity?.recommended_angle ?? null,
      opportunityId: opportunity?.id ?? null,
    };
  });

  const running = search.status === "queued" || search.status === "running";
  const canRetry = search.status === "failed" || search.status === "queued" || search.status === "cancelled";

  return (
    <div className="space-y-6">
      <RefreshWhile active={running} intervalMs={1500} />
      <PageHeader
        crumbs={[
          { href: "/searches", label: "History" },
          { label: search.name },
        ]}
        kicker={search.provider}
        title={search.name}
        description={search.original_request ?? "Discovery run"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={search.status} />
            {canRetry ? <RetrySearchButton searchId={search.id} /> : null}
            {search.icp_id ? (
              <Button asChild variant="outline">
                <Link href={`/icps/${search.icp_id}`}>Open brief</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      {search.error ? <p className="text-sm text-destructive">{search.error}</p> : null}
      <p className="text-sm text-muted-foreground">Started {formatDate(search.created_at)}</p>

      <SearchLivePanel
        status={search.status}
        running={running}
        resultCount={search.result_count}
        opportunityCount={search.opportunity_count}
        steps={steps}
        companies={companyRows}
      />
    </div>
  );
}
