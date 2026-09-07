import Link from "next/link";
import { notFound } from "next/navigation";
import { RetrySearchButton } from "@/components/retry-search";
import { RefreshWhile } from "@/components/refresh-while";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function SearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const { data: search } = await supabase
    .from("searches")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!search) notFound();

  const { data: results } = await supabase
    .from("search_results")
    .select("company_id")
    .eq("search_id", id);
  const companyIds = (results ?? []).map((row) => row.company_id);
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, domain, status").in("id", companyIds)
    : { data: [] };

  const running = search.status === "queued" || search.status === "running";
  const canRetry = search.status === "failed" || search.status === "queued" || search.status === "cancelled";

  return (
    <div className="space-y-6">
      <RefreshWhile active={running} />
      <PageHeader
        crumbs={[
          { href: "/searches", label: "Searches" },
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
                <Link href={`/icps/${search.icp_id}`}>Open ICP</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      {search.error ? <p className="text-sm text-destructive">{search.error}</p> : null}
      {running ? (
        <p className="text-sm text-muted-foreground">
          Working through discovery, website analysis, and qualification. This page refreshes automatically.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">Started {formatDate(search.created_at)}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{search.result_count}</CardTitle>
            <p className="text-sm text-muted-foreground">Companies</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{search.opportunity_count}</CardTitle>
            <p className="text-sm text-muted-foreground">Opportunities</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{search.cost}</CardTitle>
            <p className="text-sm text-muted-foreground">Credits used</p>
          </CardHeader>
        </Card>
      </div>

      {(companies ?? []).length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {(companies ?? []).map((company) => (
            <li key={company.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/prospects/${company.id}`} className="font-medium hover:underline">
                {company.name}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{company.domain}</span>
                <StatusBadge status={company.status} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {running ? "Companies will appear here as the worker finishes." : "No companies in this search yet."}
        </div>
      )}
    </div>
  );
}
