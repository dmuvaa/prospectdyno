import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const { supabase, workspace } = await requireWorkspace();

  const [
    { count: icpCount },
    { count: prospectCount },
    { count: opportunityCount },
    { data: recentOpps },
    { data: recentSearches },
  ] = await Promise.all([
    supabase.from("icps").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id).neq("status", "archived"),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("opportunities")
      .select("id, opportunity_score, recommended_angle, company_id, created_at")
      .eq("workspace_id", workspace.id)
      .order("opportunity_score", { ascending: false })
      .limit(5),
    supabase
      .from("searches")
      .select("id, name, status, result_count, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const companyIds = [...new Set((recentOpps ?? []).map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] };
  const companyName = new Map((companies ?? []).map((row) => [row.id, row.name]));

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Workspace"
        title={workspace.name}
        description="Describe who you want, run a search, then work the opportunity feed."
        action={
          <Button asChild variant="ink">
            <Link href="/searches/new">New search</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="ICPs" value={icpCount ?? 0} />
        <Metric label="Prospects" value={prospectCount ?? 0} />
        <Metric label="Opportunities" value={opportunityCount ?? 0} />
        <Metric label="Credits" value={workspace.credit_balance} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top opportunities</CardTitle>
            <CardDescription>Highest scores in this workspace.</CardDescription>
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
                    <span className="font-heading text-2xl">{row.opportunity_score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Run a search to create opportunities.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent searches</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSearches && recentSearches.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentSearches.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/searches/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    <StatusBadge status={row.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No searches yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
