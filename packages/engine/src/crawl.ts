import * as cheerio from "cheerio";
import type { WebsiteAuditSummary, WebsiteScores } from "@prospectdyno/shared";
import type { CrawledSite } from "./apify";
import { clampScore } from "./normalize";

const UA =
  "Mozilla/5.0 (compatible; ProspectDyno/0.1; +https://prospectdyno.com; research bot)";

export async function analyzeWebsite(
  url: string,
  crawled?: CrawledSite | null,
  signal?: AbortSignal,
): Promise<{
  summary: WebsiteAuditSummary;
  scores: WebsiteScores;
  htmlExcerpt: string;
  emails: string[];
}> {
  const fetched = await fetchWebsite(url, signal).catch(() => null);
  if (fetched && crawled?.text) {
    return {
      summary: {
        ...fetched.summary,
        title: fetched.summary.title || crawled.title,
        description: fetched.summary.description || crawled.description,
        word_count: Math.max(fetched.summary.word_count, crawled.text.split(/\s+/).filter(Boolean).length),
      },
      scores: fetched.scores,
      htmlExcerpt: crawled.text.slice(0, 4000),
      emails: uniqueEmails([...fetched.emails, ...extractEmails(crawled.text, url)]),
    };
  }
  if (crawled?.text) return fromCrawled(crawled);
  if (fetched) return fetched;
  throw new Error(`Could not fetch ${url}`);
}

async function fetchWebsite(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  let html = "";
  try {
    if (signal?.aborted) throw new Error("Stopped.");
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html" },
    });
    html = await response.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  return summarizeHtml(html, url);
}

function fromCrawled(crawled: CrawledSite) {
  const text = crawled.text.replace(/\s+/g, " ").trim();
  const wordCount = text.split(" ").filter(Boolean).length;
  const summary: WebsiteAuditSummary = {
    title: crawled.title,
    description: crawled.description,
    h1: [],
    canonical: crawled.url,
    robots: null,
    generator: null,
    technologies: [],
    has_form: /contact|form|get in touch/i.test(text),
    has_tel: /\+?\d[\d\s().-]{7,}/.test(text),
    has_mailto: /@/.test(text),
    has_viewport: true,
    word_count: wordCount,
  };
  return {
    summary,
    scores: scoreSummary(summary, text.length),
    htmlExcerpt: text.slice(0, 4000),
    emails: extractEmails(text, crawled.url),
  };
}

function summarizeHtml(html: string, pageUrl?: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const mailto = $("a[href^='mailto:']")
    .map((_, el) => $(el).attr("href") ?? "")
    .get()
    .join(" ");

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
    has_mailto: $('a[href^="mailto:"]').length > 0 || extractEmails(html, pageUrl).length > 0,
    has_viewport: $('meta[name="viewport"]').length > 0,
    word_count: text.split(" ").filter(Boolean).length,
  };

  return {
    summary,
    scores: scoreSummary(summary, html.length),
    htmlExcerpt: text.slice(0, 4000),
    emails: extractEmails(`${mailto} ${html}`, pageUrl),
  };
}

const JUNK_LOCAL = /^(noreply|no-reply|donotreply|privacy|legal|webmaster|mailer-daemon)$/i;
const JUNK_DOMAIN = /(?:sentry\.io|wixpress\.com|example\.com|domain\.com|email\.com|cloudflare\.com|schema\.org)$/i;

export function extractEmails(text: string, pageUrl?: string | null): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const emails = uniqueEmails(
    matches
      .map((value) => value.replace(/^mailto:/i, "").split("?")[0]?.trim().toLowerCase() ?? "")
      .filter((email) => {
        const [local, domain] = email.split("@");
        return Boolean(local && domain && !JUNK_LOCAL.test(local) && !JUNK_DOMAIN.test(domain) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(email));
      }),
  );
  const host = hostFrom(pageUrl);
  if (!host) return emails.slice(0, 8);
  const sameDomain = emails.filter((email) => email.endsWith(`@${host}`) || email.endsWith(`.${host}`));
  return uniqueEmails([...sameDomain, ...emails]).slice(0, 8);
}

function uniqueEmails(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function hostFrom(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function scoreSummary(summary: WebsiteAuditSummary, bytes: number): WebsiteScores {
  const seo =
    (summary.title ? 20 : 0) +
    (summary.description ? 20 : 0) +
    (summary.h1.length ? 15 : 0) +
    (summary.canonical ? 15 : 0) +
    (summary.robots ? 10 : 0) +
    (summary.word_count > 200 ? 20 : summary.word_count > 50 ? 10 : 0);

  const technical =
    (summary.has_viewport ? 25 : 0) +
    (summary.canonical ? 20 : 0) +
    (summary.technologies.length ? 20 : 5) +
    (bytes > 500 ? 20 : 10) +
    (summary.generator ? 15 : 10);

  const ux = (summary.has_viewport ? 40 : 10) + (summary.h1.length ? 20 : 0) + (summary.word_count > 80 ? 25 : 10);
  const conversion = (summary.has_form ? 40 : 10) + (summary.has_tel ? 25 : 0) + (summary.has_mailto ? 20 : 0);
  const performance = bytes < 400_000 ? 70 : bytes < 900_000 ? 50 : 30;

  return {
    website_score: clampScore((seo + technical + ux + conversion + performance) / 5),
    seo_score: clampScore(seo),
    performance_score: clampScore(performance),
    ux_score: clampScore(ux),
    conversion_score: clampScore(conversion),
    technical_score: clampScore(technical),
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
