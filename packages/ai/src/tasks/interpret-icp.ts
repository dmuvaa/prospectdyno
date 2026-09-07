import {
  emptyInterpretation,
  type IcpInterpretation,
} from "@prospectdyno/shared";
import { z } from "zod";
import { createAiClient } from "../client";
import { estimateCostUsd, routeTask } from "../router";
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

export async function interpretIcp(
  prompt: string,
): Promise<AiCompletionResult<IcpInterpretation>> {
  const trimmed = prompt.trim();
  if (trimmed.length < 8) {
    throw new AiError("Describe the customer in a bit more detail.");
  }

  const route = routeTask("interpret_icp");
  const client = createAiClient();
  const started = Date.now();

  const completion = await client.chat.completions.create({
    model: route.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "icp_interpretation",
        strict: true,
        schema: interpretationJsonSchema as unknown as Record<string, unknown>,
      },
    },
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new AiError("The model returned an empty interpretation.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new AiError("The model returned invalid JSON.");
  }

  const parsed = icpInterpretationSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AiError("The model returned an invalid interpretation.");
  }

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;

  return {
    data: {
      ...emptyInterpretation(),
      ...parsed.data,
    },
    provider: route.provider,
    model: route.model,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: completion.usage?.total_tokens ?? promptTokens + completionTokens,
      costUsd: estimateCostUsd(route.model, promptTokens, completionTokens),
    },
    durationMs: Date.now() - started,
  };
}
