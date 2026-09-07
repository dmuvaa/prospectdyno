import { describe, expect, it } from "vitest";
import { activityLabel, pipelineStages, type SearchActivityStep } from "./search-activity";

function step(partial: Partial<SearchActivityStep>): SearchActivityStep {
  return {
    id: "1",
    step_type: "discovery",
    tool_name: null,
    status: "completed",
    error: null,
    created_at: new Date().toISOString(),
    input: null,
    output: null,
    ...partial,
  };
}

describe("activityLabel", () => {
  it("summarizes a batch company save", () => {
    expect(activityLabel(step({
      step_type: "normalization",
      tool_name: "save_companies",
      output: { count: 25 },
    }))).toBe("Saved 25 companies");
  });
});

describe("pipelineStages", () => {
  it("treats saving companies as the discover stage", () => {
    const stages = pipelineStages("running", [
      step({ step_type: "normalization", tool_name: "save_companies", status: "running" }),
      step({ step_type: "discovery", output: { count: 25 } }),
    ]);
    expect(stages.find((stage) => stage.id === "discovery")?.state).toBe("current");
  });
});
