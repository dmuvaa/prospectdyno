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
        title="Ideal customers"
        description="Each ICP starts as a description, then becomes structured criteria you can edit."
        action={
          <Button asChild variant="ink">
            <Link href="/icps/new">New ICP</Link>
          </Button>
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
          title="No ICPs yet"
          description="Describe who you sell to. ProspectDyno will turn it into editable criteria."
          href="/icps/new"
          cta="Describe your first customer"
        />
      )}
    </div>
  );
}
