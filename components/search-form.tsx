"use client";

import { useMemo, useState } from "react";
import type { SearchPlan, SearchProvider } from "@prospectdyno/shared";
import { createAndRunSearchAction, generateSearchPlanAction } from "@/lib/actions/search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type IcpOption = { id: string; name: string; status: string };

export function SearchForm({
  icps,
  defaultIcpId,
}: {
  icps: IcpOption[];
  defaultIcpId?: string;
}) {
  const approved = icps.filter((icp) => icp.status === "approved");
  const [icpId, setIcpId] = useState(defaultIcpId ?? approved[0]?.id ?? "");
  const [provider, setProvider] = useState<SearchProvider>("website");
  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [csv, setCsv] = useState("");
  const [plan, setPlan] = useState<SearchPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"plan" | "run" | null>(null);

  const selected = useMemo(() => approved.find((icp) => icp.id === icpId), [approved, icpId]);

  async function onPlan() {
    if (!icpId) return;
    setPending("plan");
    setError(null);
    const result = await generateSearchPlanAction(icpId);
    if (result.error) setError(result.error);
    else if (result.plan) {
      setPlan(result.plan);
      if (!name) setName(result.plan.name);
    }
    setPending(null);
  }

  async function onRun(event: React.FormEvent) {
    event.preventDefault();
    setPending("run");
    setError(null);
    const result = await createAndRunSearchAction({
      icpId,
      name: name || selected?.name || "Search",
      provider,
      csv: provider === "csv" ? csv : undefined,
      urls: provider === "website" ? urls : undefined,
      plan: plan ?? undefined,
    });
    if (result?.error) {
      setError(result.error);
      setPending(null);
    }
  }

  if (approved.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Approve an ICP first. Searches are scored against a confirmed customer definition.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void onRun(event)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
          <CardDescription>
            CSV and website lists work immediately. Apify runs when API credentials are configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ICP</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={icpId}
                onChange={(event) => setIcpId(event.target.value)}
              >
                {approved.map((icp) => (
                  <option key={icp.id} value={icp.id}>
                    {icp.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={provider}
                onChange={(event) => setProvider(event.target.value as SearchProvider)}
              >
                <option value="website">Website / domain list</option>
                <option value="csv">CSV import</option>
                <option value="apify">Apify discovery</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="search-name">Search name</Label>
            <Input id="search-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => void onPlan()} disabled={pending !== null}>
            {pending === "plan" ? "Planning…" : "Generate search plan"}
          </Button>
        </CardContent>
      </Card>

      {plan ? (
        <Card>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Queries</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {plan.queries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
            {plan.locations.length > 0 ? (
              <>
                <p className="font-medium pt-2">Locations</p>
                <p className="text-muted-foreground">{plan.locations.join(", ")}</p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {provider === "website" ? (
        <div className="space-y-2">
          <Label htmlFor="urls">Websites or domains</Label>
          <Textarea
            id="urls"
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            placeholder={"example.com\nhttps://another-agency.co.uk"}
          />
        </div>
      ) : null}

      {provider === "csv" ? (
        <div className="space-y-2">
          <Label htmlFor="csv">CSV</Label>
          <Textarea
            id="csv"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder="name,domain,website,country,city,industry"
            className="min-h-[180px] font-mono text-xs"
          />
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setCsv(await file.text());
            }}
          />
        </div>
      ) : null}

      {provider === "apify" ? (
        <p className="text-sm text-muted-foreground">
          Uses the generated queries against Apify. Set APIFY_API_TOKEN and APIFY_ACTOR_ID on the server.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" variant="ink" size="lg" disabled={pending !== null}>
        {pending === "run" ? "Starting…" : "Run search"}
      </Button>
    </form>
  );
}
