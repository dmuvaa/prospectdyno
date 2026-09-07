export const SEARCH_PROVIDERS = ["apify", "csv", "website", "manual"] as const;
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number];

export const SEARCH_STATUSES = [
  "draft",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const CREDIT_COSTS = {
  company_discovery: 1,
  website_analysis: 1,
  qualification: 1,
  personalization: 1,
  export: 1,
  interpret_icp: 1,
  plan_search: 1,
} as const;

export const CREDIT_COST_COPY: Record<keyof typeof CREDIT_COSTS, string> = {
  company_discovery: "Saving a found company",
  website_analysis: "Reading a company website",
  qualification: "Scoring a company against your brief",
  personalization: "Drafting a message",
  export: "Exporting a CSV",
  interpret_icp: "Turning a prompt into a brief",
  plan_search: "Planning the hunt queries",
};

export function creditsForHunt(companyCount = 25) {
  return (
    CREDIT_COSTS.interpret_icp +
    CREDIT_COSTS.plan_search +
    companyCount * (CREDIT_COSTS.company_discovery + CREDIT_COSTS.website_analysis + CREDIT_COSTS.qualification)
  );
}

export type Candidate = {
  name: string;
  website?: string | null;
  domain?: string | null;
  country?: string | null;
  city?: string | null;
  industry?: string | null;
  description?: string | null;
  employee_count?: number | null;
  contact_name?: string | null;
  contact_title?: string | null;
  email?: string | null;
  phone?: string | null;
  source: SearchProvider | "manual";
  source_metadata?: Record<string, unknown>;
};

export type SearchPlan = {
  name: string;
  summary: string;
  queries: string[];
  locations: string[];
  notes: string;
};

export type WebsiteAuditSummary = {
  title: string | null;
  description: string | null;
  h1: string[];
  canonical: string | null;
  robots: string | null;
  generator: string | null;
  technologies: string[];
  has_form: boolean;
  has_tel: boolean;
  has_mailto: boolean;
  has_viewport: boolean;
  word_count: number;
};

export type WebsiteScores = {
  website_score: number;
  seo_score: number;
  performance_score: number;
  ux_score: number;
  conversion_score: number;
  technical_score: number;
};

export type QualificationReport = {
  fit_score: number;
  intent_score: number;
  opportunity_score: number;
  contactability_score: number;
  confidence_score: number;
  company_fit: string;
  pain_points: string[];
  buying_signals: string[];
  recommended_service: string;
  recommended_angle: string;
  recommended_contact: string;
  why: string[];
  custom_criteria: Array<{
    name: string;
    score: number;
    reasoning: string;
    evidence: string;
    confidence: "high" | "medium" | "low";
  }>;
  evidence: Array<{
    claim: string;
    evidence: string;
    source: string;
    confidence: "high" | "medium" | "low";
  }>;
};

export type PersonalizedMessage = {
  opening_line: string;
  angle: string;
  cta: string;
  body: string;
  claims_used: Array<{ claim: string; source: string }>;
};
