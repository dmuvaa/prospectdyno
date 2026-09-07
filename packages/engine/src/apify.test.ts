import { afterEach, describe, expect, it } from "vitest";
import { buildGoogleMapsInput, getGoogleMapsActorId } from "./apify";

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
