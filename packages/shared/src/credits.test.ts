import { describe, expect, it } from "vitest";
import { CREDIT_COSTS, creditsForHunt } from "./product";

describe("creditsForHunt", () => {
  it("prices a 25-company hunt as start plus per-company steps", () => {
    expect(creditsForHunt(25)).toBe(
      CREDIT_COSTS.interpret_icp +
        CREDIT_COSTS.plan_search +
        25 * (CREDIT_COSTS.company_discovery + CREDIT_COSTS.website_analysis + CREDIT_COSTS.qualification),
    );
    expect(creditsForHunt(25)).toBe(77);
  });
});
