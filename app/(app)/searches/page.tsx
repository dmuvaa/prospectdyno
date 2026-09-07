import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireWorkspace } from "@/lib/workspace";

export default async function SearchesPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: searches } = await supabase
    .from("searches")
    .select("id, name, provider, status, result_count, opportunity_count, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Searches"
        description="Each search discovers companies, analyzes websites, and scores opportunities against an ICP."
        action={
          <Button asChild variant="ink">
            <Link href="/searches/new">New search</Link>
          </Button>
        }
      />
      {searches && searches.length > 0 ? (
        <ul className="space-y-3">
          {searches.map((search) => (
            <li key={search.id}>
              <Link
                href={`/searches/${search.id}`}
                className="block rounded-xl border border-border bg-card p-5 shadow-sm hover:border-teal-700/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{search.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search.provider} · {search.result_count} companies · {search.opportunity_count} opportunities
                    </p>
                  </div>
                  <StatusBadge status={search.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No searches yet"
          description="Import a CSV or paste domains. ProspectDyno will analyze and qualify them."
          href="/searches/new"
          cta="Create a search"
        />
      )}
    </div>
  );
}
