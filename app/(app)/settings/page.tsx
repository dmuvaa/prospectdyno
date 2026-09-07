import { requireWorkspace } from "@/lib/workspace";
import { addSuppressionAction, updateWorkspaceProfileAction } from "@/lib/actions/settings";
import { ApiKeyManager } from "@/components/api-key-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { looseSupabase } from "@/lib/supabase-loose";
import type { ApiKeyListItem } from "@/components/api-key-manager";

export default async function SettingsPage() {
  const { supabase, workspace, role, user } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const [{ data: usage }, { data: suppressions }, { data: apiKeys }] = await Promise.all([
    supabase
      .from("usage_events")
      .select("event_type, credits, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("suppression_records")
      .select("id, email, domain, reason, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    db
      .from<ApiKeyListItem[]>("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  const apifyReady = Boolean(process.env.APIFY_API_TOKEN && process.env.APIFY_ACTOR_ID);
  const openaiReady = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace profile, usage, suppressions, and integration status." />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Signed in as {user.email}. Role: {role}. Credits: {workspace.credit_balance}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateWorkspaceProfileAction} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={workspace.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Company</Label>
              <Input id="company_name" name="company_name" defaultValue={workspace.company_name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" defaultValue={workspace.website ?? ""} />
            </div>
            <Button type="submit" variant="ink" className="sm:col-span-3 w-fit">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Configured via server environment variables. Keys never go to the browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>OpenAI / OpenRouter: {openaiReady ? "configured" : "missing"}</p>
          <p>Apify: {apifyReady ? "configured" : "not configured — CSV and website lists still work"}</p>
          <p>Supabase: connected</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppression list</CardTitle>
          <CardDescription>Domains and emails to exclude from activation and exports later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addSuppressionAction} className="grid gap-3 sm:grid-cols-4">
            <Input name="email" placeholder="email@example.com" />
            <Input name="domain" placeholder="example.com" />
            <Input name="reason" placeholder="Reason" />
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
          <ul className="space-y-1 text-sm">
            {(suppressions ?? []).map((row) => (
              <li key={row.id}>
                {row.email ?? row.domain} {row.reason ? `· ${row.reason}` : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {role === "owner" || role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>Workspace-scoped keys for server-to-server access.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeyManager apiKeys={apiKeys ?? []} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(usage ?? []).map((row, index) => (
              <li key={`${row.created_at}-${index}`}>
                {row.event_type} · {row.credits} credits · {new Date(row.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
