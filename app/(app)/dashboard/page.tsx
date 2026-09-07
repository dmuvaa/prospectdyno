import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RetrySearchButton } from "@/components/retry-search";
import { RefreshWhile } from "@/components/refresh-while";
import { StatusBadge } from "@/components/status-badge";
import { formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const { supabase, workspace } = await requireWorkspace();

  const [
    { count: icpCount },
    { count: approvedIcpCount },
    { count: prospectCount },
    { count: opportunityCount },
    { data: pendingIcps },
    { data: failedSearches },
    { data: activeSearches },
    { data: recentOpps },
    { data: recentSearches },
    { data: recentJobs },
  ] = await Promise.all([
    supabase.from("icps").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id).neq("status", "archived"),
    supabase.from("icps").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "approved"),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("icps")
      .select("id, name, status")
      .eq("workspace_id", workspace.id)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("searches")
      .select("id, name, error, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("searches")
      .select("id, name, status, result_count, opportunity_count, updated_at")
      .eq("workspace_id", workspace.id)
      .in("status", ["queued", "running"])
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("opportunities")
      .select("id, opportunity_score, recommended_angle, company_id, created_at, status")
      .eq("workspace_id", workspace.id)
      .order("opportunity_score", { ascending: false })
      .limit(6),
    supabase
      .from("searches")
      .select("id, name, status, result_count, opportunity_count, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("jobs")
      .select("id, job_type, status, error, created_at, entity_id")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const companyIds = [...new Set((recentOpps ?? []).map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] };
  const companyName = new Map((companies ?? []).map((row) => [row.id, row.name]));

  const steps = [
    { done: (icpCount ?? 0) > 0, label: "Describe an ICP", href: "/icps/new" },
    { done: (approvedIcpCount ?? 0) > 0, label: "Confirm the ICP", href: "/icps" },
    { done: (recentSearches ?? []).length > 0, label: "Run a search", href: "/searches/new" },
    { done: (opportunityCount ?? 0) > 0, label: "Work the opportunity feed", href: "/opportunities" },
  ];
  const nextStep = steps.find((step) => !step.done);
  const hasAttention = (failedSearches ?? []).length > 0 || (pendingIcps ?? []).length > 0;
  const polling = (activeSearches ?? []).length > 0;

  return (
    <div className="space-y-8">
      <RefreshWhile active={polling} intervalMs={1500} />
      <PageHeader
        kicker="Workspace"
        title={workspace.name}
        description="Find companies, qualify them against your ICP, then work the highest-scoring opportunities."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/icps/new">New ICP</Link>
            </Button>
            <Button asChild variant="ink">
              <Link href="/searches/new">New search</Link>
            </Button>
          </div>
        }
      />

      {nextStep ? (
        <Card className="border-teal-700/30 bg-teal-50/40">
          <CardHeader>
            <CardTitle>Next step</CardTitle>
            <CardDescription>Finish setup so searches have something to score against.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <ol className="space-y-2 text-sm">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-2">
                  {step.done ? (
                    <CheckCircle2 className="size-4 text-teal-700" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  <span className={step.done ? "text-muted-foreground line-through" : "font-medium"}>{step.label}</span>
                </li>
              ))}
            </ol>
            <Button asChild variant="ink">
              <Link href={nextStep.href}>
                {nextStep.label}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric href="/icps" label="ICPs" value={icpCount ?? 0} hint="Customer definitions" />
        <Metric href="/prospects" label="Prospects" value={prospectCount ?? 0} hint="Normalized companies" />
        <Metric href="/opportunities" label="Opportunities" value={opportunityCount ?? 0} hint="Qualified to work" />
        <Metric href="/settings#usage" label="Credits" value={workspace.credit_balance} hint="Workspace balance" />
      </div>

      {hasAttention || polling ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {polling ? (
            <Card>
              <CardHeader>
                <CardTitle>In progress</CardTitle>
                <CardDescription>Open a search to watch companies appear as they are found.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {(activeSearches ?? []).map((search) => (
                    <li key={search.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <Link href={`/searches/${search.id}`} className="font-medium hover:underline">
                          {search.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {search.result_count} companies · {search.opportunity_count} opportunities
                        </p>
                      </div>
                      <StatusBadge status={search.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {hasAttention ? (
            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
                <CardDescription>Retry failed runs or confirm ICPs waiting for review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(failedSearches ?? []).map((search) => (
                  <div key={search.id} className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/searches/${search.id}`} className="font-medium hover:underline">
                        {search.name}
                      </Link>
                      <p className="text-sm text-destructive">{search.error ?? "Search failed"}</p>
                    </div>
                    <RetrySearchButton searchId={search.id} compact />
                  </div>
                ))}
                {(pendingIcps ?? []).map((icp) => (
                  <div key={icp.id} className="flex items-center justify-between gap-3">
                    <Link href={`/icps/${icp.id}`} className="font-medium hover:underline">
                      {icp.name}
                    </Link>
                    <StatusBadge status={icp.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Top opportunities</CardTitle>
              <CardDescription>Highest scores in this workspace.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/opportunities">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOpps && recentOpps.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentOpps.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/opportunities/${row.id}`} className="font-medium hover:underline">
                        {companyName.get(row.company_id) ?? "Company"}
                      </Link>
                      <p className="text-sm text-muted-foreground">{row.recommended_angle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-2xl">{row.opportunity_score}</p>
                      <StatusBadge status={row.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Run a search to create opportunities.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Recent searches</CardTitle>
              <CardDescription>Retry any that failed without leaving the dashboard.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/searches">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSearches && recentSearches.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentSearches.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/searches/${row.id}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {row.result_count} companies · {row.opportunity_count} opportunities · {formatRelative(row.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      {row.status === "failed" ? <RetrySearchButton searchId={row.id} compact /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No searches yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job activity</CardTitle>
          <CardDescription>Background work claimed by the Render worker.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentJobs && recentJobs.length > 0 ? (
            <ul className="divide-y divide-border">
              {recentJobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{job.job_type.replaceAll("_", " ")}</p>
                    <p className="text-muted-foreground">
                      {formatRelative(job.created_at)}
                      {job.error ? ` · ${job.error}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={job.status} />
                    {job.status === "failed" && job.job_type === "run_search" && job.entity_id ? (
                      <RetrySearchButton searchId={job.entity_id} compact />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No jobs yet. Start a search to enqueue work.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:border-teal-700/40">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl">{value}</CardTitle>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardHeader>
      </Card>
    </Link>
  );
}
