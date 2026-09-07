import Link from "next/link";
import { PROSPECT_STATUSES, type ProspectStatus } from "@prospectdyno/shared";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ExportButton } from "@/components/export-button";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";
import { searchTerm } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const term = searchTerm(q);
  const { supabase, workspace } = await requireWorkspace();
  let query = supabase
    .from("companies")
    .select("id, name, domain, country, industry, status, employee_count")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (status && PROSPECT_STATUSES.includes(status as ProspectStatus)) {
    query = query.eq("status", status as ProspectStatus);
  }
  if (term) query = query.or(`name.ilike.%${term}%,domain.ilike.%${term}%`);

  const { data: companies } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Every company found so far, after normalization and deduplication."
        action={<ExportButton />}
      />
      <FilterBar
        action="/prospects"
        q={q}
        status={status}
        placeholder="Search name or domain"
        statuses={PROSPECT_STATUSES.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
      />
      {companies && companies.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Industry</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/prospects/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{company.domain}</td>
                  <td className="px-4 py-3 text-muted-foreground">{company.country}</td>
                  <td className="px-4 py-3 text-muted-foreground">{company.industry}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={company.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={term || status ? "No matching companies" : "No companies yet"}
          description={term || status ? "Try another filter." : "Start a hunt. Qualified companies land in the inbox first."}
          href={term || status ? "/prospects" : "/dashboard"}
          cta={term || status ? "Clear filters" : "Find companies"}
        />
      )}
    </div>
  );
}
