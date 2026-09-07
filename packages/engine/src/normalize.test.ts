import { describe, expect, it } from "vitest";
import { normalizeDomain, opportunityScore, websiteFromDomain } from "./normalize";

describe("normalizeDomain", () => {
  it("normalizes URLs and strips www", () => {
    expect(normalizeDomain("https://www.Example.com/path?q=1")).toBe("example.com");
  });

  it("builds a canonical website from a domain", () => {
    expect(websiteFromDomain("www.example.com")).toBe("https://example.com");
  });
});

describe("opportunityScore", () => {
  it("applies the configured weighted score", () => {
    expect(opportunityScore({
      fit: 100,
      intent: 50,
      business: 75,
      contactability: 20,
      confidence: 80,
    })).toBe(71);
  });
});
