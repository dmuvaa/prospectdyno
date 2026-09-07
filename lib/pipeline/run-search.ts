import { qualifyCompany } from "@prospectdyno/ai";
import {
  analyzeWebsite,
  crawledSiteFor,
  crawlWebsitePages,
  enrichApifyContacts,
  fetchApifyCandidates,
  fetchApifySerpCandidates,
  isThinWebsiteAnalysis,
  normalizeDomain,
  opportunityScore,
  parseCsv,
  parseUrlList,
  relatedPageUrls,
  websiteFromDomain,
} from "@prospectdyno/engine";
import { createAdminClient } from "@prospectdyno/supabase/admin";
import type { Database, Json } from "@prospectdyno/supabase/types";
import {
  CREDIT_COSTS,
  type Candidate,
  type IcpInterpretation,
  type QualificationReport,
  type SearchProvider,
} from "@prospectdyno/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { looseSupabase } from "@/lib/supabase-loose";
import { summarizeStepPayload } from "@/lib/pipeline/summarize-step";

type Admin = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["jobs"]["Row"] & {
  max_attempts: number;
};

const SEARCH_LIMIT = 25;
const SCORE_CONCURRENCY = 6;
const STOPPED_MESSAGE = "Stopped. Companies found so far were kept.";
const SCORING_VERSION = "opportunity-v1";

class SearchCancelledError extends Error {
  constructor(message = STOPPED_MESSAGE) {
    super(message);
    this.name = "SearchCancelledError";
  }
}

type SearchInput = {
  csv?: string;
  urls?: string;
  queries?: string[];
  locations?: string[];
  limit?: number;
};

export async function claimNextJob(
  admin: Admin,
  workerId: string,
  jobTypes?: string[],
): Promise<JobRow | null> {
  const { data, error } = await looseSupabase(admin).rpc<JobRow | JobRow[] | null>("claim_next_job", {
    _worker_id: workerId,
    _job_types: jobTypes ?? null,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isJobId(row?.id)) return null;
  return row as JobRow;
}

async function claimJob(admin: Admin, jobId: string, workerId: string): Promise<JobRow | null> {
  if (!isJobId(jobId)) return null;
  const { data, error } = await looseSupabase(admin).rpc<JobRow | null>("claim_job", {
    _job_id: jobId,
    _worker_id: workerId,
  });

  if (error) throw new Error(error.message);
  if (!isJobId(data?.id)) return null;
  return data as JobRow;
}

export async function processJob(
  jobId: string,
  options: { alreadyClaimed?: boolean; workerId?: string } = {},
) {
  if (!isJobId(jobId)) {
    return { skipped: true, reason: "Missing job id." };
  }

  const admin = createAdminClient();
  const workerId = options.workerId ?? `worker:${process.pid}`;
  const job = options.alreadyClaimed
    ? await getJob(admin, jobId)
    : await claimJob(admin, jobId, workerId);

  if (!job) {
    return { skipped: true, reason: "Job is not pending or is already claimed." };
  }

  return processClaimedJob(admin, job);
}

async function getJob(admin: Admin, jobId: string): Promise<JobRow | null> {
  if (!isJobId(jobId)) return null;
  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) return null;
  return { ...job, max_attempts: "max_attempts" in job ? Number(job.max_attempts) : 3 } as JobRow;
}

