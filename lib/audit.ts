import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@prospectdyno/supabase/types";

export async function recordAudit(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    userId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_logs").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: (input.metadata ?? {}) as Json,
  });
}
