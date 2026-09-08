"use client";

import { useState } from "react";
import { interpretAndCreateIcp } from "@/lib/actions/icp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IcpPromptForm({
  defaultWebsite = "",
  defaultNotes = "",
}: {
  defaultWebsite?: string;
  defaultNotes?: string;
  examples?: string[];
}) {
  const [website, setWebsite] = useState(defaultWebsite);
  const [notes, setNotes] = useState(defaultNotes);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await interpretAndCreateIcp({ website, notes });
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="icp-website">Your website</Label>
        <Input
          id="icp-website"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://yourcompany.com"
          required
        />
        <p className="text-sm text-muted-foreground">
          We read the site, then draft who you should hunt. You confirm or edit before any search starts.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="icp-notes">Anything to add (optional)</Label>
        <Textarea
          id="icp-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Only California SaaS, 10–50 people, skip agencies outside the US…"
          className="min-h-[120px] rounded-2xl bg-card px-4 py-3 text-base"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ink" size="lg" disabled={pending}>
          {pending ? "Reading your website…" : "Analyze website"}
        </Button>
        <p className="text-sm text-muted-foreground">
          This can take a minute. Nothing is hunted until you confirm the brief.
        </p>
      </div>
    </form>
  );
}
