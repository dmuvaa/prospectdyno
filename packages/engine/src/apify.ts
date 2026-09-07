import type { Candidate } from "@prospectdyno/shared";
import { emailsFromUnknown } from "./emails";
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
  const perSearchLimit = Math.min(50, Math.max(5, Math.ceil((input.limit ?? 25) / Math.max(queries.length, 1))));

  return {
    searchStringsArray: queries,
    locationQuery: input.location || undefined,
    maxCrawledPlacesPerSearch: perSearchLimit,
    language: "en",
    website: "allPlaces",
    skipClosedPlaces: true,
    scrapePlaceDetailPage: false,
    scrapeContacts: Boolean(input.scrapeContacts),
    includeWebResults: false,
    searchMatching: "all",
    placeMinimumStars: "",
    scrapeTableReservationProvider: false,
    scrapeOrderOnline: false,
    scrapeDirectories: false,
    maxQuestions: 0,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: false,
      youtubes: false,
      tiktoks: false,
      twitters: false,
    },
    maximumLeadsEnrichmentRecords: 0,
    verifyLeadsEnrichmentEmails: false,
    maxReviews: 0,
    reviewsSort: "newest",
    reviewsOrigin: "all",
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
  const startUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 12).map((url) => ({ url }));
  return {
    startUrls,
    crawlerType: "playwright:adaptive",
    maxCrawlDepth: 0,
    maxCrawlPages: Math.max(startUrls.length, 1),
    maxRequestRetries: 0,
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
  const startUrls = [...new Set(placeUrls.filter(Boolean))].slice(0, 50).map((url) => ({ url }));
  return {
    startUrls,
    maxCrawledPlaces: startUrls.length,
    language: "en",
    scrapeContacts: true,
    website: "allPlaces",
    searchMatching: "all",
    placeMinimumStars: "",
    skipClosedPlaces: false,
    scrapePlaceDetailPage: false,
    scrapeTableReservationProvider: false,
    scrapeOrderOnline: false,
    includeWebResults: false,
    scrapeDirectories: false,
    maxQuestions: 0,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: false,
      youtubes: false,
      tiktoks: false,
      twitters: false,
    },
    maximumLeadsEnrichmentRecords: 0,
    verifyLeadsEnrichmentEmails: false,
  };
}

export async function fetchApifyCandidates(input: {
  queries: string[];
  locations: string[];
  limit?: number;
  enrichContacts?: boolean;
  includeReviews?: boolean;
  includeSerp?: boolean;
  signal?: AbortSignal;
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
  const useSerp = Boolean(serpActor && (input.includeSerp ?? !mapsActor));

  const add = (candidate: Candidate | null) => {
    if (!candidate) return;
    const placeId = placeIdFrom(candidate.source_metadata ?? {});
    const existing = candidates.find((row) => {
      const existingPlaceId = placeIdFrom(row.source_metadata ?? {});
      if (placeId && existingPlaceId && placeId === existingPlaceId) return true;
      if (candidate.domain && row.domain && candidate.domain === row.domain) return true;
      return !candidate.domain && !row.domain && row.name === candidate.name && row.city === candidate.city;
    });
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
          input.signal,
        )
      : Promise.resolve([] as ApifyItem[]),
    useSerp ? runSerpDiscovery(token, serpActor!, queries, input.locations, limit, input.signal) : Promise.resolve([] as ApifyItem[]),
  ]);

  if (mapsResult.status === "fulfilled") {
    for (const item of mapsResult.value) {
      if (!isBusinessPlace(item)) continue;
      add(toCandidate(item, "apify"));
    }
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

  if (input.enrichContacts && contactActor && contactActor !== discoveryActor && placeUrls.length > 0) {
    await mergeContactItems(candidates, add, token, contactActor, placeUrls, input.signal);
  }

  if (input.includeReviews && reviewsActor && placeUrls.length > 0) {
    try {
      const items = await runActor(token, reviewsActor, buildReviewsInput(placeUrls), 240_000, input.signal);
      attachReviews(candidates, items);
    } catch (error) {
      console.warn("Apify reviews scraper failed:", error instanceof Error ? error.message : error);
    }
  }

  return candidates.slice(0, limit);
}

