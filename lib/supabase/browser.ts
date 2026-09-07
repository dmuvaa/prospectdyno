"use client";

import { createBrowserSupabaseClient as createClient } from "@prospectdyno/supabase/browser";
import { publicSupabaseKey, publicSupabaseUrl } from "@/lib/supabase/public-env";

export function createBrowserSupabaseClient() {
  return createClient({
    url: publicSupabaseUrl(),
    publishableKey: publicSupabaseKey(),
  });
}
