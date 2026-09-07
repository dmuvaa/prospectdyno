import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseSecretKey, supabaseUrl } from "./env";

export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** @deprecated Use createAdminClient. */
export const createServiceRoleClient = createAdminClient;
