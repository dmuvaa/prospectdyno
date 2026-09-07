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
      "You turn an approved ICP into a practical discovery plan. Name the hunt in 3-7 words a human would recognize, like 'Kenya real estate companies' or 'Nairobi dental clinics' — industry plus location when geography matters, Title Case or sentence case, no quotes, no 'Hunt' or 'ICP'. Produce 4-8 search queries a human would type, and specific locations only when geography is part of the ICP. Do not invent countries.",
    user: JSON.stringify({ prompt, interpretation }),
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "summary", "queries", "locations", "notes"],
      properties: {
        name: {
          type: "string",
          description: "Short hunt title, 3-7 words, industry plus location when relevant.",
        },
        summary: { type: "string" },
        queries: { type: "array", items: { type: "string" } },
        locations: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
    },
  });
}
