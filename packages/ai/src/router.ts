import type { AiProviderName, AiQuality, AiTask, ModelRoute } from "./types";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

const TASK_QUALITY: Record<AiTask, AiQuality> = {
  interpret_icp: "high",
  plan_search: "medium",
  classify_company: "low",
  extract: "low",
  qualify_company: "medium",
  research: "high",
  personalize: "high",
};

const REASONING_BY_QUALITY: Record<AiQuality, "none" | "low" | "medium"> = {
  high: "low",
  medium: "low",
  low: "none",
};

export function resolvedOpenAiModel() {
  const override = process.env.OPENAI_MODEL?.trim();
  return override || DEFAULT_OPENAI_MODEL;
}

export function routeTask(task: AiTask): ModelRoute {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const provider: AiProviderName = "openai";
  return { provider, model: resolvedOpenAiModel() };
}

export function reasoningEffortForTask(task: AiTask) {
  return REASONING_BY_QUALITY[TASK_QUALITY[task]];
}

export function usesGpt5Sampling(model: string) {
  return /^gpt-5/i.test(model);
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates: Record<string, { input: number; output: number }> = {
    "gpt-5.6-luna": { input: 0.2 / 1_000_000, output: 1.2 / 1_000_000 },
  };

  const rate = rates[model] ?? rates["gpt-5.6-luna"]!;
  const cost = promptTokens * rate.input + completionTokens * rate.output;
  return Number(cost.toFixed(6));
}
