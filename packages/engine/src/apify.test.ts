import { afterEach, describe, expect, it } from "vitest";
import {
  apifyToken,
  buildGoogleMapsInput,
  buildSerpInput,
  buildWebsiteCrawlerInput,
  encodeActorId,
  getGoogleMapsActorId,
} from "./apify";

describe("buildGoogleMapsInput", () => {
  it("builds the Google Maps actor payload with conservative per-search limits", () => {
    expect(buildGoogleMapsInput({
      queries: ["dentist", "law firm"],
      location: "Nairobi, Kenya",
      limit: 10,
    })).toMatchObject({
      searchStringsArray: ["dentist", "law firm"],
      locationQuery: "Nairobi, Kenya",
      maxCrawledPlacesPerSearch: 5,
      skipClosedPlaces: true,
      scrapeContacts: false,
    });
  });

  it("caps each Maps search term to 20 places", () => {
    expect(buildGoogleMapsInput({
      queries: ["restaurant"],
      location: "Kenya",
      limit: 100,
    }).maxCrawledPlacesPerSearch).toBe(20);
  });
});

describe("buildSerpInput", () => {
  it("appends the first location to queries that do not already include it", () => {
    expect(buildSerpInput({
      queries: ["local SEO agency", "PPC agency"],
      locations: ["Manchester"],
      limit: 10,
    })).toEqual({
      queries: "local SEO agency Manchester\nPPC agency Manchester",
      maxPagesPerQuery: 1,
    });
  });
});

describe("buildWebsiteCrawlerInput", () => {
  it("dedupes start URLs and caps crawl size", () => {
    const input = buildWebsiteCrawlerInput([
      "https://example.com",
      "https://example.com",
      "https://other.com",
    ]);
    expect(input.startUrls).toEqual([{ url: "https://example.com" }, { url: "https://other.com" }]);
    expect(input.maxCrawlPages).toBe(4);
  });
});

describe("encodeActorId", () => {
  it("uses Apify tilde notation", () => {
    expect(encodeActorId("apify/google-search-scraper")).toBe("apify~google-search-scraper");
  });
});

describe("apifyToken", () => {
  afterEach(() => {
    delete process.env.APIFY_API_TOKEN;
  });

  it("extracts the apify_api_ token when a prefix was pasted", () => {
    process.env.APIFY_API_TOKEN = "APIFY_TOKEN=apify_api_abc123";
    expect(apifyToken()).toBe("apify_api_abc123");
  });
});

describe("getGoogleMapsActorId", () => {
  afterEach(() => {
    delete process.env.APIFY_GOOGLE_MAPS_ACTOR_ID;
    delete process.env.APIFY_ACTOR_ID;
  });

  it("prefers the explicit Google Maps actor env var", () => {
    process.env.APIFY_GOOGLE_MAPS_ACTOR_ID = "compass/crawler-google-places";
    process.env.APIFY_ACTOR_ID = "legacy/actor";

    expect(getGoogleMapsActorId()).toBe("compass/crawler-google-places");
  });
});