export async function fetchApifySerpCandidates(input: {
  queries: string[];
  locations: string[];
  limit?: number;
  signal?: AbortSignal;
}): Promise<Candidate[]> {
  const token = apifyToken();
  const serpActor = getSerpActorId();
  if (!token || !serpActor) return [];
  const queries = input.queries.map((query) => query.trim()).filter(Boolean);
  if (queries.length === 0) return [];

  const items = await runSerpDiscovery(token, serpActor, queries, input.locations, input.limit ?? 25, input.signal);
  return serpItemsToCandidates(items).slice(0, input.limit ?? 25);
}

export async function enrichApifyContacts(candidates: Candidate[], signal?: AbortSignal): Promise<Candidate[]> {
  const token = apifyToken();
  const contactActor = getContactActorId();
  const mapsActor = getGoogleMapsActorId();
  if (!token || !contactActor || contactActor === mapsActor) return candidates;

  const placeUrls = candidates.map(placeUrlFromCandidate).filter((url): url is string => Boolean(url));
  if (placeUrls.length === 0) return candidates;

  const add = (incoming: Candidate | null) => {
    if (!incoming) return;
    const placeId = placeIdFrom(incoming.source_metadata ?? {});
    const existing = candidates.find((row) => {
      const existingPlaceId = placeIdFrom(row.source_metadata ?? {});
      if (placeId && existingPlaceId && placeId === existingPlaceId) return true;
      if (incoming.domain && row.domain && incoming.domain === row.domain) return true;
      return row.name === incoming.name;
    });
    if (existing) mergeCandidate(existing, incoming);
  };

  await mergeContactItems(candidates, add, token, contactActor, placeUrls, signal);
  return candidates;
}

async function mergeContactItems(
  _candidates: Candidate[],
  add: (candidate: Candidate | null) => void,
  token: string,
  contactActor: string,
  placeUrls: string[],
  signal?: AbortSignal,
) {
  try {
    const items = await runActor(token, contactActor, buildContactInput(placeUrls), 240_000, signal);
    for (const item of items) add(toCandidate(item, "apify"));
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn("Apify contact scraper failed:", error instanceof Error ? error.message : error);
  }
}

