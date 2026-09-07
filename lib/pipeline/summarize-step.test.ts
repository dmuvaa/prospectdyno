import { describe, expect, it } from "vitest";
import { summarizeStepPayload } from "./summarize-step";

describe("summarizeStepPayload", () => {
  it("keeps small objects intact", () => {
    expect(summarizeStepPayload({ website: "https://example.com", company_id: "abc" })).toEqual({
      website: "https://example.com",
      company_id: "abc",
    });
  });

  it("never returns truncated JSON", () => {
    const huge = {
      htmlExcerpt: "x".repeat(5000),
      summary: { title: "Agency", description: "y".repeat(800) },
      scores: { website_score: 42 },
    };
    const payload = summarizeStepPayload(huge);
    expect(() => JSON.parse(JSON.stringify(payload))).not.toThrow();
    expect(JSON.stringify(payload).length).toBeLessThan(4000);
    expect(String(payload.htmlExcerpt).endsWith("…")).toBe(true);
  });

  it("summarizes arrays by count", () => {
    expect(summarizeStepPayload([{ id: 1 }, { id: 2 }])).toEqual({ count: 2 });
  });
});
