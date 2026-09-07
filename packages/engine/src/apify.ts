import type { Candidate } from "@prospectdyno/shared";
import { normalizeDomain, websiteFromDomain } from "./normalize";

type ApifyItem = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function fetchApifyCandidates(input: {
  queries: string[];
  locations: string[];
  limit?: number;
}): Promise<Candidate[]> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID;
  if (!token || !actorId) {
    throw new Error("Apify is not configured. Add APIFY_API_TOKEN and APIFY_ACTOR_ID.");
  }

  const searchStrings = input.queries.flatMap((query) =>
    input.locations.length > 0 ? input.locations.map((location) => `${query} ${location}`) : [query],
  );

  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queries: searchStrings.slice(0, 8),
        maxItems: input.limit ?? 25,
      }),
    },
  );

  if (!runResponse.ok) {
    throw new Error(`Apify run failed (${runResponse.status}).`);
  }

  const run = (await runResponse.json()) as { data?: { defaultDatasetId?: string } };
  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId) {
    return [];
  }

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true`,
  );
  if (!itemsResponse.ok) {
    throw new Error("Could not read Apify results.");
  }

  const items = (await itemsResponse.json()) as ApifyItem[];
  const candidates: Candidate[] = [];
  for (const item of items) {
    const website = text(item.website) ?? text(item.url) ?? text(item.domain);
    const domain = normalizeDomain(website);
    const name = text(item.name) ?? text(item.title) ?? domain;
    if (!name) continue;
    candidates.push({
      name,
      website: website ?? websiteFromDomain(domain),
      domain,
      country: text(item.country),
      city: text(item.city),
      industry: text(item.category) ?? text(item.industry),
      description: text(item.description),
      source: "apify",
      source_metadata: item,
    });
  }
  return candidates;
}
