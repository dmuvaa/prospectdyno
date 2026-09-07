import { qualifyCompany } from "@prospectdyno/ai";
import {
  analyzeWebsite,
  fetchApifyCandidates,
  normalizeDomain,
  opportunityScore,
  parseCsv,
  parseUrlList,
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

type Admin = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["jobs"]["Row"] & {
  max_attempts: number;
};

const SEARCH_LIMIT = 25;
const SCORING_VERSION = "opportunity-v1";

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
  const { data, error } = await looseSupabase(admin).rpc<JobRow>("claim_next_job", {
    _worker_id: workerId,
    _job_types: jobTypes ?? null,
  });

  if (error) throw new Error(error.message);
  return data as JobRow | null;
}

async function claimJob(admin: Admin, jobId: string, workerId: string): Promise<JobRow | null> {
  const { data, error } = await looseSupabase(admin).rpc<JobRow>("claim_job", {
    _job_id: jobId,
    _worker_id: workerId,
  });

  if (error) throw new Error(error.message);
  return data as JobRow | null;
}

export async function processJob(
  jobId: string,
  options: { alreadyClaimed?: boolean; workerId?: string } = {},
) {
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

async function getJob(admin: Admin, jobId: string): Promise<JobRow> {
  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).single();
  if (error || !job) throw new Error(error?.message ?? "Job not found.");
  return { ...job, max_attempts: "max_attempts" in job ? Number(job.max_attempts) : 3 } as JobRow;
}

