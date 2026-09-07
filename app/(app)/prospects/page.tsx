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
  searchParams: Promise<{ q?: string; status?: string; search?: string }>;
}) {
  const { q, status, search: huntId } = await searchParams;
  const term = searchTerm(q);
  const { supabase, workspace } = await requireWorkspace();

  let companiesQuery = supabase
    .from("companies")
    .select("id, name, domain, city, country, industry, status, employee_count")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (status && PROSPECT_STATUSES.includes(status as ProspectStatus)) {
    companiesQuery = companiesQuery.eq("status", status as ProspectStatus);
  }
  if (term) companiesQuery = companiesQuery.or(`name.ilike.%${term}%,domain.ilike.%${term}%`);

  const [{ data: companies }, { data: hunts }, { data: links }] = await Promise.all([
    companiesQuery,
    supabase
      .from("searches")
      .select("id, name, created_at, result_count")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("search_results")
      .select("search_id, company_id")
      .eq("workspace_id", workspace.id),
  ]);

  const companyById = new Map((companies ?? []).map((company) => [company.id, company]));
  const linkedIds = new Set((links ?? []).map((link) => link.company_id));
  const groups = (hunts ?? [])
    .filter((hunt) => !huntId || hunt.id === huntId)
    .map((hunt) => ({
      hunt,
      companies: (links ?? [])
        .filter((link) => link.search_id === hunt.id)
        .map((link) => companyById.get(link.company_id))
        .filter((company): company is NonNullable<typeof company> => Boolean(company)),
    }))
    .filter((group) => group.companies.length > 0);

  const ungrouped = huntId
    ? []
    : (companies ?? []).filter((company) => !linkedIds.has(company.id));
  const hasResults = groups.length > 0 || ungrouped.length > 0;
  const filtered = Boolean(term || status || huntId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Every company found so far, grouped by the hunt that discovered it."
        action={<ExportButton />}
      />
      <FilterBar
        action="/prospects"
        q={q}
        status={status}
        hunt={huntId}
        hunts={(hunts ?? []).map((hunt) => ({ value: hunt.id, label: hunt.name }))}
        placeholder="Search name or domain"
        statuses={PROSPECT_STATUSES.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
      />
      {hasResults ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.hunt.id} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-medium">
                    <Link href={`/searches/${group.hunt.id}`} className="hover:underline">
                      {group.hunt.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground">{group.companies.length} companies</p>
                </div>
                <Link href={`/searches/${group.hunt.id}`} className="text-sm text-teal-800 hover:underline">
                  Open hunt
                </Link>
              </div>
              <CompanyTable companies={group.companies} />
            </section>
          ))}
          {ungrouped.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="font-medium">Not in a hunt</h2>
                <p className="text-sm text-muted-foreground">{ungrouped.length} companies</p>
              </div>
              <CompanyTable companies={ungrouped} />
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={filtered ? "No matching companies" : "No companies yet"}
          description={filtered ? "Try another filter." : "Start a hunt. Qualified companies land in the inbox first."}
          href={filtered ? "/prospects" : "/dashboard"}
          cta={filtered ? "Clear filters" : "Find companies"}
        />
      )}
    </div>
  );
}

function CompanyTable({
  companies,
}: {
  companies: Array<{
    id: string;
    name: string;
    domain: string | null;
    city: string | null;
    country: string | null;
    industry: string | null;
    status: string;
  }>;
}) {
  return (
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
              <td className="px-4 py-3 text-muted-foreground">
                {[company.city, company.country].filter(Boolean).join(", ")}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{company.industry}</td>
              <td className="px-4 py-3">
                <StatusBadge status={company.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
