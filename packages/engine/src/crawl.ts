import * as cheerio from "cheerio";
import type { WebsiteAuditSummary, WebsiteScores } from "@prospectdyno/shared";
import { clampScore } from "./normalize";

const UA =
  "Mozilla/5.0 (compatible; ProspectDyno/0.1; +https://prospectdyno.com; research bot)";

export async function analyzeWebsite(url: string): Promise<{
  summary: WebsiteAuditSummary;
  scores: WebsiteScores;
  htmlExcerpt: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let html = "";
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html" },
    });
    html = await response.text();
  } finally {
    clearTimeout(timer);
  }

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const technologies = detectTechnologies(html, $);
  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 5);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const summary: WebsiteAuditSummary = {
    title: $("title").first().text().trim() || null,
    description: $('meta[name="description"]').attr("content")?.trim() || null,
    h1,
    canonical: $('link[rel="canonical"]').attr("href") || null,
    robots: $('meta[name="robots"]').attr("content") || null,
    generator: $('meta[name="generator"]').attr("content") || null,
    technologies,
    has_form: $("form").length > 0,
    has_tel: $('a[href^="tel:"]').length > 0,
    has_mailto: $('a[href^="mailto:"]').length > 0,
    has_viewport: $('meta[name="viewport"]').length > 0,
    word_count: text.split(" ").filter(Boolean).length,
  };

  const seo =
    (summary.title ? 20 : 0) +
    (summary.description ? 20 : 0) +
    (h1.length ? 15 : 0) +
    (summary.canonical ? 15 : 0) +
    (summary.robots ? 10 : 0) +
    (summary.word_count > 200 ? 20 : summary.word_count > 50 ? 10 : 0);

  const technical =
    (summary.has_viewport ? 25 : 0) +
    (summary.canonical ? 20 : 0) +
    (technologies.length ? 20 : 5) +
    (html.length > 500 ? 20 : 10) +
    (summary.generator ? 15 : 10);

  const ux = (summary.has_viewport ? 40 : 10) + (h1.length ? 20 : 0) + (summary.word_count > 80 ? 25 : 10);
  const conversion = (summary.has_form ? 40 : 10) + (summary.has_tel ? 25 : 0) + (summary.has_mailto ? 20 : 0);
  const performance = html.length < 400_000 ? 70 : html.length < 900_000 ? 50 : 30;
  const website = clampScore((seo + technical + ux + conversion + performance) / 5);

  return {
    summary,
    scores: {
      website_score: website,
      seo_score: clampScore(seo),
      performance_score: clampScore(performance),
      ux_score: clampScore(ux),
      conversion_score: clampScore(conversion),
      technical_score: clampScore(technical),
    },
    htmlExcerpt: text.slice(0, 4000),
  };
}

function detectTechnologies(html: string, $: ReturnType<typeof cheerio.load>): string[] {
  const found = new Set<string>();
  const haystack = html.toLowerCase();
  const checks: Array<[string, boolean]> = [
    ["WordPress", haystack.includes("wp-content") || Boolean($('meta[name="generator"][content*="WordPress"]').length)],
    ["Webflow", haystack.includes("webflow")],
    ["Shopify", haystack.includes("cdn.shopify.com") || haystack.includes("myshopify")],
    ["Wix", haystack.includes("wix.com") || haystack.includes("wixstatic")],
    ["Squarespace", haystack.includes("squarespace")],
    ["Next.js", haystack.includes("__next") || haystack.includes("_next/static")],
    ["React", haystack.includes("react")],
    ["Google Analytics", haystack.includes("gtag(") || haystack.includes("google-analytics")],
    ["Google Tag Manager", haystack.includes("googletagmanager.com")],
  ];
  for (const [name, match] of checks) {
    if (match) found.add(name);
  }
  return [...found];
}
