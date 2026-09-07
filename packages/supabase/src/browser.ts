import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

export function createBrowserSupabaseClient(config?: {
  url?: string;
  publishableKey?: string;
}) {
  return createBrowserClient<Database>(
    config?.url ?? supabaseUrl(),
    config?.publishableKey ?? supabasePublishableKey(),
  );
}