async function runMapsDiscovery(
  token: string,
  actorId: string,
  queries: string[],
  locations: Array<string | null>,
  limit: number,
  scrapeContacts: boolean,
  signal?: AbortSignal,
) {
  const items: ApifyItem[] = [];
  for (const location of locations.slice(0, 8)) {
    if (signal?.aborted) throw new Error("Stopped.");
    const batch = await runActor(
      token,
      actorId,
      buildGoogleMapsInput({ queries, location, limit, scrapeContacts }),
      180_000,
      signal,
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
  signal?: AbortSignal,
) {
  return runActor(token, actorId, buildSerpInput({ queries, locations, limit }), 180_000, signal);
}

export async function crawlWebsitePages(urls: string[], signal?: AbortSignal): Promise<Map<string, CrawledSite>> {
  const token = apifyToken();
  const actorId = getWebsiteCrawlerActorId();
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  const byKey = new Map<string, CrawledSite>();
  if (!token || !actorId || unique.length === 0) return byKey;

  const items = await runActor(token, actorId, buildWebsiteCrawlerInput(unique), 90_000, signal);
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
  signal?: AbortSignal,
) {
  if (signal?.aborted) throw new Error("Stopped.");
  const encoded = encodeActorId(actorId);
  const startResponse = await fetch(
    `https://api.apify.com/v2/acts/${encoded}/runs?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(actorInput),
      signal,
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

  const abortRemote = () => {
    void fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/abort?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    ).catch(() => undefined);
  };
  signal?.addEventListener("abort", abortRemote, { once: true });

  let status = started.data?.status ?? "RUNNING";
  let datasetId = started.data?.defaultDatasetId;
  const deadline = Date.now() + timeoutMs;

  try {
    while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      if (signal?.aborted) throw new Error("Stopped.");
      if (Date.now() > deadline) {
        abortRemote();
        const partial = datasetId ? await readDatasetItems(token, datasetId).catch(() => []) : [];
        if (partial.length > 0) return partial;
        throw new Error(`Apify run timed out for ${actorId}.`);
      }
      await sleep(2000);
      const poll = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
        { signal },
      );
      if (!poll.ok) throw new Error(`Could not poll Apify run for ${actorId}.`);
      const body = (await poll.json()) as { data?: { status?: string; defaultDatasetId?: string } };
      status = body.data?.status ?? status;
      datasetId = body.data?.defaultDatasetId ?? datasetId;
    }
  } finally {
    signal?.removeEventListener("abort", abortRemote);
  }

  if (status === "ABORTED" && signal?.aborted) throw new Error("Stopped.");
  if (status !== "SUCCEEDED") {
    const partial = datasetId ? await readDatasetItems(token, datasetId).catch(() => []) : [];
    if (partial.length > 0) return partial;
    throw new Error(`Apify run ${status.toLowerCase()} for ${actorId}.`);
  }
  if (!datasetId) return [];
  return readDatasetItems(token, datasetId);
}

async function readDatasetItems(token: string, datasetId: string) {
  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true`,
  );
  if (!itemsResponse.ok) {
    throw new Error("Could not read Apify results.");
  }
  const items = (await itemsResponse.json()) as unknown;
  return Array.isArray(items) ? (items as ApifyItem[]) : [];
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

export function candidateFromApifyItem(item: ApifyItem, source: Candidate["source"] = "apify"): Candidate | null {
  const mapsUrl = firstText(item.placeUrl, item.googleMapsUri, item.googleMapsUrl, mapsLike(item.url));
  const website = firstText(item.website, item.websiteUrl, websiteLike(item.url), websiteLike(item.link));
  const domain = normalizeDomain(website);
  const name = firstText(item.title, item.name, item.placeName, item.businessName) ?? domain;
  if (!name) return null;

  const categories = stringList(item.categories);
  const emails = emailsFromUnknown([item.emails, item.email, item.emailAddress]);
  const country = countryFromCode(firstText(item.country, item.addressCountry, item.countryCode));

  return {
    name,
    website: website ?? websiteFromDomain(domain),
    domain,
    country,
    city: firstText(item.city, item.addressCity, item.neighborhood),
    industry: firstText(item.categoryName, item.category, item.industry) ?? categories[0] ?? null,
    description: firstText(item.description, item.about, item.subtitle, item.snippet),
    email: emails[0] ?? firstText(item.email, item.emailAddress),
    phone: firstText(item.phone, item.phoneNumber, item.phoneUnformatted) || null,
    source,
    source_metadata: compactPlace(item, {
      placeUrl: mapsUrl ?? firstText(item.url),
      placeId: placeIdFrom(item),
      emails,
      categories,
      totalScore: numberValue(item.totalScore),
      reviewsCount: numberValue(item.reviewsCount),
    }),
  };
}

function toCandidate(item: ApifyItem, source: Candidate["source"]): Candidate | null {
  return candidateFromApifyItem(item, source);
}

function compactPlace(item: ApifyItem, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    title: firstText(item.title, item.name),
    website: firstText(item.website),
    phone: firstText(item.phone),
    city: firstText(item.city),
    countryCode: firstText(item.countryCode),
    categoryName: firstText(item.categoryName),
    street: firstText(item.street),
    url: firstText(item.url),
    ...extra,
  };
}

function placeIdFrom(item: ApifyItem) {
  const explicit = firstText(item.placeId, item.place_id);
  if (explicit) return explicit;
  const url = firstText(item.url, item.placeUrl);
  const match = url?.match(/query_place_id=([^&]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const NON_BUSINESS_CATEGORIES = /^(landmark|tourist attraction|shopping mall|park|museum|church|swimming pool|gas station|parking lot)$/i;

export function isBusinessPlace(item: Record<string, unknown>) {
  const categories = [...stringList(item.categories), firstText(item.categoryName)].filter(
    (value): value is string => Boolean(value),
  );
  if (categories.length === 0) return true;
  return categories.some((category) => !NON_BUSINESS_CATEGORIES.test(category.trim()));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya",
  US: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
  AE: "United Arab Emirates",
  NG: "Nigeria",
  ZA: "South Africa",
  IN: "India",
  AU: "Australia",
  CA: "Canada",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  IE: "Ireland",
};

function countryFromCode(value: string | null) {
  if (!value) return null;
  return COUNTRY_NAMES[value.toUpperCase()] ?? value;
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
