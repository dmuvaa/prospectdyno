import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireWorkspace } from "@/lib/workspace";

export default async function OpportunitiesPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, company_id, opportunity_score, fit_score, recommended_angle, recommended_service, why, status")
    .eq("workspace_id", workspace.id)
    .order("opportunity_score", { ascending: false });

  const companyIds = [...new Set((opportunities ?? []).map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, domain, country").in("id", companyIds)
    : { data: [] };
  const byId = new Map((companies ?? []).map((row) => [row.id, row]));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Feed"
        title="Opportunities"
        description="High-priority companies with a reason to engage — not a dump of raw leads."
      />
      {opportunities && opportunities.length > 0 ? (
        <ul className="space-y-3">
          {opportunities.map((row) => {
            const company = byId.get(row.company_id);
            const why = Array.isArray(row.why) ? (row.why as string[]) : [];
            return (
              <li key={row.id}>
                <Link
                  href={`/opportunities/${row.id}`}
                  className="block rounded-xl border border-border bg-card p-5 shadow-sm hover:border-teal-700/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-medium">{company?.name ?? "Company"}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {company?.domain} {company?.country ? `· ${company.country}` : ""}
                      </p>
                      <p className="mt-2 text-sm">{row.recommended_angle}</p>
                      {why[0] ? <p className="mt-2 text-sm text-muted-foreground">{why[0]}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-4xl">{row.opportunity_score}</p>
                      <StatusBadge status={row.status} />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No opportunities yet"
          description="Qualify companies against an ICP to fill this feed."
          href="/searches/new"
          cta="Run a search"
        />
      )}
    </div>
  );
}
