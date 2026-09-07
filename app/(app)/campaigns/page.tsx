import Link from "next/link";
import { Megaphone } from "lucide-react";
import { createCampaignAction } from "@/lib/actions/campaign";
import { requireWorkspace } from "@/lib/workspace";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { looseSupabase } from "@/lib/supabase-loose";

type CampaignListRow = {
  id: string;
  name: string;
  objective: string | null;
  channel: string;
  status: string;
};

export default async function CampaignsPage() {
  const { supabase, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const [{ data: campaigns }, { data: lists }] = await Promise.all([
    db
      .from<CampaignListRow[]>("campaigns")
      .select("id, name, objective, channel, status, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lists")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Activation"
        title="Campaigns"
        description="Organize prospects for outreach, export, CRM handoff, or manual follow-up."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Megaphone className="size-5" />
            New campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCampaignAction} className="grid gap-3 lg:grid-cols-6">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="UK agency prospects" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list_id">List</Label>
              <select
                id="list_id"
                name="list_id"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">No list</option>
                {(lists ?? []).map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel</Label>
              <select
                id="channel"
                name="channel"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                defaultValue="export"
              >
                <option value="export">Export</option>
                <option value="manual">Manual</option>
                <option value="email">Email</option>
                <option value="crm">CRM</option>
                <option value="api">API</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="objective">Objective</Label>
              <Input id="objective" name="objective" placeholder="Book demo calls" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="tone">Tone</Label>
              <Input id="tone" name="tone" placeholder="Direct, useful, concise" />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="cta">CTA</Label>
              <Input id="cta" name="cta" placeholder="Ask if improving local SEO reporting is a priority" />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="ink">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {campaigns && campaigns.length > 0 ? (
        <ul className="space-y-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/campaigns/${campaign.id}`}
                className="block rounded-xl border border-border bg-card p-5 hover:border-teal-700/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{campaign.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaign.objective ?? "No objective"} · {campaign.channel}
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs uppercase tracking-wide">
                    {campaign.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No campaigns yet"
          description="Create a lightweight campaign from a saved list when prospects are ready for activation."
          href="/lists"
          cta="Review lists"
        />
      )}
    </div>
  );
}
