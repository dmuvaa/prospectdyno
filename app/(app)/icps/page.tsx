import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function IcpsPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: icps } = await supabase
    .from("icps")
    .select("id, name, status, original_prompt, created_at")
    .eq("workspace_id", workspace.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved briefs"
        description="Hunts save a brief automatically. Edit criteria here when you want a tighter definition."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ink">
              <Link href="/dashboard">Find companies</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/icps/new">New brief</Link>
            </Button>
          </div>
        }
      />

      {icps && icps.length > 0 ? (
        <ul className="space-y-3">
          {icps.map((icp) => (
            <li key={icp.id}>
              <Link
                href={`/icps/${icp.id}`}
                className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-teal-700/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{icp.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelative(icp.created_at)}</p>
                  </div>
                  <Badge variant={icp.status === "approved" ? "success" : "warning"}>
                    {icp.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{icp.original_prompt}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No briefs yet"
          description="Describe who you sell to on the Run page. ProspectDyno saves the interpreted brief with the hunt."
          href="/dashboard"
          cta="Find companies"
        />
      )}
    </div>
  );
}
