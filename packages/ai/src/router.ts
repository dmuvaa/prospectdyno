import type { AiProviderName, AiQuality, AiTask, ModelRoute } from "./types";

const OPENAI_MODELS = {
  high: "gpt-4o",
  medium: "gpt-4o-mini",
  low: "gpt-4o-mini",
} as const;

const OPENROUTER_MODELS = {
  high: "openai/gpt-4o",
  medium: "openai/gpt-4o-mini",
  low: "openai/gpt-4o-mini",
} as const;

const TASK_QUALITY: Record<AiTask, AiQuality> = {
  interpret_icp: "high",
  plan_search: "medium",
  classify_company: "low",
  extract: "low",
  qualify_company: "medium",
  research: "high",
  personalize: "high",
};

function preferredProvider(): AiProviderName {
  const configured = process.env.AI_DEFAULT_PROVIDER;
  if (configured === "openrouter") return "openrouter";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "openai";
}

export function routeTask(task: AiTask): ModelRoute {
  const quality = TASK_QUALITY[task];
  const provider = preferredProvider();

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    return { provider, model: OPENROUTER_MODELS[quality] };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return { provider, model: OPENAI_MODELS[quality] };
}

export function estimateCostUsd(
  provider: AiProviderName,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
    "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
    "openai/gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
    "openai/gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  };

  const rate = rates[model] ?? rates["gpt-4o-mini"]!;
  const cost = promptTokens * rate.input + completionTokens * rate.output;
  return Number(cost.toFixed(6));
}
