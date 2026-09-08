"use client";

import { useState } from "react";
import { creditsForHunt } from "@prospectdyno/shared";
import { startHuntAction } from "@/lib/actions/hunt";
import { IcpPromptForm } from "@/components/icp/prompt-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type IcpOption = { id: string; name: string; status: string };

export function HuntComposer({
  icps,
  defaultPrompt = "",
  defaultIcpId = "",
  creditBalance,
}: {
  icps: IcpOption[];
  defaultPrompt?: string;
  defaultIcpId?: string;
  creditBalance?: number;
}) {
  const looksLikeSite = Boolean(defaultPrompt && /(\.|https?:\/\/)/i.test(defaultPrompt));
  const confirmed = icps.filter((icp) => icp.status === "approved");
  const [icpId, setIcpId] = useState(defaultIcpId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onHunt(event: React.FormEvent) {
    event.preventDefault();
    if (!icpId) return;
    setPending(true);
    setError(null);
    const result = await startHuntAction({
      prompt: "",
      icpId,
    });
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {icpId ? (
        <form onSubmit={(event) => void onHunt(event)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hunting with the confirmed brief. Change the brief below, or clear it to start from a website.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <p className="text-sm text-muted-foreground">
            A hunt of 25 companies uses about {creditsForHunt(25)} credits
            {creditBalance != null ? ` · ${creditBalance} remaining` : ""}.
          </p>
          <Button type="submit" variant="ink" size="lg" disabled={pending}>
            {pending ? "Starting hunt…" : "Find companies"}
          </Button>
        </form>
      ) : (
        <IcpPromptForm
          defaultWebsite={looksLikeSite ? defaultPrompt : ""}
          defaultNotes={looksLikeSite ? "" : defaultPrompt}
        />
      )}

      {confirmed.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="hunt-icp">Or use a confirmed brief</Label>
          <select
            id="hunt-icp"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={icpId}
            onChange={(event) => setIcpId(event.target.value)}
          >
            <option value="">Start from a website</option>
            {confirmed.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
