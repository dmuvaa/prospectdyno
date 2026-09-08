import {
  emptyInterpretation,
  type IcpInterpretation,
} from "@prospectdyno/shared";
import { z } from "zod";
import { completeJson } from "../complete";
import { AiError, type AiCompletionResult } from "../types";

const stringList = z.array(z.string());

export const icpInterpretationSchema = z.object({
  name: z.string(),
  summary: z.string(),
  company: z.object({
    industries: stringList,
    countries: stringList,
    regions: stringList,
    cities: stringList,
    employee_min: z.number().int().nullable(),
    employee_max: z.number().int().nullable(),
    company_types: stringList,
    founding_year_min: z.number().int().nullable(),
    founding_year_max: z.number().int().nullable(),
  }),
  technology: z.object({
    cms: stringList,
    ecommerce: stringList,
    analytics: stringList,
    marketing: stringList,
    infrastructure: stringList,
    frameworks: stringList,
  }),
  business: z.object({
    services: stringList,
    customer_types: stringList,
    business_models: stringList,
    markets: stringList,
    geographic_presence: stringList,
  }),
  signals: stringList,
  custom_criteria: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    }),
  ),
  confidence: z.enum(["high", "medium", "low"]),
});

const interpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "summary",
    "company",
    "technology",
    "business",
    "signals",
    "custom_criteria",
    "confidence",
  ],
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    company: {
      type: "object",
      additionalProperties: false,
      required: [
        "industries",
        "countries",
        "regions",
        "cities",
        "employee_min",
        "employee_max",
        "company_types",
        "founding_year_min",
        "founding_year_max",
      ],
      properties: {
        industries: { type: "array", items: { type: "string" } },
        countries: { type: "array", items: { type: "string" } },
        regions: { type: "array", items: { type: "string" } },
        cities: { type: "array", items: { type: "string" } },
        employee_min: { type: ["integer", "null"] },
        employee_max: { type: ["integer", "null"] },
        company_types: { type: "array", items: { type: "string" } },
        founding_year_min: { type: ["integer", "null"] },
        founding_year_max: { type: ["integer", "null"] },
      },
    },
    technology: {
      type: "object",
      additionalProperties: false,
      required: ["cms", "ecommerce", "analytics", "marketing", "infrastructure", "frameworks"],
      properties: {
        cms: { type: "array", items: { type: "string" } },
        ecommerce: { type: "array", items: { type: "string" } },
        analytics: { type: "array", items: { type: "string" } },
        marketing: { type: "array", items: { type: "string" } },
        infrastructure: { type: "array", items: { type: "string" } },
        frameworks: { type: "array", items: { type: "string" } },
      },
    },
    business: {
      type: "object",
      additionalProperties: false,
      required: ["services", "customer_types", "business_models", "markets", "geographic_presence"],
      properties: {
        services: { type: "array", items: { type: "string" } },
        customer_types: { type: "array", items: { type: "string" } },
        business_models: { type: "array", items: { type: "string" } },
        markets: { type: "array", items: { type: "string" } },
        geographic_presence: { type: "array", items: { type: "string" } },
      },
    },
    signals: { type: "array", items: { type: "string" } },
    custom_criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
} as const;

const SYSTEM_PROMPT = `You convert a natural-language ideal customer description into structured ICP criteria for ProspectDyno, a B2B prospect intelligence platform.

Rules:
- Extract only what the user asked for. Do not invent industries, countries, or technologies that were not implied.
- Use empty arrays and nulls when a field is unknown.
- Put qualitative or judgment-based requirements into custom_criteria. Examples: "appears to manage Google Business Profiles for clients", "likely needs local SEO", "has an enterprise sales motion".
- name should be a short saved-search title, 3-7 words.
- summary should be one or two sentences restating the ICP in plain language.
- confidence is high when geography, industry, and size are explicit; medium when some fields are inferred; low when the prompt is vague.
- Prefer ISO-style country names (United States, United Kingdom) over abbreviations unless the user used a well-known code that maps clearly.
- Signals are observable business events: hiring, expansion, new website, technology adoption, product launch, content activity.`;

const FROM_WEBSITE_SYSTEM_PROMPT = `You infer a B2B ideal customer profile from a company's own website for ProspectDyno.

The website belongs to the seller, not the prospect. Describe the companies they should hunt as customers, not a profile of the seller.

Rules:
- Industries, countries, cities, services, and customer types are about TARGET companies they sell to.
- Use the site's services, markets, case studies, and positioning as evidence.
- Put qualitative buying signals into custom_criteria.
- If the user added notes, those notes override inferences from the site.
- name should be a short saved-search title, 3-7 words.
- summary should be one or two sentences: who they should find, and why.
- Use empty arrays and nulls when unknown. Do not invent a geography the site does not support.
- Prefer ISO-style country names.
- Signals are observable events on target companies: hiring, expansion, outdated website, new locations, technology adoption.`;

export async function interpretIcp(
  prompt: string,
  site?: {
    url: string;
    title: string | null;
    description: string | null;
    technologies: string[];
    emails: string[];
    excerpt: string;
    wordCount: number;
  } | null,
): Promise<AiCompletionResult<IcpInterpretation>> {
  const trimmed = prompt.trim();
  if (!site && trimmed.length < 8) {
    throw new AiError("Describe the customer in a bit more detail.");
  }

  const result = await completeJson({
    task: "interpret_icp",
    schemaName: "icp_interpretation",
    schema: interpretationJsonSchema as unknown as Record<string, unknown>,
    parser: icpInterpretationSchema,
    system: site ? FROM_WEBSITE_SYSTEM_PROMPT : SYSTEM_PROMPT,
    user: site
      ? JSON.stringify({
          website: site.url,
          title: site.title,
          description: site.description,
          technologies: site.technologies,
          emails: site.emails,
          word_count: site.wordCount,
          excerpt: site.excerpt.slice(0, 6500),
          notes: trimmed || null,
        })
      : trimmed,
  });

  return {
    ...result,
    data: {
      ...emptyInterpretation(),
      ...result.data,
    },
  };
}
