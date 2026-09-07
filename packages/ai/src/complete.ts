import { z } from "zod";
import { createAiClient } from "./client";
import { estimateCostUsd, routeTask } from "./router";
import { AiError, type AiCompletionResult, type AiTask } from "./types";

export async function completeJson<T>(input: {
  task: AiTask;
  schemaName: string;
  schema: Record<string, unknown>;
  parser: z.ZodType<T>;
  system: string;
  user: string;
  temperature?: number;
}): Promise<AiCompletionResult<T>> {
  const route = routeTask(input.task);
  const client = createAiClient();
  const started = Date.now();

  const completion = await client.chat.completions.create({
    model: route.model,
    temperature: input.temperature ?? 0.2,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: input.schemaName,
        strict: true,
        schema: input.schema as unknown as Record<string, unknown>,
      },
    },
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new AiError("The model returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new AiError("The model returned invalid JSON.");
  }

  const parsed = input.parser.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AiError("The model returned an invalid payload.");
  }

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;

  return {
    data: parsed.data,
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
