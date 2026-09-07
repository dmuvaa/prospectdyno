import type { Candidate } from "@prospectdyno/shared";
import { normalizeDomain, websiteFromDomain } from "./normalize";

type ApifyItem = Record<string, unknown>;

export type CrawledSite = {
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  text: string;
  pages: number;
};

const DIRECTORY_DOMAINS = new Set([
  "google.com",
  "maps.google.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "yelp.com",
  "tripadvisor.com",
  "wikipedia.org",
  "apple.com",
  "bing.com",
]);

export function apifyToken() {
  const raw = process.env.APIFY_API_TOKEN?.trim() ?? "";
  if (!raw) return null;
  const match = raw.match(/apify_api_[A-Za-z0-9]+/);
  if (match?.[0]) return match[0];
  const stripped = raw.replace(/^APIFY_TOKEN=/i, "").trim();
  return stripped || null;
}

export function getGoogleMapsActorId() {
  return env("APIFY_GOOGLE_MAPS_ACTOR_ID") ?? env("APIFY_ACTOR_ID");
}

export function getContactActorId() {
  return env("APIFY_CONTACT_ACTOR_ID");
}

export function getSerpActorId() {
  return env("APIFY_SERP_ACTOR_ID");
}

export function getWebsiteCrawlerActorId() {
  return env("APIFY_WEBSITE_CRAWLER_ACTOR_ID");
}

export function getReviewsActorId() {
  return env("APIFY_REVIEWS_ACTOR_ID");
}

export function isApifyConfigured() {
  return Boolean(apifyToken() && (getGoogleMapsActorId() || getContactActorId() || getSerpActorId()));
}

export function apifyScraperStatus() {
  return {
    token: Boolean(apifyToken()),
    maps: Boolean(getGoogleMapsActorId()),
    contacts: Boolean(getContactActorId()),
    serp: Boolean(getSerpActorId()),
    website: Boolean(getWebsiteCrawlerActorId()),
    reviews: Boolean(getReviewsActorId()),
  };
}

function env(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export function encodeActorId(actorId: string) {
  return actorId.replace("/", "~");
}

export function buildGoogleMapsInput(input: {
  queries: string[];
  location?: string | null;
  limit?: number;
  scrapeContacts?: boolean;
}) {
  const queries = input.queries.map((query) => query.trim()).filter(Boolean).slice(0, 8);
  const perSearchLimit = Math.max(1, Math.ceil((input.limit ?? 25) / Math.max(queries.length, 1)));

  return {
    searchStringsArray: queries,
    locationQuery: input.location || undefined,
    maxCrawledPlacesPerSearch: Math.min(perSearchLimit, 20),
    language: "en",
    website: "allPlaces",
    skipClosedPlaces: true,
    scrapePlaceDetailPage: Boolean(input.scrapeContacts),
    scrapeContacts: Boolean(input.scrapeContacts),
    includeWebResults: false,
  };
}

export function buildSerpInput(input: { queries: string[]; locations: string[]; limit?: number }) {
  const locations = input.locations.filter(Boolean);
  const queries = input.queries
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((query) => (locations[0] && !query.toLowerCase().includes(locations[0].toLowerCase()) ? `${query} ${locations[0]}` : query));

  return {
    queries: queries.join("\n"),
    maxPagesPerQuery: 1,
  };
}

export function buildWebsiteCrawlerInput(urls: string[]) {
  const startUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 25).map((url) => ({ url }));
  return {
    startUrls,
    crawlerType: "playwright:adaptive",
    maxCrawlDepth: 1,
    maxCrawlPages: Math.min(startUrls.length * 2, 40),
    maxRequestRetries: 1,
    includeUrlGlobs: [],
    excludeUrlGlobs: ["/**/*.pdf", "/**/login*", "/**/cart*", "/**/checkout*"],
  };
}

export function buildReviewsInput(placeUrls: string[]) {
  return {
    startUrls: [...new Set(placeUrls)].slice(0, 25).map((url) => ({ url })),
    maxReviews: 8,
    reviewsSort: "newest",
    language: "en",
  };
}

