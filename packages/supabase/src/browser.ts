import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
