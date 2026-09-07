const MAX_JSON_CHARS = 3500;
const MAX_STRING_CHARS = 240;
const OMITTED = new Set([
  "source_metadata",
  "htmlExcerpt",
  "excerpt",
  "html",
  "raw",
  "text",
  "markdown",
  "content",
]);

export function summarizeStepPayload(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { count: value.length };
  if (value === null || typeof value !== "object") return { value: clipString(value) };

  const compact = prune(value, 0);
  const asRecord =
    compact && typeof compact === "object" && !Array.isArray(compact)
      ? (compact as Record<string, unknown>)
      : { value: compact };

  const serialized = JSON.stringify(asRecord);
  if (serialized.length <= MAX_JSON_CHARS) return asRecord;

  return { summary: "truncated", keys: Object.keys(asRecord).slice(0, 24) };
}

function prune(value: unknown, depth: number): unknown {
  if (typeof value === "string") return clipString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) {
    if (depth > 1) return { count: value.length };
    return value.slice(0, 8).map((item) => prune(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (OMITTED.has(key)) {
        if (typeof nested === "string") result[key] = clipString(nested, 120);
        else if (Array.isArray(nested)) result[key] = { count: nested.length };
        else if (nested && typeof nested === "object") result[key] = { omitted: true };
        continue;
      }
      result[key] = prune(nested, depth + 1);
    }
    return result;
  }
  return String(value);
}

function clipString(value: unknown, max = MAX_STRING_CHARS) {
  if (typeof value !== "string") return value;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}
