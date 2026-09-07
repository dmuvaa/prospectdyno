import Link from "next/link";
import { notFound } from "next/navigation";
import { RetrySearchButton } from "@/components/retry-search";
import { StopHuntButton } from "@/components/stop-hunt";
import { SearchLivePanel } from "@/components/search-live";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { loadSearchLiveSnapshot } from "@/lib/search-live-data";
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

  const live = await loadSearchLiveSnapshot(supabase, workspace.id, id);
  if (!live) notFound();

  const canRetry = search.status === "failed" || search.status === "queued" || search.status === "cancelled";
  const canStop = search.status === "queued" || search.status === "running";

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { href: "/searches", label: "History" },
          { label: search.name },
        ]}
        kicker={search.provider}
        title={search.name}
        description={search.original_request ?? "Discovery run"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={search.status} />
            {canStop ? <StopHuntButton searchId={search.id} /> : null}
            {canRetry ? <RetrySearchButton searchId={search.id} /> : null}
            {search.icp_id ? (
              <Button asChild variant="outline">
                <Link href={`/icps/${search.icp_id}`}>Open brief</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      {search.error && search.status !== "cancelled" ? (
        <p className="text-sm text-destructive">{search.error}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">Started {formatDate(search.created_at)}</p>

      <SearchLivePanel key={`${search.id}-${search.status}`} searchId={search.id} initial={live} />
    </div>
  );
}
