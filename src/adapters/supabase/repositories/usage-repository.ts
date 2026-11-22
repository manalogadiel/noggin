import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuotaResult,
  UsageKind,
  UsageRepository,
} from "@/core/application/ports";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

interface ConsumeQuotaRow {
  allowed: boolean;
  used: number;
  cap: number;
}

export function createUsageRepository(options: {
  service: SupabaseClient;
  userId: string;
}): UsageRepository {
  const { service, userId } = options;

  return {
    async consumeQuota(
      ownerId: string,
      kind: UsageKind,
      amount: number,
    ): Promise<QuotaResult> {
      if (ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot consume quota for another user.",
        );
      }

      const { data, error } = await service.rpc("consume_usage_quota", {
        p_user_id: ownerId,
        p_kind: kind,
        p_amount: amount,
      });

      if (error) {
        throw mapPostgrestError(error, "usage.consumeQuota");
      }

      const row = (Array.isArray(data) ? data[0] : data) as
        | ConsumeQuotaRow
        | undefined;
      if (!row) {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Empty response from consume_usage_quota.",
        );
      }

      return {
        allowed: Boolean(row.allowed),
        used: Number(row.used),
        cap: Number(row.cap),
      };
    },
  };
}
