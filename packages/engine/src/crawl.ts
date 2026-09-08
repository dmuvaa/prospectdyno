import * as cheerio from "cheerio";
import type { WebsiteAuditSummary, WebsiteScores } from "@prospectdyno/shared";
import { crawledSiteFor, crawlWebsitePages, type CrawledSite } from "./apify";
import { clampScore } from "./normalize";

const UA =
  "Mozilla/5.0 (compatible; ProspectDyno/0.1; +https://prospectdyno.com; research bot)";

export async function analyzeWebsite(
  url: string,
  crawled?: CrawledSite | null,
  signal?: AbortSignal,
  options?: { skipCrawlFallback?: boolean },
): Promise<{
  summary: WebsiteAuditSummary;
  scores: WebsiteScores;
  htmlExcerpt: string;
  emails: string[];
}> {
  const fetched = await fetchWebsiteDeep(url, signal).catch(() => null);
  let crawledSite = crawled ?? null;
  if (!options?.skipCrawlFallback && isThinWebsiteAnalysis(fetched) && !crawledSite?.text) {
    const extras = relatedPageUrls(url);
    const crawledMap = await withCrawlSlot(() => crawlWebsitePages(extras, signal)).catch(() => new Map<string, CrawledSite>());
    crawledSite = crawledSiteFor(crawledMap, url) ?? [...crawledMap.values()][0] ?? null;
  }
  if (fetched && crawledSite?.text) {
    const crawledText = crawledSite.text.replace(/\s+/g, " ").trim();
    const emails = uniqueEmails([...fetched.emails, ...extractEmails(crawledText, url)]);
    const summary = {
      ...fetched.summary,
      title: fetched.summary.title || crawledSite.title,
      description: fetched.summary.description || crawledSite.description,
      word_count: Math.max(fetched.summary.word_count, crawledText.split(/\s+/).filter(Boolean).length),
      has_form: fetched.summary.has_form || /contact|form|get in touch/i.test(crawledText),
      has_tel: fetched.summary.has_tel || /\+?\d[\d\s().-]{7,}/.test(crawledText),
      has_mailto: fetched.summary.has_mailto || emails.length > 0,
    };
    return {
      summary,
      scores: scoreSummary(summary, crawledText.length),
      htmlExcerpt: crawledText.slice(0, 4000),
      emails,
    };
  }
  if (crawledSite?.text) return fromCrawled(crawledSite);
  if (fetched) return fetched;
  throw new Error(`Could not fetch ${url}`);
}

export function isThinWebsiteAnalysis(
  result: { summary: { word_count: number }; htmlExcerpt: string } | null,
) {
  if (!result) return true;
  return result.summary.word_count < 120 || result.htmlExcerpt.replace(/\s+/g, " ").trim().length < 400;
}

async function fetchWebsiteDeep(url: string, signal?: AbortSignal) {
  const home = await fetchWebsite(url, signal);
  if (!isThinWebsiteAnalysis(home)) return home;

  const extras = relatedPageUrls(url).slice(1);
  const pages = await Promise.all(extras.map((page) => fetchWebsite(page, signal).catch(() => null)));
  const texts = [home.htmlExcerpt, ...pages.filter(Boolean).map((page) => page!.htmlExcerpt)].filter(Boolean);
  const emails = uniqueEmails([home.emails, ...pages.filter(Boolean).map((page) => page!.emails)].flat());
  const wordCount = texts.join(" ").split(/\s+/).filter(Boolean).length;
  if (wordCount <= home.summary.word_count) return home;

  return {
    summary: {
      ...home.summary,
      word_count: wordCount,
      has_form: home.summary.has_form || pages.some((page) => page?.summary.has_form),
      has_tel: home.summary.has_tel || pages.some((page) => page?.summary.has_tel) || /\+?\d[\d\s().-]{7,}/.test(texts.join(" ")),
      has_mailto: home.summary.has_mailto || emails.length > 0,
    },
    scores: scoreSummary(
      {
        ...home.summary,
        word_count: wordCount,
        has_form: home.summary.has_form || pages.some((page) => page?.summary.has_form),
        has_tel: home.summary.has_tel || pages.some((page) => page?.summary.has_tel),
        has_mailto: home.summary.has_mailto || emails.length > 0,
      },
      texts.join(" ").length,
    ),
    htmlExcerpt: texts.join("\n\n").slice(0, 4000),
    emails,
  };
}

const crawlWaiters: Array<() => void> = [];
let crawlActive = 0;
const MAX_PARALLEL_CRAWLS = 2;

async function withCrawlSlot<T>(action: () => Promise<T>): Promise<T> {
  if (crawlActive >= MAX_PARALLEL_CRAWLS) {
    await new Promise<void>((resolve) => crawlWaiters.push(resolve));
  }
  crawlActive += 1;
  try {
    return await action();
  } finally {
    crawlActive -= 1;
    crawlWaiters.shift()?.();
  }
}

export function relatedPageUrls(url: string) {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return [...new Set([
      parsed.toString(),
      new URL("/contact", parsed.origin).toString(),
      new URL("/contact-us", parsed.origin).toString(),
      new URL("/about", parsed.origin).toString(),
    ])];
  } catch {
    return [url];
  }
}

export function sellerSiteUrls(url: string) {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return [...new Set([
      parsed.toString(),
      new URL("/about", parsed.origin).toString(),
      new URL("/about-us", parsed.origin).toString(),
      new URL("/services", parsed.origin).toString(),
      new URL("/solutions", parsed.origin).toString(),
      new URL("/work", parsed.origin).toString(),
      new URL("/our-work", parsed.origin).toString(),
      new URL("/case-studies", parsed.origin).toString(),
      new URL("/industries", parsed.origin).toString(),
      new URL("/who-we-serve", parsed.origin).toString(),
      new URL("/clients", parsed.origin).toString(),
      new URL("/pricing", parsed.origin).toString(),
      new URL("/contact", parsed.origin).toString(),
      new URL("/company", parsed.origin).toString(),
    ])];
  } catch {
    return [url];
  }
}

export type SellerSiteDossier = {
  url: string;
  title: string | null;
  description: string | null;
  technologies: string[];
  emails: string[];
  excerpt: string;
  wordCount: number;
};

export async function inspectSellerWebsite(url: string): Promise<SellerSiteDossier> {
  const normalized = url.includes("://") ? url : `https://${url}`;
  const pages = sellerSiteUrls(normalized);
  const fetched = await Promise.all(pages.map((page) => fetchWebsite(page).catch(() => null)));
  const usable = fetched.filter((page): page is NonNullable<typeof page> => Boolean(page && page.htmlExcerpt.trim()));
  const home = fetched[0] ?? usable[0];
  if (!home) throw new Error(`Could not fetch ${normalized}`);
  const excerpt = usable.map((page) => page.htmlExcerpt).join("\n\n").replace(/\s+/g, " ").trim() || home.htmlExcerpt;
  const emails = uniqueEmails(usable.flatMap((page) => page.emails));
  const technologies = [...new Set(usable.flatMap((page) => page.summary.technologies))];

  return {
    url: normalized,
    title: home.summary.title,
    description: home.summary.description,
    technologies,
    emails,
    excerpt: excerpt.slice(0, 8000),
    wordCount: excerpt.split(/\s+/).filter(Boolean).length,
  };
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
    has_tel: $('a[href^="tel:"]').length > 0 || /\+?\d[\d\s().-]{7,}/.test(text),
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
