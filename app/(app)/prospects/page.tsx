import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ExportButton } from "@/components/export-button";
import { StatusBadge } from "@/components/status-badge";
import { requireWorkspace } from "@/lib/workspace";

export default async function ProspectsPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, domain, country, industry, status, employee_count")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        description="Canonical companies after normalization and deduplication."
        action={<ExportButton />}
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
          title="No prospects yet"
          description="Import domains or a CSV to build the company table."
          href="/searches/new"
          cta="Run a search"
        />
      )}
    </div>
  );
}
