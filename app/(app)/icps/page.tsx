import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl">Ideal customers</h1>
          <p className="mt-2 text-muted-foreground">
            Each ICP starts as a description, then becomes structured criteria you can edit.
          </p>
        </div>
        <Button asChild variant="ink">
          <Link href="/icps/new">New ICP</Link>
        </Button>
      </div>

      {icps && icps.length > 0 ? (
        <ul className="space-y-3">
          {icps.map((icp) => (
            <li key={icp.id}>
              <Link
                href={`/icps/${icp.id}`}
                className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-teal-700/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium">{icp.name}</h2>
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
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No ICPs in this workspace yet.</p>
          <Button asChild variant="ink" className="mt-4">
            <Link href="/icps/new">Describe your first customer</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
