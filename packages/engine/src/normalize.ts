export function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const withProtocol = value.includes("://") ? value : `https://${value}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    return hostname || null;
  } catch {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      ?.replace(/[^\w.-]/g, "");
    return cleaned || null;
  }
}

export function websiteFromDomain(domain: string | null | undefined): string | null {
  const normalized = normalizeDomain(domain);
  return normalized ? `https://${normalized}` : null;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function opportunityScore(input: {
  fit: number;
  intent: number;
  business: number;
  contactability: number;
  confidence: number;
}): number {
  return clampScore(
    input.fit * 0.35 +
      input.intent * 0.2 +
      input.business * 0.2 +
      input.contactability * 0.15 +
      input.confidence * 0.1,
  );
}