function isJobId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function processClaimedJob(admin: Admin, job: JobRow) {
  try {
    if (job.status === "cancelled") {
      return { cancelled: true };
    }
    if (job.job_type === "run_search" && job.entity_id) {
      const output = await runSearch(admin, job.workspace_id, job.entity_id, job.id);
      await admin
        .from("jobs")
        .update({
          status: output.cancelled ? "cancelled" : "completed",
          output: output as Json,
          cost: output.cost,
          completed_at: new Date().toISOString(),
          error: output.cancelled ? STOPPED_MESSAGE : null,
        })
        .eq("id", job.id);
      return output;
    }

    throw new Error(`Unsupported job type: ${job.job_type}`);
  } catch (caught) {
    if (caught instanceof SearchCancelledError) {
      await looseSupabase(admin)
        .from("jobs")
        .update({
          status: "cancelled",
          error: caught.message,
          locked_by: null,
          locked_at: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (job.entity_id) {
        await admin
          .from("searches")
          .update({ status: "cancelled", error: caught.message })
          .eq("id", job.entity_id)
          .in("status", ["queued", "running"]);
      }
      return { cancelled: true };
    }

    const message = caught instanceof Error ? caught.message : "Job failed.";
    const shouldRetry = job.attempts < job.max_attempts;
    await looseSupabase(admin)
      .from("jobs")
      .update({
        status: shouldRetry ? "pending" : "failed",
        error: message,
        run_after: shouldRetry
          ? new Date(Date.now() + Math.min(job.attempts, 5) * 60_000).toISOString()
          : undefined,
        locked_by: null,
        locked_at: null,
        completed_at: shouldRetry ? null : new Date().toISOString(),
      })
      .eq("id", job.id);

    if (!shouldRetry && job.job_type === "run_search" && job.entity_id) {
      await admin
        .from("searches")
        .update({ status: "failed", error: message })
        .eq("id", job.entity_id);
    }
    throw caught;
  }
}

export async function runSearch(
  admin: Admin,
  workspaceId: string,
  searchId: string,
  jobId?: string,
) {
  const { data: search, error } = await admin.from("searches").select("*").eq("id", searchId).single();
  if (error || !search) throw new Error("Search not found.");

  const abort = new AbortController();
  const stopWatch = setInterval(() => {
    void isSearchCancelled(admin, searchId, jobId).then((stopped) => {
      if (stopped && !abort.signal.aborted) abort.abort();
    });
  }, 1500);

  await assertNotCancelled(admin, searchId, jobId);
  await admin.from("searches").update({ status: "running", error: null }).eq("id", searchId);

  const agentRunId = await startAgentRun(admin, workspaceId, jobId, "orchestrator", {
    search_id: searchId,
    provider: search.provider,
  });

  try {
    const input = (search.input ?? {}) as SearchInput;
    const provider = search.provider;
    const serpPromise = provider === "apify"
      ? fetchApifySerpCandidates({
          queries: input.queries ?? [],
          locations: input.locations ?? [],
          limit: input.limit ?? SEARCH_LIMIT,
          signal: abort.signal,
        }).catch((error) => {
          console.warn("SERP discovery failed:", error instanceof Error ? error.message : error);
          return [];
        })
      : Promise.resolve([]);
    const candidates = await withAgentStep(
      admin,
      workspaceId,
      agentRunId,
      "discovery",
      provider,
      { input },
      () => loadCandidates(provider, input, abort.signal),
    );
    await assertNotCancelled(admin, searchId, jobId, abort.signal);

    const limited = dedupeCandidates(candidates).slice(0, input.limit ?? SEARCH_LIMIT);
    const saved: Array<{ candidate: Candidate; companyId: string }> = [];

    async function persistCandidates(batch: Candidate[], actor: string) {
      if (batch.length === 0) return;
      await withAgentStep(
        admin,
        workspaceId,
        agentRunId,
        "normalization",
        actor,
        { count: batch.length },
        async () => {
          for (const candidate of batch) {
            await assertNotCancelled(admin, searchId, jobId, abort.signal);
            try {
              const companyId = await upsertCompany(admin, workspaceId, candidate, provider);
              await recordCompanyProvenance(admin, workspaceId, companyId, candidate, provider);
              await admin.from("search_results").upsert(
                {
                  workspace_id: workspaceId,
                  search_id: searchId,
                  company_id: companyId,
                  raw: (candidate.source_metadata ?? {}) as Json,
                },
                { onConflict: "search_id,company_id" },
              );
              await saveCandidateContacts(admin, workspaceId, companyId, candidate);
              if (!saved.some((row) => row.companyId === companyId)) {
                saved.push({ candidate, companyId });
              } else {
                const existing = saved.find((row) => row.companyId === companyId);
                if (existing) existing.candidate = mergeSavedCandidate(existing.candidate, candidate);
              }
              await admin
                .from("searches")
                .update({
                  result_count: saved.length,
                  cost: saved.length * CREDIT_COSTS.company_discovery,
                })
                .eq("id", searchId);
            } catch (saveError) {
              console.warn(
                "Could not save company",
                candidate.name,
                saveError instanceof Error ? saveError.message : saveError,
              );
            }
          }
          return { count: saved.length, names: saved.map((row) => row.candidate.name) };
        },
      );
    }

    function alreadyHave(candidate: Candidate) {
      const domain = normalizeDomain(candidate.domain ?? candidate.website);
      return saved.some((row) => {
        const existing = normalizeDomain(row.candidate.domain ?? row.candidate.website);
        if (domain && existing && domain === existing) return true;
        return row.candidate.name.toLowerCase() === candidate.name.toLowerCase()
          && (row.candidate.city ?? "").toLowerCase() === (candidate.city ?? "").toLowerCase();
      });
    }

    await persistCandidates(limited, "save_companies");

    const serpCandidates = await serpPromise;
    await assertNotCancelled(admin, searchId, jobId, abort.signal);
    await persistCandidates(
      dedupeCandidates(serpCandidates)
        .filter((candidate) => !alreadyHave(candidate))
        .slice(0, input.limit ?? SEARCH_LIMIT),
      "save_serp_companies",
    );

    const contactEnrichment = provider === "apify"
      ? enrichApifyContacts(saved.map((row) => row.candidate), abort.signal)
          .then(async (enriched) => {
            for (const row of saved) {
              const match = enriched.find((candidate) => candidate.name === row.candidate.name)
                ?? enriched.find((candidate) => candidate.domain && candidate.domain === row.candidate.domain);
              if (!match) continue;
              row.candidate = mergeSavedCandidate(row.candidate, match);
              await saveCandidateContacts(admin, workspaceId, row.companyId, row.candidate);
            }
            return enriched.length;
          })
          .catch((enrichError) => {
            if (!abort.signal.aborted) {
              console.warn("Contact enrichment failed:", enrichError instanceof Error ? enrichError.message : enrichError);
            }
            return 0;
          })
      : Promise.resolve(0);

    let icpCriteria: IcpInterpretation | null = null;
    if (search.icp_id) {
      const { data: icp } = await admin.from("icps").select("criteria").eq("id", search.icp_id).single();
      icpCriteria = (icp?.criteria ?? null) as IcpInterpretation | null;
    }

    let totalCost = saved.length * CREDIT_COSTS.company_discovery;
    let opportunities = 0;
    const analyses = new Map<string, Awaited<ReturnType<typeof analyzeWebsite>>>();

    await mapPool(saved, SCORE_CONCURRENCY, async ({ candidate, companyId }) => {
      await assertNotCancelled(admin, searchId, jobId, abort.signal);
      try {
        await recordUsage(admin, workspaceId, "company_discovery", CREDIT_COSTS.company_discovery, {
          company_id: companyId,
          search_id: searchId,
        }, `company_discovery:${searchId}:${companyId}`);
      } catch {
        // Metering should not stop scoring.
      }

      const website = candidate.website ?? websiteFromDomain(candidate.domain);
      if (!website) return;
      try {
        const analyzed = await withAgentStep(
          admin,
          workspaceId,
          agentRunId,
          "website_analysis",
          "analyze_website",
          { company_id: companyId, website, name: candidate.name },
          () => analyzeWebsite(website, null, abort.signal, { skipCrawlFallback: true }),
        );
        analyses.set(companyId, analyzed);
      } catch (analyzeError) {
        if (analyzeError instanceof SearchCancelledError) throw analyzeError;
      }
    });

    const thinRows = saved.filter((row) => {
      const website = row.candidate.website ?? websiteFromDomain(row.candidate.domain);
      return Boolean(website) && isThinWebsiteAnalysis(analyses.get(row.companyId) ?? null);
    });
    if (thinRows.length > 0) {
      await withAgentStep(
        admin,
        workspaceId,
        agentRunId,
        "website_analysis",
        "crawl_websites",
        { count: thinRows.length, names: thinRows.map((row) => row.candidate.name) },
        async () => {
          const urls = [
            ...thinRows.flatMap((row) => {
              const website = row.candidate.website ?? websiteFromDomain(row.candidate.domain);
              return website ? [website] : [];
            }),
            ...thinRows.flatMap((row) => {
              const website = row.candidate.website ?? websiteFromDomain(row.candidate.domain);
              return website ? relatedPageUrls(website).slice(1) : [];
            }),
          ];
          const crawled = await crawlWebsitePages(urls, abort.signal);
          for (const row of thinRows) {
            await assertNotCancelled(admin, searchId, jobId, abort.signal);
            const website = row.candidate.website ?? websiteFromDomain(row.candidate.domain);
            if (!website) continue;
            const site = crawledSiteFor(crawled, website) ?? [...crawled.values()].find((item) => {
              const domain = normalizeDomain(website);
              return Boolean(domain && item.domain === domain);
            });
            if (!site?.text) continue;
            try {
              analyses.set(row.companyId, await analyzeWebsite(website, site, abort.signal, { skipCrawlFallback: true }));
            } catch (analyzeError) {
              if (analyzeError instanceof SearchCancelledError) throw analyzeError;
            }
          }
          return { crawled: crawled.size, recovered: thinRows.filter((row) => !isThinWebsiteAnalysis(analyses.get(row.companyId) ?? null)).length };
        },
      );
    }

    await mapPool(saved, SCORE_CONCURRENCY, async ({ candidate, companyId }) => {
      await assertNotCancelled(admin, searchId, jobId, abort.signal);
      const website = candidate.website ?? websiteFromDomain(candidate.domain);
      const analyzed = analyses.get(companyId);
      let audit: { summary: unknown; scores: Record<string, number>; excerpt: string } | null = null;

      if (analyzed && website) {
        try {
          const { data: websiteAudit } = await admin
            .from("website_audits")
            .insert({
              workspace_id: workspaceId,
              company_id: companyId,
              ...analyzed.scores,
              summary: analyzed.summary as Json,
              details: { excerpt: analyzed.htmlExcerpt.slice(0, 4000), source_url: website } as Json,
            })
            .select("id")
            .single();

          await saveWebsiteArtifacts(admin, workspaceId, companyId, websiteAudit?.id ?? null, website, analyzed);
          audit = {
            summary: analyzed.summary,
            scores: analyzed.scores,
            excerpt: analyzed.htmlExcerpt,
          };
          if (analyzed.emails.length > 0) {
            candidate.email ||= analyzed.emails[0];
            const metadata = candidate.source_metadata ?? {};
            const existingEmails = Array.isArray(metadata.emails) ? metadata.emails.filter((value): value is string => typeof value === "string") : [];
            candidate.source_metadata = {
              ...metadata,
              emails: [...new Set([...existingEmails, ...analyzed.emails])],
            };
            await saveCandidateContacts(admin, workspaceId, companyId, candidate);
          }
          totalCost += CREDIT_COSTS.website_analysis;
          await recordUsage(admin, workspaceId, "website_analysis", CREDIT_COSTS.website_analysis, {
            company_id: companyId,
            search_id: searchId,
            website,
          }, `website_analysis:${searchId}:${companyId}`);
        } catch (analyzeError) {
          if (analyzeError instanceof SearchCancelledError) throw analyzeError;
          audit = {
            summary: analyzed.summary,
            scores: analyzed.scores,
            excerpt: analyzed.htmlExcerpt,
          };
        }
      }

      if (icpCriteria) {
        await admin.from("companies").update({ status: "RESEARCHING" }).eq("id", companyId);

        try {
          const result = await withAgentStep(
            admin,
            workspaceId,
            agentRunId,
            "qualification",
            "qualify_company",
            { company_id: companyId, name: candidate.name },
            () => qualifyCompany({
              icp: icpCriteria,
              company: candidate,
              audit: audit?.summary ?? null,
              excerpt: audit?.excerpt ?? "",
            }),
          );
          const report = result.data;
          const websiteOpportunity = audit?.scores.website_score
            ? 100 - audit.scores.website_score
            : report.opportunity_score;
          const scoreInputs = {
            fit: report.fit_score,
            intent: report.intent_score,
            business: websiteOpportunity,
            contactability: report.contactability_score,
            confidence: report.confidence_score,
          };
          const scored = opportunityScore(scoreInputs);
          const opportunityId = await upsertOpportunity(admin, {
            workspaceId,
            companyId,
            searchId,
            icpId: search.icp_id,
            report,
            scored,
            scoreInputs,
          });

          if (opportunityId) {
            opportunities += 1;
            await insertEvidence(admin, workspaceId, companyId, opportunityId, report);
            await recordScore(admin, workspaceId, companyId, opportunityId, scored, scoreInputs);
            await saveResearchReport(admin, workspaceId, companyId, opportunityId, {
              report,
              provider: result.provider,
              model: result.model,
              usage: result.usage,
              durationMs: result.durationMs,
            });
          }

          await admin
            .from("companies")
            .update({ status: scored >= 60 ? "QUALIFIED" : "NEW" })
            .eq("id", companyId);

          totalCost += CREDIT_COSTS.qualification;
          await recordUsage(admin, workspaceId, "qualification", CREDIT_COSTS.qualification, {
            company_id: companyId,
            search_id: searchId,
            model: result.model,
            provider: result.provider,
            cost_usd: result.usage.costUsd,
          }, `qualification:${searchId}:${companyId}`);
        } catch (qualifyError) {
          if (qualifyError instanceof SearchCancelledError) throw qualifyError;
          await admin.from("companies").update({ status: "NEW" }).eq("id", companyId);
        }
      }

      await admin
        .from("searches")
        .update({
          result_count: saved.length,
          opportunity_count: opportunities,
          cost: totalCost,
        })
        .eq("id", searchId);
    });

    await contactEnrichment;

    const output = {
      companies: saved.length,
      opportunities,
      cost: totalCost,
      cancelled: false as boolean,
    };

    if (abort.signal.aborted || await isSearchCancelled(admin, searchId, jobId)) {
      throw new SearchCancelledError();
    }

    await admin
      .from("searches")
      .update({
        status: "completed",
        result_count: saved.length,
        opportunity_count: opportunities,
        cost: totalCost,
        error: null,
      })
      .eq("id", searchId);

    await finishAgentRun(admin, agentRunId, "completed", output);
    return output;
  } catch (caught) {
    if (caught instanceof SearchCancelledError || abort.signal.aborted) {
      const message = caught instanceof SearchCancelledError ? caught.message : STOPPED_MESSAGE;
      await admin
        .from("searches")
        .update({ status: "cancelled", error: message })
        .eq("id", searchId)
        .in("status", ["queued", "running"]);
      await finishAgentRun(admin, agentRunId, "cancelled", { stopped: true }, message);
      throw caught instanceof SearchCancelledError ? caught : new SearchCancelledError(message);
    }
    await finishAgentRun(admin, agentRunId, "failed", null, caught);
    throw caught;
  } finally {
    clearInterval(stopWatch);
    if (!abort.signal.aborted) abort.abort();
  }
}

async function loadCandidates(provider: SearchProvider, input: SearchInput, signal?: AbortSignal): Promise<Candidate[]> {
  if (provider === "csv" && input.csv) return parseCsv(input.csv);
  if ((provider === "website" || provider === "manual") && input.urls) return parseUrlList(input.urls);
  if (provider === "apify") {
    return fetchApifyCandidates({
      queries: input.queries ?? [],
      locations: input.locations ?? [],
      limit: input.limit ?? SEARCH_LIMIT,
      enrichContacts: false,
      includeReviews: false,
      includeSerp: false,
      signal,
    });
  }
  if (input.csv) return parseCsv(input.csv);
  if (input.urls) return parseUrlList(input.urls);
  return [];
}

async function isSearchCancelled(admin: Admin, searchId: string, jobId?: string) {
  const { data: search } = await admin.from("searches").select("status").eq("id", searchId).maybeSingle();
  if (search?.status === "cancelled") return true;
  if (!jobId) return false;
  const { data: job } = await admin.from("jobs").select("status").eq("id", jobId).maybeSingle();
  return job?.status === "cancelled";
}

async function assertNotCancelled(admin: Admin, searchId: string, jobId?: string, signal?: AbortSignal) {
  if (signal?.aborted || await isSearchCancelled(admin, searchId, jobId)) {
    throw new SearchCancelledError();
  }
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const current = next;
      next += 1;
      const item = items[current];
      if (item) await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
}

function dedupeCandidates(candidates: Candidate[]) {
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  for (const candidate of candidates) {
    const domain = normalizeDomain(candidate.domain ?? candidate.website);
    const key = domain || `${candidate.name.toLowerCase()}|${(candidate.city ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function mergeSavedCandidate(target: Candidate, incoming: Candidate): Candidate {
  return {
    ...target,
    website: target.website || incoming.website,
    domain: target.domain || incoming.domain,
    email: target.email || incoming.email,
    phone: target.phone || incoming.phone,
    country: target.country || incoming.country,
    city: target.city || incoming.city,
    industry: target.industry || incoming.industry,
    description: target.description || incoming.description,
    source_metadata: { ...(incoming.source_metadata ?? {}), ...(target.source_metadata ?? {}) },
  };
}

function candidateEmails(candidate: Candidate) {
  const metadata = candidate.source_metadata ?? {};
  const extra = Array.isArray(metadata.emails)
    ? metadata.emails.filter((value): value is string => typeof value === "string")
    : [];
  return [...new Set([candidate.email, ...extra].map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value)))];
}

async function upsertCompany(
  admin: Admin,
  workspaceId: string,
  candidate: Candidate,
  provider: string,
) {
  const domain = normalizeDomain(candidate.domain ?? candidate.website);
  const patch = {
    website: candidate.website ?? websiteFromDomain(domain),
    country: candidate.country,
    city: candidate.city,
    industry: candidate.industry,
    description: candidate.description,
    employee_count: candidate.employee_count,
    source_metadata: (candidate.source_metadata ?? {}) as Json,
  };

  if (domain) {
    const { data: existing } = await admin
      .from("companies")
      .select("id, website, country, city, industry, description")
      .eq("workspace_id", workspaceId)
      .eq("normalized_domain", domain)
      .maybeSingle();
    if (existing) {
      await admin
        .from("companies")
        .update({
          website: existing.website || patch.website,
          country: existing.country || patch.country,
          city: existing.city || patch.city,
          industry: existing.industry || patch.industry,
          description: existing.description || patch.description,
          source_metadata: patch.source_metadata,
        })
        .eq("id", existing.id);
      return existing.id;
    }
  } else {
    const { data: existing } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", candidate.name)
      .is("normalized_domain", null)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data, error } = await admin
    .from("companies")
    .insert({
      workspace_id: workspaceId,
      name: candidate.name,
      domain,
      normalized_domain: domain,
      website: patch.website,
      country: candidate.country,
      city: candidate.city,
      industry: candidate.industry,
      description: candidate.description,
      employee_count: candidate.employee_count,
      source: provider,
      source_metadata: patch.source_metadata,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not save company.");
  return data.id;
}

async function saveCandidateContacts(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  candidate: Candidate,
) {
  const emails = candidateEmails(candidate);
  if (emails.length === 0 && !candidate.contact_name && !candidate.phone) return;
  if (emails.length === 0) {
    await maybeSaveContact(admin, workspaceId, companyId, candidate);
    return;
  }
  for (const email of emails) {
    await maybeSaveContact(admin, workspaceId, companyId, { ...candidate, email });
  }
}

async function upsertOpportunity(
  admin: Admin,
  input: {
    workspaceId: string;
    companyId: string;
    searchId: string;
    icpId: string | null;
    report: QualificationReport;
    scored: number;
    scoreInputs: Record<string, number>;
  },
) {
  const payload = {
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    search_id: input.searchId,
    icp_id: input.icpId,
    fit_score: clamp(input.report.fit_score),
    intent_score: clamp(input.report.intent_score),
    opportunity_score: input.scored,
    contactability_score: clamp(input.report.contactability_score),
    confidence_score: clamp(input.report.confidence_score),
    why: input.report.why as Json,
    recommended_service: input.report.recommended_service,
    recommended_angle: input.report.recommended_angle,
    recommended_contact: input.report.recommended_contact,
    report: input.report as Json,
    status: (input.scored >= 60 ? "QUALIFIED" : "NEW") as "QUALIFIED" | "NEW",
  };

  const { data: existing } = await admin
    .from("opportunities")
    .select("id")
    .eq("search_id", input.searchId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (existing) {
    await admin.from("opportunities").update(payload).eq("id", existing.id);
    return existing.id;
  }

  const { data } = await admin.from("opportunities").insert(payload).select("id").single();
  return data?.id ?? null;
}

async function maybeSaveContact(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  candidate: Candidate,
) {
  if (!candidate.email && !candidate.contact_name && !candidate.phone) return;

  const normalizedEmail = normalizeEmail(candidate.email);
  if (!normalizedEmail && candidate.phone) {
    const { data: existingPhone } = await admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .eq("phone", candidate.phone)
      .maybeSingle();
    if (existingPhone) return;
  }

  const payload = {
    workspace_id: workspaceId,
    company_id: companyId,
    name: candidate.contact_name,
    title: candidate.contact_title,
    email: candidate.email,
    normalized_email: normalizedEmail,
    phone: candidate.phone,
    source: candidate.source,
    confidence: candidate.email ? "medium" : "low",
  };

  const query = normalizedEmail
    ? looseSupabase(admin).from<{ id: string }>("contacts").upsert(payload, { onConflict: "workspace_id,normalized_email" })
    : looseSupabase(admin).from<{ id: string }>("contacts").insert(payload);
  const { data: contact } = await query.select("id").maybeSingle();

  if (contact?.id) {
    await recordContactSource(admin, workspaceId, contact.id, candidate);
  }
}

async function recordCompanyProvenance(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  candidate: Candidate,
  provider: string,
) {
  const domain = normalizeDomain(candidate.domain ?? candidate.website);
  if (domain) {
    await looseSupabase(admin).from("domains").upsert({
      workspace_id: workspaceId,
      domain,
      normalized_domain: domain,
      company_id: companyId,
      last_seen_at: new Date().toISOString(),
      metadata: candidate.source_metadata ?? {},
    }, { onConflict: "workspace_id,normalized_domain" });
  }

  const providerRecordId = sourceRecordId(candidate.source_metadata);
  if (!providerRecordId) return;

  await looseSupabase(admin).from("company_sources").upsert({
    workspace_id: workspaceId,
    company_id: companyId,
    provider,
    provider_record_id: providerRecordId,
    source_url: candidate.website ?? null,
    raw: candidate.source_metadata ?? {},
    confidence: domain ? "high" : "medium",
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,provider,provider_record_id" });
}

async function recordContactSource(
  admin: Admin,
  workspaceId: string,
  contactId: string,
  candidate: Candidate,
) {
  const providerRecordId = sourceRecordId(candidate.source_metadata) ?? candidate.email;
  if (!providerRecordId) return;

  await looseSupabase(admin).from("contact_sources").upsert({
    workspace_id: workspaceId,
    contact_id: contactId,
    provider: candidate.source,
    provider_record_id: providerRecordId,
    source_url: candidate.website ?? null,
    raw: candidate.source_metadata ?? {},
    confidence: candidate.email ? "medium" : "low",
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,provider,provider_record_id" });
}

async function saveWebsiteArtifacts(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  websiteAuditId: string | null,
  website: string,
  analyzed: { summary: unknown; scores: Record<string, number>; htmlExcerpt: string },
) {
  await looseSupabase(admin).from("seo_audits").insert({
    workspace_id: workspaceId,
    website_audit_id: websiteAuditId,
    company_id: companyId,
    score: analyzed.scores.seo_score,
    checks: analyzed.summary,
  });

  await looseSupabase(admin).from("technology_profiles").insert({
    workspace_id: workspaceId,
    company_id: companyId,
    technologies: Array.isArray((analyzed.summary as { technologies?: unknown }).technologies)
      ? (analyzed.summary as { technologies: unknown[] }).technologies
      : [],
    source: website,
    confidence: "medium",
  });

  const objectPath = `${workspaceId}/companies/${companyId}/website-audits/${websiteAuditId ?? crypto.randomUUID()}.json`;
  const artifact = JSON.stringify({
    website,
    summary: analyzed.summary,
    scores: analyzed.scores,
    excerpt: analyzed.htmlExcerpt,
    captured_at: new Date().toISOString(),
  });
  const { error } = await admin.storage
    .from("crawl-artifacts")
    .upload(objectPath, artifact, {
      contentType: "application/json",
      upsert: true,
    });

  if (!error) {
    await looseSupabase(admin).from("storage_artifacts").upsert({
      workspace_id: workspaceId,
      bucket: "crawl-artifacts",
      object_path: objectPath,
      artifact_type: "website_audit_json",
      entity_type: "company",
      entity_id: companyId,
      content_type: "application/json",
      byte_size: Buffer.byteLength(artifact),
      metadata: { website, website_audit_id: websiteAuditId },
    }, { onConflict: "bucket,object_path" });
  }
}

async function insertEvidence(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  opportunityId: string,
  report: QualificationReport,
) {
  if (report.evidence.length === 0) return;
  await admin.from("evidence_records").insert(
    report.evidence.slice(0, 12).map((item) => ({
      workspace_id: workspaceId,
      company_id: companyId,
      opportunity_id: opportunityId,
      claim: item.claim,
      evidence: item.evidence,
      source_url: item.source,
      source_type: item.source.startsWith("http") ? "verified_url" : "ai_research",
      confidence: item.confidence,
    })),
  );
}

async function recordUsage(
  admin: Admin,
  workspaceId: string,
  eventType: string,
  credits: number,
  metadata: Record<string, unknown>,
  idempotencyKey: string,
) {
  if (credits <= 0) return;
  const { error } = await looseSupabase(admin).rpc("consume_workspace_credits", {
    _workspace_id: workspaceId,
    _credits: credits,
    _event_type: eventType,
    _idempotency_key: idempotencyKey,
    _user_id: null,
    _unit_cost: 0,
    _total_cost: Number(metadata.cost_usd ?? 0),
    _metadata: metadata as Json,
  });

  if (error) {
    console.warn("Could not meter usage:", error.message);
  }
}

async function startAgentRun(
  admin: Admin,
  workspaceId: string,
  jobId: string | undefined,
  agentType: string,
  input: Record<string, unknown>,
) {
  const { data } = await looseSupabase(admin)
    .from<{ id: string }>("agent_runs")
    .insert({
      workspace_id: workspaceId,
      job_id: jobId ?? null,
      agent_type: agentType,
      input,
      status: "running",
    })
    .select("id")
    .single();
  if (!data?.id) {
    throw new Error("Could not start agent run.");
  }
  return String(data.id);
}

async function finishAgentRun(
  admin: Admin,
  agentRunId: string,
  status: "completed" | "failed" | "cancelled",
  output: Record<string, unknown> | null,
  error?: unknown,
) {
  await looseSupabase(admin)
    .from("agent_runs")
    .update({
      status,
      output,
      error: typeof error === "string" ? error : error instanceof Error ? error.message : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", agentRunId);
}

async function withAgentStep<T>(
  admin: Admin,
  workspaceId: string,
  agentRunId: string,
  stepType: string,
  toolName: string,
  input: Record<string, unknown>,
  action: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const { data: step } = await looseSupabase(admin)
    .from<{ id: string }>("agent_steps")
    .insert({
      workspace_id: workspaceId,
      agent_run_id: agentRunId,
      step_type: stepType,
      tool_name: toolName,
      input: summarizeStepPayload(input) as Json,
      status: "running",
    })
    .select("id")
    .single();

  try {
    const output = await action();
    if (step?.id) {
      try {
        await looseSupabase(admin)
          .from("agent_steps")
          .update({
            output: summarizeStepPayload(output) as Json,
            duration_ms: Date.now() - started,
            status: "completed",
          })
          .eq("id", step.id);
      } catch (error) {
        console.warn(
          "Could not persist agent step output:",
          error instanceof Error ? error.message : error,
        );
        await looseSupabase(admin)
          .from("agent_steps")
          .update({
            duration_ms: Date.now() - started,
            status: "completed",
            output: { persisted: false } as Json,
          })
          .eq("id", step.id);
      }
    }
    return output;
  } catch (caught) {
    const stopped = caught instanceof SearchCancelledError
      || (caught instanceof Error && /stopped/i.test(caught.message));
    if (step?.id) {
      await looseSupabase(admin)
        .from("agent_steps")
        .update({
          duration_ms: Date.now() - started,
          status: stopped ? "cancelled" : "failed",
          error: stopped ? STOPPED_MESSAGE : caught instanceof Error ? caught.message : "Step failed.",
        })
        .eq("id", step.id);
    }
    if (stopped && !(caught instanceof SearchCancelledError)) throw new SearchCancelledError();
    throw caught;
  }
}

async function recordScore(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  opportunityId: string,
  score: number,
  weights: Record<string, number>,
) {
  await looseSupabase(admin).from("scores").insert({
    workspace_id: workspaceId,
    company_id: companyId,
    opportunity_id: opportunityId,
    score_type: "opportunity",
    score: clamp(score),
    weights,
    version: SCORING_VERSION,
    explanation: weights,
  });
}

async function saveResearchReport(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  opportunityId: string,
  input: {
    report: QualificationReport;
    provider: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number };
    durationMs: number;
  },
) {
  await looseSupabase(admin).from("research_reports").insert({
    workspace_id: workspaceId,
    company_id: companyId,
    opportunity_id: opportunityId,
    structured_output: input.report as Json,
    provider: input.provider,
    model: input.model,
    prompt_version: "qualify-company-v1",
    token_usage: input.usage as unknown as Json,
    cost: input.usage.costUsd,
    duration_ms: input.durationMs,
  });
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function sourceRecordId(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null;
  for (const key of ["id", "placeId", "place_id", "cid", "url", "website", "domain"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