async function processClaimedJob(admin: Admin, job: JobRow) {
  try {
    if (job.job_type === "run_search" && job.entity_id) {
      const output = await runSearch(admin, job.workspace_id, job.entity_id, job.id);
      await admin
        .from("jobs")
        .update({
          status: "completed",
          output: output as Json,
          cost: output.cost,
          completed_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", job.id);
      return output;
    }

    throw new Error(`Unsupported job type: ${job.job_type}`);
  } catch (caught) {
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

  await admin.from("searches").update({ status: "running", error: null }).eq("id", searchId);

  const agentRunId = await startAgentRun(admin, workspaceId, jobId, "orchestrator", {
    search_id: searchId,
    provider: search.provider,
  });

  try {
    const input = (search.input ?? {}) as SearchInput;
    const candidates = await withAgentStep(
      admin,
      workspaceId,
      agentRunId,
      "discovery",
      search.provider,
      { input },
      () => loadCandidates(search.provider, input),
    );
    const limited = candidates.slice(0, input.limit ?? SEARCH_LIMIT);

    let icpCriteria: IcpInterpretation | null = null;
    if (search.icp_id) {
      const { data: icp } = await admin.from("icps").select("criteria").eq("id", search.icp_id).single();
      icpCriteria = (icp?.criteria ?? null) as IcpInterpretation | null;
    }

    let totalCost = 0;
    let opportunities = 0;

    for (const [index, candidate] of limited.entries()) {
      const companyId = await withAgentStep(
        admin,
        workspaceId,
        agentRunId,
        "normalization",
        "upsert_company",
        { candidate, index },
        () => upsertCompany(admin, workspaceId, candidate, search.provider),
      );

      await recordCompanyProvenance(admin, workspaceId, companyId, candidate, search.provider);
      await admin.from("search_results").upsert(
        {
          workspace_id: workspaceId,
          search_id: searchId,
          company_id: companyId,
          raw: (candidate.source_metadata ?? {}) as Json,
        },
        { onConflict: "search_id,company_id" },
      );

      await maybeSaveContact(admin, workspaceId, companyId, candidate);

      await admin
        .from("searches")
        .update({
          result_count: index + 1,
          opportunity_count: opportunities,
          cost: totalCost,
        })
        .eq("id", searchId);

      totalCost += CREDIT_COSTS.company_discovery;
      await recordUsage(admin, workspaceId, "company_discovery", CREDIT_COSTS.company_discovery, {
        company_id: companyId,
        search_id: searchId,
      }, `company_discovery:${searchId}:${companyId}`);

      const website = candidate.website ?? websiteFromDomain(candidate.domain);
      let audit: { summary: unknown; scores: Record<string, number>; excerpt: string } | null = null;

      if (website) {
        try {
          const analyzed = await withAgentStep(
            admin,
            workspaceId,
            agentRunId,
            "website_analysis",
            "analyze_website",
            { company_id: companyId, website },
            () => analyzeWebsite(website),
          );
          const { data: websiteAudit } = await admin
            .from("website_audits")
            .insert({
              workspace_id: workspaceId,
              company_id: companyId,
              ...analyzed.scores,
              summary: analyzed.summary as Json,
              details: { excerpt: analyzed.htmlExcerpt, source_url: website } as Json,
            })
            .select("id")
            .single();

          await saveWebsiteArtifacts(admin, workspaceId, companyId, websiteAudit?.id ?? null, website, analyzed);
          audit = {
            summary: analyzed.summary,
            scores: analyzed.scores,
            excerpt: analyzed.htmlExcerpt,
          };
          totalCost += CREDIT_COSTS.website_analysis;
          await recordUsage(admin, workspaceId, "website_analysis", CREDIT_COSTS.website_analysis, {
            company_id: companyId,
            search_id: searchId,
            website,
          }, `website_analysis:${searchId}:${companyId}`);
        } catch {
          audit = null;
        }
      }

      if (!icpCriteria) continue;

      await admin.from("companies").update({ status: "RESEARCHING" }).eq("id", companyId);

      try {
        const result = await withAgentStep(
          admin,
          workspaceId,
          agentRunId,
          "qualification",
          "qualify_company",
          { company_id: companyId },
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

        const { data: opportunity } = await admin
          .from("opportunities")
          .insert({
            workspace_id: workspaceId,
            company_id: companyId,
            search_id: searchId,
            icp_id: search.icp_id,
            fit_score: clamp(report.fit_score),
            intent_score: clamp(report.intent_score),
            opportunity_score: scored,
            contactability_score: clamp(report.contactability_score),
            confidence_score: clamp(report.confidence_score),
            why: report.why as Json,
            recommended_service: report.recommended_service,
            recommended_angle: report.recommended_angle,
            recommended_contact: report.recommended_contact,
            report: report as Json,
            status: scored >= 60 ? "QUALIFIED" : "NEW",
          })
          .select("id")
          .single();

        if (opportunity) {
          opportunities += 1;
          await insertEvidence(admin, workspaceId, companyId, opportunity.id, report);
          await recordScore(admin, workspaceId, companyId, opportunity.id, scored, scoreInputs);
          await saveResearchReport(admin, workspaceId, companyId, opportunity.id, {
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
      } catch {
        await admin.from("companies").update({ status: "NEW" }).eq("id", companyId);
      }

      await admin
        .from("searches")
        .update({
          result_count: index + 1,
          opportunity_count: opportunities,
          cost: totalCost,
        })
        .eq("id", searchId);
    }

    const output = {
      companies: limited.length,
      opportunities,
      cost: totalCost,
    };

    await admin
      .from("searches")
      .update({
        status: "completed",
        result_count: limited.length,
        opportunity_count: opportunities,
        cost: totalCost,
      })
      .eq("id", searchId);

    await finishAgentRun(admin, agentRunId, "completed", output);
    return output;
  } catch (caught) {
    await finishAgentRun(admin, agentRunId, "failed", null, caught);
    throw caught;
  }
}

async function loadCandidates(provider: SearchProvider, input: SearchInput): Promise<Candidate[]> {
  if (provider === "csv" && input.csv) return parseCsv(input.csv);
  if ((provider === "website" || provider === "manual") && input.urls) return parseUrlList(input.urls);
  if (provider === "apify") {
    return fetchApifyCandidates({
      queries: input.queries ?? [],
      locations: input.locations ?? [],
      limit: input.limit ?? SEARCH_LIMIT,
    });
  }
  if (input.csv) return parseCsv(input.csv);
  if (input.urls) return parseUrlList(input.urls);
  return [];
}

async function upsertCompany(
  admin: Admin,
  workspaceId: string,
  candidate: Candidate,
  provider: string,
) {
  const domain = normalizeDomain(candidate.domain ?? candidate.website);
  if (domain) {
    const { data: existing } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("normalized_domain", domain)
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
      website: candidate.website ?? websiteFromDomain(domain),
      country: candidate.country,
      city: candidate.city,
      industry: candidate.industry,
      description: candidate.description,
      employee_count: candidate.employee_count,
      source: provider,
      source_metadata: (candidate.source_metadata ?? {}) as Json,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not save company.");
  return data.id;
}

async function maybeSaveContact(
  admin: Admin,
  workspaceId: string,
  companyId: string,
  candidate: Candidate,
) {
  if (!candidate.email && !candidate.contact_name) return;

  const normalizedEmail = normalizeEmail(candidate.email);
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

  if (error) throw new Error(error.message);
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
  status: "completed" | "failed",
  output: Record<string, unknown> | null,
  error?: unknown,
) {
  await looseSupabase(admin)
    .from("agent_runs")
    .update({
      status,
      output,
      error: error instanceof Error ? error.message : null,
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
      input: summarizeStepOutput(input) as Json,
      status: "running",
    })
    .select("id")
    .single();

  try {
    const output = await action();
    if (step?.id) {
      await looseSupabase(admin)
        .from("agent_steps")
        .update({
          output: summarizeStepOutput(output) as Json,
          duration_ms: Date.now() - started,
          status: "completed",
        })
        .eq("id", step.id);
    }
    return output;
  } catch (caught) {
    if (step?.id) {
      await looseSupabase(admin)
        .from("agent_steps")
        .update({
          duration_ms: Date.now() - started,
          status: "failed",
          error: caught instanceof Error ? caught.message : "Step failed.",
        })
        .eq("id", step.id);
    }
    throw caught;
  }
}

function summarizeStepOutput(output: unknown) {
  if (Array.isArray(output)) return { count: output.length };
  if (typeof output === "object" && output !== null) {
    const serialized = JSON.stringify(output);
    return JSON.parse(serialized.slice(0, 4000)) as Json;
  }
  return { value: output };
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
