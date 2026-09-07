"use client";

import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { SearchResultsList } from "@/components/search-results-list";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activityLabel, pipelineStages, type SearchActivityStep } from "@/lib/search-activity";
import type { SearchLiveSnapshot } from "@/lib/search-live-data";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SearchLivePanel({
  searchId,
  initial,
}: {
  searchId: string;
  initial: SearchLiveSnapshot;
}) {
  const [live, setLive] = useState(initial);

  useEffect(() => {
    if (!live.running) return;
    let active = true;
    const tick = async () => {
      try {
        const response = await fetch(`/api/searches/${searchId}/live`, { cache: "no-store" });
        if (!response.ok || !active) return;
        const next = (await response.json()) as SearchLiveSnapshot;
        if (active) setLive(next);
      } catch {
        // Keep showing the last good snapshot.
      }
    };
    const timer = setInterval(tick, 900);
    void tick();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [searchId, live.running]);

  const stages = pipelineStages(live.status, live.steps);
  const current = live.steps.find((step) => step.status === "running") ?? live.steps[0] ?? null;
  const liveSteps = live.steps.slice(0, 24);

  return (
    <div className="space-y-6">
      {live.running ? (
        <div className="flex items-center gap-3 rounded-xl border border-teal-700/30 bg-teal-50/60 px-4 py-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-teal-600" />
          </span>
          <div>
            <p className="font-medium">Live search</p>
            <p className="text-sm text-muted-foreground">
              {current ? activityLabel(current) : "Waiting for the worker to pick this up…"}
            </p>
          </div>
        </div>
      ) : live.status === "cancelled" ? (
        <div className="rounded-xl border border-amber-700/30 bg-amber-50 px-4 py-3 text-sm">
          Hunt stopped. {live.resultCount} companies were kept.
        </div>
      ) : null}

      <ol className="grid gap-2 sm:grid-cols-5">
        {stages.map((stage) => (
          <li
            key={stage.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              stage.state === "current" && "border-teal-700/40 bg-teal-50 font-medium",
              stage.state === "done" && "border-border bg-card text-muted-foreground",
              stage.state === "pending" && "border-dashed border-border text-muted-foreground/70",
            )}
          >
            {stage.label}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="size-4" />
              Activity
            </CardTitle>
            <CardDescription>
              {live.running ? "Updates as companies are found, read, and scored." : "What this search did."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {liveSteps.length > 0 ? (
              <ol className="space-y-3">
                {liveSteps.map((step) => (
                  <ActivityRow key={step.id} step={step} />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {live.running
                  ? "The worker has not started writing steps yet."
                  : "No activity recorded."}
              </p>
            )}
          </CardContent>
        </Card>

        <SearchResultsList
          companies={live.companies}
          running={live.running}
          opportunityCount={live.opportunityCount}
          persistedCount={live.resultCount}
        />
      </div>
    </div>
  );
}

function ActivityRow({ step }: { step: SearchActivityStep }) {
  return (
    <li className="animate-rise-in text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className={step.status === "running" ? "font-medium" : undefined}>
          {activityLabel(step)}
        </p>
        <StatusBadge status={step.status} />
      </div>
      <p className="text-xs text-muted-foreground">{formatRelative(step.created_at)}</p>
      {step.error ? <p className="text-xs text-destructive">{step.error}</p> : null}
    </li>
  );
}
