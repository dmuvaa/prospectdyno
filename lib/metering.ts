import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@prospectdyno/supabase/types";

type AnyClient = SupabaseClient<Database> & {
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

export function idempotencyKey(scope: string, input: unknown) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
  return `${scope}:${hash}`;
}

export async function consumeCredits(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    userId?: string | null;
    eventType: string;
    credits: number;
    idempotencyKey: string;
    unitCost?: number;
    totalCost?: number;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await (supabase as unknown as AnyClient).rpc("consume_workspace_credits", {
    _workspace_id: input.workspaceId,
    _credits: input.credits,
    _event_type: input.eventType,
    _idempotency_key: input.idempotencyKey,
    _user_id: input.userId ?? null,
    _unit_cost: input.unitCost ?? 0,
    _total_cost: input.totalCost ?? 0,
    _metadata: (input.metadata ?? {}) as Json,
  });

  if (error) {
    throw new Error(error.message);
  }
}
