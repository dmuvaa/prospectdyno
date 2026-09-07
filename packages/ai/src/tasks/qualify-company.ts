import { z } from "zod";
import type { QualificationReport } from "@prospectdyno/shared";
import { completeJson } from "../complete";

const confidence = z.enum(["high", "medium", "low"]);

const schema = z.object({
  fit_score: z.number(),
  intent_score: z.number(),
  opportunity_score: z.number(),
  contactability_score: z.number(),
  confidence_score: z.number(),
  company_fit: z.string(),
  pain_points: z.array(z.string()),
  buying_signals: z.array(z.string()),
  recommended_service: z.string(),
  recommended_angle: z.string(),
  recommended_contact: z.string(),
  why: z.array(z.string()),
  custom_criteria: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      reasoning: z.string(),
      evidence: z.string(),
      confidence,
    }),
  ),
  evidence: z.array(
    z.object({
      claim: z.string(),
      evidence: z.string(),
      source: z.string(),
      confidence,
    }),
  ),
});

export async function qualifyCompany(input: {
  icp: unknown;
  company: unknown;
  audit: unknown;
  excerpt: string;
}) {
  return completeJson<QualificationReport>({
    task: "qualify_company",
    schemaName: "qualification_report",
    parser: schema,
    temperature: 0.1,
    system: `You qualify a company against an ICP for ProspectDyno.
Rules:
- Scores are integers 0-100.
- Distinguish verified facts from inferences. Put uncertain claims at low confidence.
- Every important claim needs evidence and a source (page type or URL if known).
- If the website excerpt is thin, lower confidence rather than inventing services.
- recommended_contact is a title, not a fabricated person.`,
    user: JSON.stringify(input).slice(0, 12000),
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "fit_score",
        "intent_score",
        "opportunity_score",
        "contactability_score",
        "confidence_score",
        "company_fit",
        "pain_points",
        "buying_signals",
        "recommended_service",
        "recommended_angle",
        "recommended_contact",
        "why",
        "custom_criteria",
        "evidence",
      ],
      properties: {
        fit_score: { type: "integer" },
        intent_score: { type: "integer" },
        opportunity_score: { type: "integer" },
        contactability_score: { type: "integer" },
        confidence_score: { type: "integer" },
        company_fit: { type: "string" },
        pain_points: { type: "array", items: { type: "string" } },
        buying_signals: { type: "array", items: { type: "string" } },
        recommended_service: { type: "string" },
        recommended_angle: { type: "string" },
        recommended_contact: { type: "string" },
        why: { type: "array", items: { type: "string" } },
        custom_criteria: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "score", "reasoning", "evidence", "confidence"],
            properties: {
              name: { type: "string" },
              score: { type: "integer" },
              reasoning: { type: "string" },
              evidence: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
        evidence: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claim", "evidence", "source", "confidence"],
            properties: {
              claim: { type: "string" },
              evidence: { type: "string" },
              source: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
      },
    },
  });
}
