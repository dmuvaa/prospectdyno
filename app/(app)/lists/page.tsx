import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createListAction } from "@/lib/actions/list";
import { requireWorkspace } from "@/lib/workspace";
import Link from "next/link";

export default async function ListsPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, description, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Lists" description="Named groups for export and follow-up. Campaigns can come later." />
      <form action={createListAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="name">New list</Label>
          <Input id="name" name="name" placeholder="UK Local SEO Agencies" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="Optional" />
        </div>
        <Button type="submit" variant="ink">
          Create
        </Button>
      </form>
      {lists && lists.length > 0 ? (
        <ul className="space-y-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/lists/${list.id}`}
                className="block rounded-xl border border-border bg-card p-5 hover:border-teal-700/30"
              >
                <h2 className="font-medium">{list.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No lists"
          description="Save qualified companies into named lists before exporting."
          href="/prospects"
          cta="Browse companies"
        />
      )}
    </div>
  );
}
