import type { SupabaseClient } from "@supabase/supabase-js";

export type Call = { method: string; args: unknown[] };
export type QueryLog = { table: string; calls: Call[] };
export type RpcLog = { name: string; args: Record<string, unknown> };
type Result = { data: unknown; error: unknown; count?: number | null };

/**
 * Records every query-builder call per `from()` and every `rpc()` call.
 * Each table or rpc name answers with the next queued result (or an empty success).
 */
export function fakeClient(results: {
  tables?: Record<string, Result[]>;
  rpcs?: Record<string, Result[]>;
} = {}) {
  const queries: QueryLog[] = [];
  const rpcs: RpcLog[] = [];
  const next = (queue: Result[] | undefined): Result =>
    queue?.shift() ?? { data: null, error: null };

  const client = {
    from(table: string) {
      const log: QueryLog = { table, calls: [] };
      queries.push(log);
      const result = next(results.tables?.[table]);
      const builder: Record<string, unknown> = {};
      for (const method of [
        "select", "eq", "neq", "in", "is", "order", "limit", "range", "returns", "filter", "match",
      ]) {
        builder[method] = (...args: unknown[]) => {
          log.calls.push({ method, args });
          return builder;
        };
      }
      for (const method of ["single", "maybeSingle"]) {
        builder[method] = async (...args: unknown[]) => {
          log.calls.push({ method, args });
          return result;
        };
      }
      builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown> = {}) {
      rpcs.push({ name, args });
      return next(results.rpcs?.[name]);
    },
  };

  return { client: client as unknown as SupabaseClient, queries, rpcs };
}

export function callsOf(log: QueryLog | undefined, method: string): unknown[][] {
  return (log?.calls ?? []).filter((call) => call.method === method).map((call) => call.args);
}

export const postgrestError = {
  code: "42501",
  message: "permission denied for table thought_cards",
  details: "secret detail",
  hint: null,
};
