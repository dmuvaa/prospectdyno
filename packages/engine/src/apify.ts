import type { Candidate } from "@prospectdyno/shared";
import { normalizeDomain, websiteFromDomain } from "./normalize";

type ApifyItem = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const found = text(value);
    if (found) return found;
  }
  return null;
}

export function getGoogleMapsActorId() {
  return process.env.APIFY_GOOGLE_MAPS_ACTOR_ID ?? process.env.APIFY_ACTOR_ID ?? null;
}

export function buildGoogleMapsInput(input: {
  queries: string[];
  location?: string | null;
  limit?: number;
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
    scrapePlaceDetailPage: false,
    scrapeContacts: false,
    includeWebResults: false,
  };
}

export async function fetchApifyCandidates(input: {
  queries: string[];
  locations: string[];
  limit?: number;
}): Promise<Candidate[]> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = getGoogleMapsActorId();
  if (!token || !actorId) {
    throw new Error("Apify is not configured. Add APIFY_API_TOKEN and APIFY_GOOGLE_MAPS_ACTOR_ID.");
  }

  const queries = input.queries.map((query) => query.trim()).filter(Boolean);
  if (queries.length === 0) return [];

  const locations = input.locations.length > 0 ? input.locations : [null];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const location of locations.slice(0, 8)) {
    const runInput = buildGoogleMapsInput({
      queries,
      location,
      limit: input.limit ?? 25,
    });
    const items = await runActor(token, actorId, runInput);
    for (const candidate of items.map(toCandidate)) {
      if (!candidate) continue;
      const key = candidate.domain ?? candidate.website ?? `${candidate.name}:${candidate.city ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
      if (candidates.length >= (input.limit ?? 25)) return candidates;
    }
  }

  return candidates;
}

async function runActor(token: string, actorId: string, actorInput: Record<string, unknown>) {
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(actorInput),
    },
  );

  if (!runResponse.ok) {
    throw new Error(`Apify run failed (${runResponse.status}).`);
  }

  const run = (await runResponse.json()) as { data?: { defaultDatasetId?: string } };
  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId) return [];

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true`,
  );
  if (!itemsResponse.ok) {
    throw new Error("Could not read Apify results.");
  }

  return (await itemsResponse.json()) as ApifyItem[];
}

function toCandidate(item: ApifyItem): Candidate | null {
  const website = firstText(item.website, item.websiteUrl, item.url, item.domain);
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
    description: firstText(item.description, item.about, item.subtitle),
    email: firstText(item.email, item.emailAddress),
    phone: firstText(item.phone, item.phoneNumber, item.phoneUnformatted),
    source: "apify",
    source_metadata: item,
  };
}