export function buildContactInput(placeUrls: string[]) {
  return {
    startUrls: [...new Set(placeUrls)].slice(0, 25).map((url) => ({ url })),
    maxCrawledPlaces: Math.min(placeUrls.length, 25),
    language: "en",
    scrapeContacts: true,
    website: "allPlaces",
  };
}

export async function fetchApifyCandidates(input: {
  queries: string[];
  locations: string[];
  limit?: number;
}): Promise<Candidate[]> {
  const token = apifyToken();
  const mapsActor = getGoogleMapsActorId();
  const contactActor = getContactActorId();
  const serpActor = getSerpActorId();
  const reviewsActor = getReviewsActorId();
  const discoveryActor = mapsActor ?? contactActor;

  if (!token || (!discoveryActor && !serpActor)) {
    throw new Error("Apify is not configured. Add APIFY_API_TOKEN and a Maps, contact, or SERP actor id.");
  }

  const queries = input.queries.map((query) => query.trim()).filter(Boolean);
  if (queries.length === 0) return [];

  const locations = input.locations.length > 0 ? input.locations : [null];
  const limit = input.limit ?? 25;
  const candidates: Candidate[] = [];

  const add = (candidate: Candidate | null) => {
    if (!candidate) return;
    const existing = candidate.domain
      ? candidates.find((row) => row.domain === candidate.domain)
      : candidates.find((row) => row.name === candidate.name && row.city === candidate.city);
    if (existing) {
      mergeCandidate(existing, candidate);
      return;
    }
    candidates.push(candidate);
  };

  const [mapsResult, serpResult] = await Promise.allSettled([
    discoveryActor
      ? runMapsDiscovery(
          token,
          discoveryActor,
          queries,
          locations,
          limit,
          Boolean(contactActor && discoveryActor === contactActor),
        )
      : Promise.resolve([] as ApifyItem[]),
    serpActor ? runSerpDiscovery(token, serpActor, queries, input.locations, limit) : Promise.resolve([] as ApifyItem[]),
  ]);

  if (mapsResult.status === "fulfilled") {
    for (const item of mapsResult.value) add(toCandidate(item, "apify"));
  } else {
    console.warn("Apify Maps discovery failed:", mapsResult.reason instanceof Error ? mapsResult.reason.message : mapsResult.reason);
  }

  if (serpResult.status === "fulfilled") {
    for (const item of serpItemsToCandidates(serpResult.value)) add(item);
  } else {
    console.warn("Apify SERP discovery failed:", serpResult.reason instanceof Error ? serpResult.reason.message : serpResult.reason);
  }

  if (candidates.length === 0) {
    const reason =
      mapsResult.status === "rejected"
        ? mapsResult.reason
        : serpResult.status === "rejected"
          ? serpResult.reason
          : null;
    throw reason instanceof Error ? reason : new Error("Apify returned no companies.");
  }

  if (candidates.length === 0) return [];

  const placeUrls = candidates.map(placeUrlFromCandidate).filter((url): url is string => Boolean(url));

  if (contactActor && contactActor !== discoveryActor && placeUrls.length > 0) {
    try {
      const items = await runActor(token, contactActor, buildContactInput(placeUrls), 240_000);
      for (const item of items) add(toCandidate(item, "apify"));
    } catch (error) {
      console.warn("Apify contact scraper failed:", error instanceof Error ? error.message : error);
    }
  }

  if (reviewsActor && placeUrls.length > 0) {
    try {
      const items = await runActor(token, reviewsActor, buildReviewsInput(placeUrls), 240_000);
      attachReviews(candidates, items);
    } catch (error) {
      console.warn("Apify reviews scraper failed:", error instanceof Error ? error.message : error);
    }
  }

  return candidates.slice(0, limit);
}

