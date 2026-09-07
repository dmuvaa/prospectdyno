import Link from "next/link";
import { Radar } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activityLabel, pipelineStages, type SearchActivityStep } from "@/lib/search-activity";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SearchLivePanel({
  status,
  running,
  resultCount,
  opportunityCount,
  steps,
  companies,
}: {
  status: string;
  running: boolean;
  resultCount: number;
  opportunityCount: number;
  steps: SearchActivityStep[];
  companies: Array<{
    id: string;
    name: string;
    domain: string | null;
    status: string;
    score: number | null;
    angle: string | null;
    opportunityId: string | null;
  }>;
}) {
  const stages = pipelineStages(status, steps);
  const current = steps.find((step) => step.status === "running") ?? steps[0] ?? null;

  return (
    <div className="space-y-6">
      {running ? (
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
      ) : null}

      <ol className="grid gap-2 sm:grid-cols-5">
        {stages.map((stage) => (
          <li
            key={stage.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
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
              {running ? "Updates as each company is found and scored." : "What this search did."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {steps.length > 0 ? (
              <ol className="space-y-3">
                {steps.map((step) => (
                  <li key={step.id} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className={step.status === "running" ? "font-medium" : undefined}>
                        {activityLabel(step)}
                      </p>
                      <StatusBadge status={step.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{formatRelative(step.created_at)}</p>
                    {step.error ? <p className="text-xs text-destructive">{step.error}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {running
                  ? "The worker has not started writing steps yet. If this sits here, the Render worker key is probably still wrong."
                  : "No activity recorded."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {resultCount} companies · {opportunityCount} opportunities
          </p>
          {companies.length > 0 ? (
            <ul className="space-y-3">
              {companies.map((company) => (
                <li key={company.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/prospects/${company.id}`} className="font-medium hover:underline">
                        {company.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{company.domain}</p>
                      {company.angle ? <p className="mt-1 text-sm">{company.angle}</p> : null}
                    </div>
                    <div className="text-right">
                      {company.score != null ? (
                        <p className="font-heading text-3xl">{Math.round(company.score)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{running ? "Working…" : "—"}</p>
                      )}
                      <StatusBadge status={company.status} />
                      {company.opportunityId ? (
                        <Link
                          href={`/opportunities/${company.opportunityId}`}
                          className="mt-1 block text-xs text-teal-800 hover:underline"
                        >
                          Open report
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {running ? "Companies will appear here one by one as they are found." : "No companies in this search yet."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
