import Link from "next/link";
import { creditsForHunt } from "@prospectdyno/shared";
import { AddCreditsButton } from "@/components/add-credits-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { creditRates, usageEventLabel } from "@/lib/credit-copy";
import { formatDate } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export default async function UsagePage() {
  const { supabase, workspace, role } = await requireWorkspace();
  const canEdit = role === "owner" || role === "admin";
  const huntCost = creditsForHunt(25);
  const huntsLeft = huntCost > 0 ? Math.floor(workspace.credit_balance / huntCost) : 0;

  const { data: usage } = await supabase
    .from("usage_events")
    .select("event_type, credits, created_at, metadata")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const totals = new Map<string, { credits: number; count: number }>();
  for (const row of usage ?? []) {
    const current = totals.get(row.event_type) ?? { credits: 0, count: 0 };
    totals.set(row.event_type, {
      credits: current.credits + row.credits,
      count: current.count + 1,
    });
  }
  const spent = (usage ?? []).reduce((sum, row) => sum + row.credits, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credits"
        description="Credits meter how much discovery and scoring this workspace has used. They do not stop a hunt mid-run."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remaining</CardTitle>
            <CardDescription>Available on this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-4xl">{workspace.credit_balance}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              About {huntsLeft} hunts of 25 companies at {huntCost} credits each.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent spend</CardTitle>
            <CardDescription>Last {usage?.length ?? 0} events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-4xl">{spent}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              A Kenya-sized hunt used to cost 227 credits at the old rates. It now costs {huntCost}.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What they are for</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Credits track AI and discovery work so you can see usage. They are not a payment method,
              and running out no longer fails a hunt.
            </p>
            {canEdit ? (
              <div className="mt-4">
                <AddCreditsButton />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current rates</CardTitle>
          <CardDescription>What each action costs now</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {creditRates().map((rate) => (
              <li key={rate.key} className="flex items-center justify-between py-2">
                <span>{rate.label}</span>
                <span className="text-muted-foreground">
                  {rate.credits} {rate.credits === 1 ? "credit" : "credits"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {totals.size > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>From the events loaded above</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {[...totals.entries()]
                .sort((a, b) => b[1].credits - a[1].credits)
                .map(([eventType, row]) => (
                  <li key={eventType} className="flex items-center justify-between py-2">
                    <span>
                      {usageEventLabel(eventType)}
                      <span className="text-muted-foreground"> · {row.count} times</span>
                    </span>
                    <span>{row.credits} credits</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Full log for this workspace.{" "}
            <Link href="/settings#usage" className="text-teal-800 hover:underline">
              Also on Settings
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(usage ?? []).length > 0 ? (
            <ul className="divide-y divide-border">
              {(usage ?? []).map((row, index) => (
                <li key={`${row.created_at}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{usageEventLabel(row.event_type)}</span>
                  <span className="text-muted-foreground">
                    {row.credits} · {formatDate(row.created_at)}
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
