import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prospectdyno/supabase/types";

type DbError = { message: string };
type DbResponse<T = unknown> = { data: T | null; error: DbError | null };

export interface LooseQuery<T = unknown> extends PromiseLike<DbResponse<T>> {
  select(columns?: string): LooseQuery<T>;
  insert(values: unknown, options?: unknown): LooseQuery<T>;
  update(values: unknown): LooseQuery<T>;
  upsert(values: unknown, options?: unknown): LooseQuery<T>;
  eq(column: string, value: unknown): LooseQuery<T>;
  in(column: string, values: unknown[]): LooseQuery<T>;
  order(column: string, options?: unknown): LooseQuery<T>;
  limit(count: number): LooseQuery<T>;
  single(): Promise<DbResponse<T>>;
  maybeSingle(): Promise<DbResponse<T>>;
}

export type LooseSupabaseClient = Omit<SupabaseClient<Database>, "from" | "rpc"> & {
  from<T = unknown>(table: string): LooseQuery<T>;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<DbResponse<T>>;
};

export function looseSupabase(client: SupabaseClient<Database>): LooseSupabaseClient {
  return client as unknown as LooseSupabaseClient;
}
