import Link from "next/link";
import { creditsForHunt } from "@prospectdyno/shared";
import { resolvedOpenAiModel } from "@prospectdyno/ai";
import { apifyScraperStatus } from "@prospectdyno/engine";
import { requireWorkspace } from "@/lib/workspace";
import { addSuppressionAction, removeSuppressionAction } from "@/lib/actions/settings";
import { ApiKeyManager } from "@/components/api-key-manager";
import { WorkspaceProfileForm } from "@/components/workspace-profile-form";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { usageEventLabel } from "@/lib/credit-copy";
import { formatDate } from "@/lib/format";
import { looseSupabase } from "@/lib/supabase-loose";
import type { ApiKeyListItem } from "@/components/api-key-manager";

const sections = [
  { href: "#workspace", label: "Workspace" },
  { href: "#members", label: "Members" },
  { href: "#integrations", label: "Integrations" },
  { href: "#suppressions", label: "Suppressions" },
  { href: "#api-keys", label: "API keys" },
  { href: "#usage", label: "Usage" },
];

export default async function SettingsPage() {
  const { supabase, workspace, role, user, memberships } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const [{ data: usage }, { data: suppressions }, { data: apiKeys }, { data: members }] = await Promise.all([
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
    supabase
      .from("workspace_members")
      .select("role, user_id, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  const memberIds = [...new Set((members ?? []).map((row) => row.user_id))];
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name, first_name, last_name").in("id", memberIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));

  const scrapers = apifyScraperStatus();
  const openaiReady = Boolean(process.env.OPENAI_API_KEY);
  const openaiModel = resolvedOpenAiModel();
  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace profile, members, usage, suppressions, and integration status." />

      <nav className="flex flex-wrap gap-2 text-sm">
        {sections.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="rounded-full border border-border bg-card px-3 py-1 hover:border-teal-700/40"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Card id="workspace">
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Signed in as {user.email}. Role: {role}.{" "}
            <Link href="/usage" className="hover:underline">
              {workspace.credit_balance} credits
            </Link>
            . A 25-company hunt uses about {creditsForHunt(25)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memberships.length > 1 ? (
            <WorkspaceSwitcher
              tone="light"
              currentId={workspace.id}
              workspaces={memberships.map((item) => ({ id: item.workspace.id, name: item.workspace.name }))}
            />
          ) : null}
          <WorkspaceProfileForm
            name={workspace.name}
            companyName={workspace.company_name ?? ""}
            website={workspace.website ?? ""}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card id="members">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People who can access this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(members ?? []).map((member) => {
              const profile = profileById.get(member.user_id);
              const label =
                profile?.full_name ||
                [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
                (member.user_id === user.id ? user.email : "Member");
              return (
                <li key={member.user_id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{label}</p>
                    {member.user_id === user.id ? <p className="text-muted-foreground">You</p> : null}
                  </div>
                  <StatusBadge status={member.role} />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card id="integrations">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Configured via server environment variables. Keys never go to the browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <IntegrationRow
            label="OpenAI"
            ok={openaiReady}
            detail={openaiReady ? openaiModel : "Set OPENAI_API_KEY"}
          />
          <IntegrationRow
            label="Apify token"
            ok={scrapers.token}
            detail={scrapers.token ? "Ready" : "Set APIFY_API_TOKEN (apify_api_...)"}
          />
          <IntegrationRow label="Google Maps" ok={scrapers.maps} detail={scrapers.maps ? "Discovery" : "Set APIFY_GOOGLE_MAPS_ACTOR_ID"} />
          <IntegrationRow label="Contacts" ok={scrapers.contacts} detail={scrapers.contacts ? "Email/phone enrichment" : "Set APIFY_CONTACT_ACTOR_ID"} />
          <IntegrationRow label="Google Search" ok={scrapers.serp} detail={scrapers.serp ? "SERP discovery" : "Set APIFY_SERP_ACTOR_ID"} />
          <IntegrationRow label="Website crawler" ok={scrapers.website} detail={scrapers.website ? "JS site crawl" : "Set APIFY_WEBSITE_CRAWLER_ACTOR_ID"} />
          <IntegrationRow label="Reviews" ok={scrapers.reviews} detail={scrapers.reviews ? "Maps reviews" : "Set APIFY_REVIEWS_ACTOR_ID"} />
          <IntegrationRow label="Supabase" ok detail="Connected" />
        </CardContent>
      </Card>

      <Card id="suppressions">
        <CardHeader>
          <CardTitle>Suppression list</CardTitle>
          <CardDescription>Domains and emails to exclude from activation and exports.</CardDescription>
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
          {(suppressions ?? []).length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {(suppressions ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <p>{row.email ?? row.domain}</p>
                    <p className="text-muted-foreground">
                      {row.reason ? `${row.reason} · ` : ""}
                      {formatDate(row.created_at)}
                    </p>
                  </div>
                  <form action={removeSuppressionAction.bind(null, row.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing suppressed yet.</p>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card id="api-keys">
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>Workspace-scoped keys for server-to-server access.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeyManager apiKeys={apiKeys ?? []} />
          </CardContent>
        </Card>
      ) : null}

      <Card id="usage">
        <CardHeader>
          <CardTitle>Recent usage</CardTitle>
          <CardDescription>
            Credit events for this workspace.{" "}
            <Link href="/usage" className="text-teal-800 hover:underline">
              Open the full credits page
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(usage ?? []).length > 0 ? (
            <ul className="divide-y divide-border">
              {(usage ?? []).map((row, index) => (
                <li key={`${row.created_at}-${index}`} className="flex items-center justify-between py-2 text-sm">
                  <span>{usageEventLabel(row.event_type)}</span>
                  <span className="text-muted-foreground">
                    {row.credits} credits · {formatDate(row.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No usage yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{detail}</p>
      </div>
      <StatusBadge status={ok ? "ready" : "missing"} />
    </div>
  );
}
