import { z } from "zod";
import type { PersonalizedMessage } from "@prospectdyno/shared";
import { completeJson } from "../complete";

const schema = z.object({
  opening_line: z.string(),
  angle: z.string(),
  cta: z.string(),
  body: z.string(),
  claims_used: z.array(
    z.object({
      claim: z.string(),
      source: z.string(),
    }),
  ),
});

export async function personalizeMessage(input: {
  company: unknown;
  report: unknown;
  evidence: unknown;
}) {
  return completeJson<PersonalizedMessage>({
    task: "personalize",
    schemaName: "personalized_message",
    parser: schema,
    system: `Write a short B2B outreach draft from stored evidence only.
Do not invent compliments, metrics, or services.
opening_line should mention a specific observed fact.
body is 80-140 words, no fake personalization.`,
    user: JSON.stringify(input).slice(0, 8000),
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["opening_line", "angle", "cta", "body", "claims_used"],
      properties: {
        opening_line: { type: "string" },
        angle: { type: "string" },
        cta: { type: "string" },
        body: { type: "string" },
        claims_used: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claim", "source"],
            properties: {
              claim: { type: "string" },
              source: { type: "string" },
            },
          },
        },
      },
    },
  });
}
