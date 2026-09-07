export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function supabaseUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
  }

  return value;
}

export function supabasePublishableKey(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!value) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return value;
}

export const supabaseAnonKey = supabasePublishableKey;

export function describeSupabaseKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return "empty";
  if (trimmed.includes("placeholder")) return "placeholder";
  if (trimmed.startsWith("sb_publishable_")) return "publishable";
  if (trimmed.startsWith("sb_secret_")) return "secret";
  if (trimmed.startsWith("eyJ")) {
    try {
      const payloadPart = trimmed.split(".")[1] ?? "";
      const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(padded);
      const payload = JSON.parse(json) as { role?: string };
      return payload.role ?? "jwt";
    } catch {
      return "malformed-jwt";
    }
  }
  return "unknown";
}

export function supabaseSecretKey(): string {
  const value =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY");
  }

  const kind = describeSupabaseKey(value);
  if (kind === "publishable" || kind === "anon" || kind === "placeholder") {
    throw new Error(
      `SUPABASE_SECRET_KEY is a ${kind} key. Use the secret key (sb_secret_…) from Supabase → API Keys, not the publishable key.`,
    );
  }

  return value;
}

/** @deprecated Use supabaseSecretKey. service_role is a legacy JWT name. */
export const supabaseServiceRoleKey = supabaseSecretKey;
