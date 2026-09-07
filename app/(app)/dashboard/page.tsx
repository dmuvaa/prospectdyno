import Link from "next/link";
import { HuntComposer } from "@/components/hunt-composer";
import { InboxActions } from "@/components/inbox-actions";
import { RefreshWhile } from "@/components/refresh-while";
import { RetrySearchButton } from "@/components/retry-search";
import { StopHuntButton } from "@/components/stop-hunt";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { INBOX_PROSPECT_STATUSES } from "@prospectdyno/shared";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; icpId?: string }>;
}) {
  const { q, icpId } = await searchParams;
  const { supabase, workspace } = await requireWorkspace();

  const [
    { data: icps },
    { data: pendingIcps },
    { data: failedSearches },
    { data: activeSearches },
    { data: recentSearches },
    { data: inbox },
    { count: opportunityCount },
    { count: prospectCount },
  ] = await Promise.all([
    supabase
      .from("icps")
      .select("id, name, status")
      .eq("workspace_id", workspace.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(20),
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
      .from("searches")
      .select("id, name, status, result_count, opportunity_count, updated_at")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("opportunities")
      .select("id, company_id, opportunity_score, recommended_angle, why, status")
      .eq("workspace_id", workspace.id)
      .in("status", [...INBOX_PROSPECT_STATUSES])
      .order("opportunity_score", { ascending: false })
      .limit(8),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);

  const companyIds = [...new Set((inbox ?? []).map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, domain").in("id", companyIds)
    : { data: [] };
  const companyName = new Map((companies ?? []).map((row) => [row.id, row]));
  const polling = (activeSearches ?? []).length > 0;
  const hasAttention = (failedSearches ?? []).length > 0 || (pendingIcps ?? []).length > 0;

  return (
    <div className="space-y-8">
      <RefreshWhile active={polling} intervalMs={1500} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-800">Run</p>
          <h1 className="font-heading mt-1 text-4xl">{workspace.name}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Describe who you want. ProspectDyno finds companies, scores them, and puts the best in your inbox.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {prospectCount ?? 0} companies · {opportunityCount ?? 0} opportunities · {workspace.credit_balance} credits
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a hunt</CardTitle>
          <CardDescription>
            One brief in, a live search out. Review and keep the companies worth working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HuntComposer icps={icps ?? []} defaultPrompt={q ?? ""} defaultIcpId={icpId ?? ""} />
        </CardContent>
      </Card>

      {polling || hasAttention ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {polling ? (
            <Card>
              <CardHeader>
                <CardTitle>Live hunts</CardTitle>
                <CardDescription>Companies appear as the worker finds and scores them.</CardDescription>
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
                          {search.result_count} found · {search.opportunity_count} scored
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={search.status} />
                        <StopHuntButton searchId={search.id} compact />
                      </div>
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
              </CardHeader>
              <CardContent className="space-y-4">
                {(failedSearches ?? []).map((search) => (
                  <div key={search.id} className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/searches/${search.id}`} className="font-medium hover:underline">
                        {search.name}
                      </Link>
                      <p className="text-sm text-destructive">{search.error ?? "Hunt failed"}</p>
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

      {(recentSearches ?? []).length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Recent hunts</CardTitle>
              <CardDescription>Every company from a hunt is saved before scoring starts.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/searches">Open history</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(recentSearches ?? []).map((search) => (
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

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>Keep the fits. Skip the rest. Drafts stay in the opportunity report.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/opportunities">Open inbox</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {inbox && inbox.length > 0 ? (
            <ul className="divide-y divide-border">
              {inbox.map((row) => {
                const company = companyName.get(row.company_id);
                const why = Array.isArray(row.why) ? (row.why as string[]) : [];
                return (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <Link href={`/opportunities/${row.id}`} className="font-medium hover:underline">
                        {company?.name ?? "Company"}
                      </Link>
                      <p className="text-sm text-muted-foreground">{company?.domain}</p>
                      <p className="mt-1 text-sm">{row.recommended_angle}</p>
                      {why[0] ? <p className="mt-1 text-sm text-muted-foreground">{why[0]}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-heading text-3xl">{row.opportunity_score}</p>
                      <InboxActions opportunityId={row.id} showOpen={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No companies waiting. Start a hunt and they will land here as they are scored.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
