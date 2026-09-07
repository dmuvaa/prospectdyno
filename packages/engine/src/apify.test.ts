import { afterEach, describe, expect, it } from "vitest";
import {
  apifyToken,
  buildContactInput,
  buildGoogleMapsInput,
  buildSerpInput,
  buildWebsiteCrawlerInput,
  candidateFromApifyItem,
  encodeActorId,
  getGoogleMapsActorId,
  isBusinessPlace,
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
      searchMatching: "all",
      includeWebResults: false,
    });
  });

  it("caps each Maps search term to 50 places", () => {
    expect(buildGoogleMapsInput({
      queries: ["restaurant"],
      location: "Kenya",
      limit: 100,
    }).maxCrawledPlacesPerSearch).toBe(50);
  });
});

describe("buildContactInput", () => {
  it("uses Maps start URLs and scrapes contacts", () => {
    expect(buildContactInput([
      "https://www.google.com/maps/search/?api=1&query=LM%20Realtors&query_place_id=ChIJ5fWmS7wXLxgR-mDkw9jlTNc",
    ])).toMatchObject({
      startUrls: [{
        url: "https://www.google.com/maps/search/?api=1&query=LM%20Realtors&query_place_id=ChIJ5fWmS7wXLxgR-mDkw9jlTNc",
      }],
      maxCrawledPlaces: 1,
      scrapeContacts: true,
      scrapePlaceDetailPage: false,
    });
  });
});

describe("candidateFromApifyItem", () => {
  it("maps Compass place fields including title, country code, emails, and place id", () => {
    const candidate = candidateFromApifyItem({
      title: "LM Realtors",
      totalScore: 4.7,
      reviewsCount: 290,
      city: "Nairobi",
      countryCode: "KE",
      website: "https://www.lmrealtors.ke/",
      phone: "+254 736 096805",
      emails: ["info@lmrealtors.ke"],
      categories: ["Real estate agency"],
      categoryName: "Real estate agency",
      url: "https://www.google.com/maps/search/?api=1&query=LM%20Realtors&query_place_id=ChIJ5fWmS7wXLxgR-mDkw9jlTNc",
      imageUrl: "https://lh3.googleusercontent.com/very-long-image",
      youtubes: ["https://youtube.com/watch?v=1"],
    });

    expect(candidate).toMatchObject({
      name: "LM Realtors",
      website: "https://www.lmrealtors.ke/",
      domain: "lmrealtors.ke",
      country: "Kenya",
      city: "Nairobi",
      industry: "Real estate agency",
      email: "info@lmrealtors.ke",
      phone: "+254 736 096805",
    });
    expect(candidate?.source_metadata).toMatchObject({
      placeId: "ChIJ5fWmS7wXLxgR-mDkw9jlTNc",
      emails: ["info@lmrealtors.ke"],
      totalScore: 4.7,
    });
    expect(JSON.stringify(candidate?.source_metadata)).not.toContain("googleusercontent");
    expect(JSON.stringify(candidate?.source_metadata)).not.toContain("youtubes");
  });
});

describe("isBusinessPlace", () => {
  it("keeps real estate firms and drops malls and landmarks", () => {
    expect(isBusinessPlace({
      title: "Pazuri at Vipingo",
      categoryName: "Real estate developer",
      categories: ["Real estate developer", "Gated community", "Restaurant", "Swimming pool"],
    })).toBe(true);
    expect(isBusinessPlace({
      title: "City Mall Nyali",
      categoryName: "Shopping mall",
      categories: ["Shopping mall"],
    })).toBe(false);
    expect(isBusinessPlace({
      title: "AAC Kenya",
      categoryName: "Landmark",
      categories: ["Landmark", "Tourist attraction"],
    })).toBe(false);
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
