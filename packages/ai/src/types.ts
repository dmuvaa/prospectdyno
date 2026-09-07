export type AiTask =
  | "interpret_icp"
  | "plan_search"
  | "classify_company"
  | "extract"
  | "qualify_company"
  | "research"
  | "personalize";

export type AiQuality = "low" | "medium" | "high";

export type AiProviderName = "openai" | "openrouter";

export type ModelRoute = {
  provider: AiProviderName;
  model: string;
};

export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type AiCompletionResult<T> = {
  data: T;
  provider: AiProviderName;
  model: string;
  usage: AiUsage;
  durationMs: number;
};

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}
