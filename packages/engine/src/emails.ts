const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JUNK_LOCAL = /^(noreply|no-reply|donotreply|privacy|legal|webmaster|mailer-daemon)$/i;
const JUNK_DOMAIN = /(?:sentry\.io|wixpress\.com|example\.com|domain\.com|email\.com|cloudflare\.com|schema\.org)$/i;

export function emailsFromUnknown(value: unknown): string[] {
  return uniqueEmails(collectEmails(value));
}

function collectEmails(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    return (value.match(EMAIL_RE) ?? [])
      .map((email) => email.replace(/^mailto:/i, "").split("?")[0]?.trim().toLowerCase() ?? "")
      .filter(isPlausibleEmail);
  }
  if (Array.isArray(value)) return value.flatMap(collectEmails);
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    return [
      ...collectEmails(row.email),
      ...collectEmails(row.emailAddress),
      ...collectEmails(row.emails),
      ...collectEmails(row.value),
    ];
  }
  return [];
}

function isPlausibleEmail(email: string) {
  const [local, domain] = email.split("@");
  return Boolean(
    local &&
      domain &&
      !JUNK_LOCAL.test(local) &&
      !JUNK_DOMAIN.test(domain) &&
      !/\.(png|jpe?g|gif|webp|svg)$/i.test(email),
  );
}

function uniqueEmails(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
