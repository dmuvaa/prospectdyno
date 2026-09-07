export type SearchActivityStep = {
  id: string;
  step_type: string;
  tool_name: string | null;
  status: string;
  error: string | null;
  created_at: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedRecord(value: unknown, key: string) {
  const record = asRecord(value);
  return record ? asRecord(record[key]) : null;
}

export function activityLabel(step: SearchActivityStep) {
  const candidate = nestedRecord(step.input, "candidate");
  const name = String(candidate?.name ?? step.input?.name ?? "");
  const website = String(step.input?.website ?? candidate?.website ?? candidate?.domain ?? "");
  const found = step.output?.count;

  if (step.step_type === "discovery") {
    if (step.status === "running") return "Searching for companies…";
    if (step.status === "failed") return step.error ?? "Discovery failed";
    return typeof found === "number" ? `Found ${found} companies` : "Discovery finished";
  }
  if (step.step_type === "normalization") {
    if (step.status === "running") return name ? `Saving ${name}…` : "Saving company…";
    return name ? `Added ${name}` : "Company saved";
  }
  if (step.step_type === "website_analysis") {
    if (step.tool_name === "crawl_websites") {
      if (step.status === "running") return "Crawling company websites…";
      if (step.status === "failed") return step.error ?? "Website crawl failed";
      return "Website crawl finished";
    }
    if (step.status === "running") return website ? `Reading ${website}…` : "Analyzing website…";
    if (step.status === "failed") return website ? `Could not read ${website}` : "Website analysis failed";
    return website ? `Analyzed ${website}` : "Website analyzed";
  }
  if (step.step_type === "qualification") {
    if (step.status === "running") return name ? `Scoring ${name}…` : "Scoring opportunity…";
    if (step.status === "failed") return "Qualification failed";
    return name ? `Qualified ${name}` : "Opportunity scored";
  }
  return step.tool_name?.replaceAll("_", " ") ?? step.step_type.replaceAll("_", " ");
}

export function pipelineStages(status: string, steps: SearchActivityStep[]) {
  const types = new Set(steps.filter((step) => step.status !== "failed").map((step) => step.step_type));
  const current = [...steps].reverse().find((step) => step.status === "running")?.step_type
    ?? [...steps].reverse().find((step) => step.status === "completed")?.step_type
    ?? null;

  const items = [
    { id: "queued", label: "Queued" },
    { id: "discovery", label: "Discover" },
    { id: "website_analysis", label: "Analyze" },
    { id: "qualification", label: "Qualify" },
    { id: "completed", label: "Done" },
  ] as const;

  return items.map((item) => {
    let state: "done" | "current" | "pending" = "pending";
    if (status === "completed" || (item.id === "completed" && status === "completed")) state = "done";
    else if (item.id === "queued") state = status === "queued" && !current ? "current" : "done";
    else if (item.id === "completed") state = status === "completed" ? "done" : "pending";
    else if (current === item.id) state = "current";
    else if (!current && status === "running" && item.id === "discovery") state = "current";
    else if (types.has(item.id) && current !== item.id) state = "done";
    return { ...item, state };
  });
}