async function runMapsDiscovery(
  token: string,
  actorId: string,
  queries: string[],
  locations: Array<string | null>,
  limit: number,
  scrapeContacts: boolean,
) {
  const items: ApifyItem[] = [];
  for (const location of locations.slice(0, 8)) {
    const batch = await runActor(
      token,
      actorId,
      buildGoogleMapsInput({ queries, location, limit, scrapeContacts }),
      180_000,
    );
    items.push(...batch);
    if (items.length >= limit * 2) break;
  }
  return items;
}

async function runSerpDiscovery(
  token: string,
  actorId: string,
  queries: string[],
  locations: string[],
  limit: number,
) {
  return runActor(token, actorId, buildSerpInput({ queries, locations, limit }), 180_000);
}

export async function crawlWebsitePages(urls: string[]): Promise<Map<string, CrawledSite>> {
  const token = apifyToken();
  const actorId = getWebsiteCrawlerActorId();
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  const byKey = new Map<string, CrawledSite>();
  if (!token || !actorId || unique.length === 0) return byKey;

  const items = await runActor(token, actorId, buildWebsiteCrawlerInput(unique), 300_000);
  for (const item of items) {
    const url = firstText(item.url, item.loadedUrl, item.canonicalUrl);
    if (!url) continue;
    const domain = normalizeDomain(url);
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const text = firstText(item.text, item.markdown, item.content) ?? "";
    const key = domain ?? url;
    const current = byKey.get(key);
    byKey.set(key, {
      url: current?.url ?? url,
      domain,
      title: current?.title ?? firstText(metadata.title, item.title),
      description: current?.description ?? firstText(metadata.description, item.description),
      text: [current?.text, text].filter(Boolean).join("\n\n").trim(),
      pages: (current?.pages ?? 0) + 1,
    });
  }
  return byKey;
}

export function crawledSiteFor(map: Map<string, CrawledSite>, website: string | null | undefined) {
  if (!website) return null;
  const domain = normalizeDomain(website);
  if (domain && map.has(domain)) return map.get(domain) ?? null;
  return map.get(website) ?? null;
}

