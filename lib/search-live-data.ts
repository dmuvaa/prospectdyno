import { emailsFromCompanySources } from "@/lib/contact-emails";
import type { SearchActivityStep } from "@/lib/search-activity";
import { looseSupabase } from "@/lib/supabase-loose";
import type { Database } from "@prospectdyno/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchCompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  status: string;
  score: number | null;
  angle: string | null;
  opportunityId: string | null;
  email?: string | null;
  emails?: string[];
  phone?: string | null;
};

export type SearchLiveSnapshot = {
  status: string;
  error: string | null;
  running: boolean;
  resultCount: number;
  opportunityCount: number;
  steps: SearchActivityStep[];
  companies: SearchCompanyRow[];
};

export async function loadSearchLiveSnapshot(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  searchId: string,
): Promise<SearchLiveSnapshot | null> {
  const db = looseSupabase(supabase);
  const { data: search } = await supabase
    .from("searches")
    .select("id, status, error, result_count, opportunity_count")
    .eq("id", searchId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!search) return null;

  const [{ data: results }, { data: opportunities }, { data: jobs }] = await Promise.all([
    supabase.from("search_results").select("company_id").eq("search_id", searchId),
    supabase
      .from("opportunities")
      .select("id, company_id, opportunity_score, recommended_angle, status")
      .eq("workspace_id", workspaceId)
      .eq("search_id", searchId),
    supabase
      .from("jobs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("entity_id", searchId)
      .order("created_at", { ascending: false }),
  ]);

  const companyIds = [...new Set((results ?? []).map((row) => row.company_id))];
  const [{ data: companies }, { data: contacts }] = await Promise.all([
    companyIds.length
      ? supabase
          .from("companies")
          .select("id, name, domain, city, country, industry, status, created_at, source_metadata")
          .in("id", companyIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{
          id: string;
          name: string;
          domain: string | null;
          city: string | null;
          country: string | null;
          industry: string | null;
          status: string;
          created_at: string;
          source_metadata: unknown;
        }> }),
    companyIds.length
      ? supabase
          .from("contacts")
          .select("company_id, email, phone")
          .eq("workspace_id", workspaceId)
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] as Array<{ company_id: string; email: string | null; phone: string | null }> }),
  ]);

  const jobIds = (jobs ?? []).map((job) => job.id);
  const { data: runs } = jobIds.length
    ? await db
        .from<Array<{ id: string }>>("agent_runs")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("job_id", jobIds)
    : { data: [] };

  const runIds = (runs ?? []).map((run) => run.id);
  const { data: rawSteps } = runIds.length
    ? await db
        .from<SearchActivityStep[]>("agent_steps")
        .select("id, step_type, tool_name, status, error, created_at, input, output")
        .eq("workspace_id", workspaceId)
        .in("agent_run_id", runIds)
        .order("created_at", { ascending: false })
        .limit(80)
    : { data: [] };

  const contactsByCompany = new Map<string, Array<{ email?: string | null; phone?: string | null }>>();
  for (const contact of contacts ?? []) {
    const current = contactsByCompany.get(contact.company_id) ?? [];
    current.push(contact);
    contactsByCompany.set(contact.company_id, current);
  }

  const opportunityByCompany = new Map((opportunities ?? []).map((row) => [row.company_id, row]));
  const companyRows = (companies ?? []).map((company) => {
    const opportunity = opportunityByCompany.get(company.id);
    const companyContacts = contactsByCompany.get(company.id) ?? [];
    const emails = emailsFromCompanySources(companyContacts, company.source_metadata);
    const phone = companyContacts.find((contact) => contact.phone)?.phone ?? null;
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      city: company.city,
      country: company.country,
      industry: company.industry,
      status: opportunity?.status ?? company.status,
      score: opportunity?.opportunity_score ?? null,
      angle: opportunity?.recommended_angle ?? null,
      opportunityId: opportunity?.id ?? null,
      email: emails[0] ?? null,
      emails,
      phone,
    };
  });

  const steps = (rawSteps ?? []).map((step) => ({
    ...step,
    input: (step.input ?? null) as SearchActivityStep["input"],
    output: (step.output ?? null) as SearchActivityStep["output"],
  }));

  return {
    status: search.status,
    error: search.error,
    running: search.status === "queued" || search.status === "running",
    resultCount: search.result_count,
    opportunityCount: search.opportunity_count,
    steps,
    companies: companyRows,
  };
}
