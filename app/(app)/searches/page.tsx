import Link from "next/link";
import { SEARCH_STATUSES, type SearchStatus } from "@prospectdyno/shared";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RefreshWhile } from "@/components/refresh-while";
import { RetrySearchButton } from "@/components/retry-search";
import { StatusBadge } from "@/components/status-badge";
import { formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function SearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const { supabase, workspace } = await requireWorkspace();
  let query = supabase
    .from("searches")
    .select("id, name, provider, status, result_count, opportunity_count, created_at, error")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (status && SEARCH_STATUSES.includes(status as SearchStatus)) {
    query = query.eq("status", status as SearchStatus);
  }
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data: searches } = await query;
  const polling = (searches ?? []).some((search) => search.status === "queued" || search.status === "running");

  return (
    <div className="space-y-6">
      <RefreshWhile active={polling} />
      <PageHeader
        title="History"
        description="Every hunt that discovered, analyzed, and scored companies. Open one to watch it live."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ink">
              <Link href="/dashboard">Find companies</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/searches/new">CSV / advanced</Link>
            </Button>
          </div>
        }
      />
      <FilterBar
        action="/searches"
        q={q}
        status={status}
        placeholder="Search by name"
        statuses={SEARCH_STATUSES.map((value) => ({ value, label: value }))}
      />
      {searches && searches.length > 0 ? (
        <ul className="space-y-3">
          {searches.map((search) => (
            <li key={search.id}>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-teal-700/30">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/searches/${search.id}`} className="min-w-0">
                    <h2 className="font-medium hover:underline">{search.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search.provider} · {search.result_count} companies · {search.opportunity_count} opportunities · {formatRelative(search.created_at)}
                      {search.status === "running" || search.status === "queued" ? " · live" : ""}
                    </p>
                    {search.error ? <p className="mt-2 text-sm text-destructive">{search.error}</p> : null}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={search.status} />
                    {search.status === "failed" || search.status === "queued" ? (
                      <RetrySearchButton searchId={search.id} compact />
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No hunts yet"
          description="Describe who you want on the Run page. Companies appear as the worker finds and scores them."
          href="/dashboard"
          cta="Find companies"
        />
      )}
    </div>
  );
}