async function runActor(
  token: string,
  actorId: string,
  actorInput: Record<string, unknown>,
  timeoutMs = 180_000,
) {
  const encoded = encodeActorId(actorId);
  const startResponse = await fetch(
    `https://api.apify.com/v2/acts/${encoded}/runs?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(actorInput),
    },
  );

  if (!startResponse.ok) {
    const detail = await apifyErrorDetail(startResponse);
    throw new Error(`Apify run failed (${startResponse.status}) for ${actorId}${detail}.`);
  }

  const started = (await startResponse.json()) as {
    data?: { id?: string; status?: string; defaultDatasetId?: string };
  };
  const runId = started.data?.id;
  if (!runId) throw new Error(`Apify did not return a run id for ${actorId}.`);

  let status = started.data?.status ?? "RUNNING";
  let datasetId = started.data?.defaultDatasetId;
  const deadline = Date.now() + timeoutMs;

  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) {
      throw new Error(`Apify run timed out for ${actorId}.`);
    }
    await sleep(4000);
    const poll = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
    );
    if (!poll.ok) throw new Error(`Could not poll Apify run for ${actorId}.`);
    const body = (await poll.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    status = body.data?.status ?? status;
    datasetId = body.data?.defaultDatasetId ?? datasetId;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run ${status.toLowerCase()} for ${actorId}.`);
  }
  if (!datasetId) return [];

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true`,
  );
  if (!itemsResponse.ok) {
    throw new Error(`Could not read Apify results for ${actorId}.`);
  }

  return (await itemsResponse.json()) as ApifyItem[];
}

function serpItemsToCandidates(items: ApifyItem[]): Candidate[] {
  const rows: ApifyItem[] = [];
  for (const item of items) {
    if (Array.isArray(item.organicResults)) {
      rows.push(...item.organicResults.filter(isRecord));
    } else {
      rows.push(item);
    }
  }

  return rows
    .map((row) => toCandidate(row, "apify"))
    .filter((candidate): candidate is Candidate => {
      if (!candidate) return false;
      const domain = candidate.domain ?? "";
      return !DIRECTORY_DOMAINS.has(domain) && !domain.endsWith(".google.com");
    });
}

function toCandidate(item: ApifyItem, source: Candidate["source"]): Candidate | null {
  const mapsUrl = firstText(item.placeUrl, item.googleMapsUri, item.googleMapsUrl, mapsLike(item.url));
  const website = firstText(item.website, item.websiteUrl, websiteLike(item.url), websiteLike(item.link), item.domain);
  const domain = normalizeDomain(website);
  const name = firstText(item.name, item.title, item.placeName, item.businessName) ?? domain;
  if (!name) return null;

  const categories = Array.isArray(item.categories)
    ? item.categories.filter((value): value is string => typeof value === "string")
    : [];

  return {
    name,
    website: website ?? websiteFromDomain(domain),
    domain,
    country: firstText(item.country, item.addressCountry),
    city: firstText(item.city, item.addressCity, item.neighborhood),
    industry: firstText(item.categoryName, item.category, item.industry) ?? categories[0] ?? null,
    description: firstText(item.description, item.about, item.subtitle, item.snippet),
    email: firstText(item.email, item.emailAddress, item.emails),
    phone: firstText(item.phone, item.phoneNumber, item.phoneUnformatted),
    source,
    source_metadata: {
      ...item,
      placeUrl: mapsUrl ?? firstText(item.url),
    },
  };
}

function mapsLike(value: unknown) {
  const text = firstText(value);
  if (!text) return null;
  return /google\.[^/]+\/maps/i.test(text) ? text : null;
}

function websiteLike(value: unknown) {
  const text = firstText(value);
  if (!text) return null;
  return /google\.[^/]+\/maps/i.test(text) ? null : text;
}

function mergeCandidate(target: Candidate, incoming: Candidate) {
  target.website ||= incoming.website;
  target.domain ||= incoming.domain;
  target.email ||= incoming.email;
  target.phone ||= incoming.phone;
  target.country ||= incoming.country;
  target.city ||= incoming.city;
  target.industry ||= incoming.industry;
  target.description ||= incoming.description;
  target.source_metadata = { ...(incoming.source_metadata ?? {}), ...(target.source_metadata ?? {}) };
}

function attachReviews(candidates: Candidate[], items: ApifyItem[]) {
  for (const item of items) {
    const reviews = Array.isArray(item.reviews) ? item.reviews.filter(isRecord) : [item];
    const place = firstText(item.url, item.placeUrl, item.googleMapsUrl, item.title, item.name);
    const normalized = reviews
      .map((review) => ({
        text: firstText(review.text, review.reviewText, review.snippet, review.comment),
        stars: numberValue(review.stars, review.rating),
      }))
      .filter((review) => review.text);

    if (normalized.length === 0) continue;

    const match = candidates.find((candidate) => {
      const url = placeUrlFromCandidate(candidate);
      return (
        (place && url && url.includes(place)) ||
        (place && candidate.name.toLowerCase() === place.toLowerCase()) ||
        (place && candidate.domain && place.includes(candidate.domain))
      );
    });
    if (!match) continue;
    match.source_metadata = {
      ...(match.source_metadata ?? {}),
      reviews: normalized,
    };
  }
}

function placeUrlFromCandidate(candidate: Candidate) {
  const metadata = candidate.source_metadata ?? {};
  return firstText(metadata.placeUrl, metadata.url, metadata.googleMapsUri, metadata.googleMapsUrl);
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstText(...value);
      if (nested) return nested;
      continue;
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function isRecord(value: unknown): value is ApifyItem {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apifyErrorDetail(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string };
    const message = body.error?.message ?? body.message;
    if (typeof message === "string" && message.trim()) {
      return `: ${message.trim().slice(0, 300)}`;
    }
  } catch {
    // Ignore non-JSON error bodies.
  }
  return "";
}
