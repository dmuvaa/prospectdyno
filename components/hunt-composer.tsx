"use client";

import { useState } from "react";
import { startHuntAction } from "@/lib/actions/hunt";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type IcpOption = { id: string; name: string; status: string };

export function HuntComposer({
  icps,
  defaultPrompt = "",
  defaultIcpId = "",
}: {
  icps: IcpOption[];
  defaultPrompt?: string;
  defaultIcpId?: string;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [urls, setUrls] = useState("");
  const [icpId, setIcpId] = useState(defaultIcpId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await startHuntAction({
      prompt,
      urls: urls.trim() || undefined,
      icpId: icpId || undefined,
    });
    if (result?.error) {
      setError(result.error);
      if ("icpId" in result && result.icpId) setIcpId(result.icpId);
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hunt-prompt">Who should we find?</Label>
        <Textarea
          id="hunt-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="UK digital marketing agencies with 5–50 people that sell local SEO…"
          className="min-h-[120px] text-base"
          required={!icpId}
        />
      </div>

      {icps.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="hunt-icp">Or use a saved brief</Label>
          <select
            id="hunt-icp"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={icpId}
            onChange={(event) => setIcpId(event.target.value)}
          >
            <option value="">New brief from the description above</option>
            {icps.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="hunt-urls">Websites or domains (optional)</Label>
        <Textarea
          id="hunt-urls"
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          placeholder={"example.com\nhttps://another-agency.co.uk"}
          className="min-h-[88px]"
        />
        <p className="text-xs text-muted-foreground">
          Paste a list to hunt those companies now. Leave empty to discover from the brief when Apify is configured.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            className="max-w-full rounded-full border border-border bg-background px-3 py-1 text-left text-xs text-muted-foreground hover:border-teal-700/40 hover:text-foreground"
            onClick={() => setPrompt(example)}
          >
            {example.length > 72 ? `${example.slice(0, 72)}…` : example}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" variant="ink" size="lg" disabled={pending}>
        {pending ? "Starting hunt…" : "Find companies"}
      </Button>
    </form>
  );
}
