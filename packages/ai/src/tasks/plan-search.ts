import { z } from "zod";
import type { SearchPlan } from "@prospectdyno/shared";
import { completeJson } from "../complete";

const schema = z.object({
  name: z.string(),
  summary: z.string(),
  queries: z.array(z.string()),
  locations: z.array(z.string()),
  notes: z.string(),
});

export async function planSearch(prompt: string, interpretation: unknown) {
  return completeJson<SearchPlan>({
    task: "plan_search",
    schemaName: "search_plan",
    parser: schema,
    system:
      "You turn an approved ICP into a practical discovery plan. Produce 4-8 search queries a human would type, and specific locations only when geography is part of the ICP. Do not invent countries.",
    user: JSON.stringify({ prompt, interpretation }),
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "summary", "queries", "locations", "notes"],
      properties: {
        name: { type: "string" },
        summary: { type: "string" },
        queries: { type: "array", items: { type: "string" } },
        locations: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
    },
  });
}
