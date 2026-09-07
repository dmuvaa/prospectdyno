import Link from "next/link";
import { PROSPECT_STATUSES, type ProspectStatus } from "@prospectdyno/shared";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { searchTerm } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const term = searchTerm(q);
  const { supabase, workspace } = await requireWorkspace();
  let query = supabase
    .from("opportunities")
    .select("id, company_id, opportunity_score, fit_score, recommended_angle, recommended_service, why, status")
    .eq("workspace_id", workspace.id)
    .order("opportunity_score", { ascending: false });

  if (status && PROSPECT_STATUSES.includes(status as ProspectStatus)) {
    query = query.eq("status", status as ProspectStatus);
  }

  const { data: opportunities } = await query;

  const companyIds = [...new Set((opportunities ?? []).map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, domain, country").in("id", companyIds)
    : { data: [] };
  const byId = new Map((companies ?? []).map((row) => [row.id, row]));

  const rows = (opportunities ?? []).filter((row) => {
    if (!term) return true;
    const company = byId.get(row.company_id);
    const haystack = `${company?.name ?? ""} ${company?.domain ?? ""} ${row.recommended_angle ?? ""}`.toLowerCase();
    return haystack.includes(term.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Feed"
        title="Opportunities"
        description="High-priority companies with a reason to engage — not a dump of raw leads."
      />
      <FilterBar
        action="/opportunities"
        q={q}
        status={status}
        placeholder="Filter by company, domain, or angle"
        statuses={PROSPECT_STATUSES.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
      />
      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((row) => {
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
          title={term || status ? "No matching opportunities" : "No opportunities yet"}
          description={term || status ? "Try another filter, or clear it to see the full feed." : "Qualify companies against an ICP to fill this feed."}
          href={term || status ? "/opportunities" : "/searches/new"}
          cta={term || status ? "Clear filters" : "Run a search"}
        />
      )}
    </div>
  );
}
