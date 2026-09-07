import Link from "next/link";
import { INBOX_PROSPECT_STATUSES, PROSPECT_STATUSES, type ProspectStatus } from "@prospectdyno/shared";
import { FilterBar } from "@/components/filter-bar";
import { InboxActions } from "@/components/inbox-actions";
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

  if (!status || status === "inbox") {
    query = query.in("status", [...INBOX_PROSPECT_STATUSES]);
  } else if (status !== "all" && PROSPECT_STATUSES.includes(status as ProspectStatus)) {
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

  const filtered = Boolean(term || (status && status !== "inbox"));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Review"
        title="Inbox"
        description="Keep the companies worth working. Skip the rest. Drafts stay on the report — nothing is sent."
      />
      <FilterBar
        action="/opportunities"
        q={q}
        status={status}
        defaultStatus="inbox"
        includeAllOption={false}
        placeholder="Filter by company, domain, or angle"
        statuses={[
          { value: "inbox", label: "To review" },
          { value: "all", label: "All" },
          ...PROSPECT_STATUSES.map((value) => ({ value, label: value.replaceAll("_", " ") })),
        ]}
      />
      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((row) => {
            const company = byId.get(row.company_id);
            const why = Array.isArray(row.why) ? (row.why as string[]) : [];
            const inInbox = (INBOX_PROSPECT_STATUSES as readonly string[]).includes(row.status);
            return (
              <li key={row.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/opportunities/${row.id}`} className="font-medium hover:underline">
                      {company?.name ?? "Company"}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {company?.domain} {company?.country ? `· ${company.country}` : ""}
                    </p>
                    <p className="mt-2 text-sm">{row.recommended_angle}</p>
                    {why[0] ? <p className="mt-2 text-sm text-muted-foreground">{why[0]}</p> : null}
                    <div className="mt-4">
                      {inInbox ? (
                        <InboxActions opportunityId={row.id} />
                      ) : (
                        <ButtonLink opportunityId={row.id} />
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-4xl">{row.opportunity_score}</p>
                    <StatusBadge status={row.status} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={filtered ? "No matching companies" : "Inbox is clear"}
          description={
            filtered
              ? "Try another filter, or clear it to see companies waiting for review."
              : "Start a hunt. Scored companies land here for Keep or Skip."
          }
          href={filtered ? "/opportunities" : "/dashboard"}
          cta={filtered ? "Clear filters" : "Find companies"}
        />
      )}
    </div>
  );
}

function ButtonLink({ opportunityId }: { opportunityId: string }) {
  return (
    <Link href={`/opportunities/${opportunityId}`} className="text-sm text-teal-800 hover:underline">
      Open report
    </Link>
  );
}
