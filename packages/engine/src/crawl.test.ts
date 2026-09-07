import { describe, expect, it } from "vitest";
import { extractEmails, isThinWebsiteAnalysis, relatedPageUrls } from "./crawl";

describe("extractEmails", () => {
  it("prefers same-domain addresses and drops junk", () => {
    expect(extractEmails(
      "Contact info@optiven.co.ke or noreply@optiven.co.ke and hello@example.com",
      "https://www.optiven.co.ke/",
    )).toEqual(["info@optiven.co.ke"]);
  });

  it("keeps a few real emails when the domain is unknown", () => {
    expect(extractEmails("Reach sales@amgrealtors.com or martin@amgrealtors.com")).toEqual([
      "sales@amgrealtors.com",
      "martin@amgrealtors.com",
    ]);
  });
});

describe("isThinWebsiteAnalysis", () => {
  it("flags a JS shell with almost no copy", () => {
    expect(isThinWebsiteAnalysis({
      summary: { word_count: 38 },
      htmlExcerpt: "Mseto Travel Experiences Initializing Journeys...",
    })).toBe(true);
    expect(isThinWebsiteAnalysis({
      summary: { word_count: 240 },
      htmlExcerpt: "x".repeat(500),
    })).toBe(false);
  });
});

describe("relatedPageUrls", () => {
  it("adds contact and about pages for a JS homepage", () => {
    expect(relatedPageUrls("http://www.msetotravel.com/")).toEqual([
      "http://www.msetotravel.com/",
      "http://www.msetotravel.com/contact",
      "http://www.msetotravel.com/contact-us",
      "http://www.msetotravel.com/about",
    ]);
  });
});
