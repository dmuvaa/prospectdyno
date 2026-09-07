import { emailsFromUnknown } from "@prospectdyno/engine";

export function emailsFromCompanySources(
  contacts: Array<{ email?: string | null }> | null | undefined,
  metadata?: unknown,
) {
  return emailsFromUnknown([
    ...(contacts ?? []).map((contact) => contact.email),
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).emails
      : null,
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).email
      : null,
  ]);
}
