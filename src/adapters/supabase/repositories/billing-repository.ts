import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingOrder,
  BillingRepository,
  SalesProduct,
  SalesProductCode,
  SubscriptionRecord,
} from "@/core/application/ports";
import { findSalesProduct, SALES_CATALOG } from "@/core/domain/billing";
import {
  mapPostgrestError,
  normalizeTimestamp,
  SupabaseAdapterError,
} from "./errors";

interface SalesProductRow {
  code: string;
  kind: "coin_pack" | "subscription";
  name: string;
  price_centavos: number;
  currency: string;
  coins_grant: number;
  bonus_coins: number;
  billing_interval: "month" | "year" | null;
  active: boolean;
}

interface BillingOrderRow {
  id: string;
  user_id: string;
  product_code: string;
  idempotency_key: string;
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  amount_centavos: number;
  currency: string;
  provider: string;
  provider_ref: string | null;
  coins_credited: number;
  paid_at: string | null;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_code: "free" | "plus";
  product_code: string;
  status: "active" | "cancelled" | "expired" | "past_due";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider: string;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapProductRow(row: SalesProductRow): SalesProduct {
  const catalogMatch = findSalesProduct(row.code);
  return {
    code: row.code as SalesProductCode,
    uiId: catalogMatch?.uiId ?? row.code,
    kind: row.kind,
    name: row.name,
    priceCentavos: row.price_centavos,
    currency: "PHP",
    coinsGrant: row.coins_grant,
    bonusCoins: row.bonus_coins,
    billingInterval: row.billing_interval,
    active: row.active,
  };
}

function mapOrderRow(row: BillingOrderRow): BillingOrder {
  return {
    id: row.id,
    userId: row.user_id,
    productCode: row.product_code as SalesProductCode,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    amountCentavos: row.amount_centavos,
    currency: row.currency,
    provider: row.provider,
    providerRef: row.provider_ref,
    coinsCredited: row.coins_credited,
    paidAt: row.paid_at ? normalizeTimestamp(row.paid_at) : null,
    createdAt: normalizeTimestamp(row.created_at),
  };
}

function mapSubscriptionRow(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    planCode: row.plan_code,
    productCode: row.product_code as SalesProductCode,
    status: row.status,
    currentPeriodStart: normalizeTimestamp(row.current_period_start),
    currentPeriodEnd: normalizeTimestamp(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

export function createBillingRepository(options: {
  session: SupabaseClient;
  userId: string;
}): BillingRepository {
  const { session, userId } = options;

  function assertOwner(targetUserId: string, operation: string) {
    if (targetUserId !== userId) {
      throw new SupabaseAdapterError(
        "FORBIDDEN",
        `Permission denied during ${operation}.`,
      );
    }
  }

  return {
    async listProducts(): Promise<SalesProduct[]> {
      const { data, error } = await session
        .from("sales_products")
        .select(
          "code, kind, name, price_centavos, currency, coins_grant, bonus_coins, billing_interval, active",
        )
        .eq("active", true)
        .order("price_centavos", { ascending: true })
        .returns<SalesProductRow[]>();

      if (error) {
        throw mapPostgrestError(error, "billing.listProducts");
      }

      if (!data || data.length === 0) {
        return [...SALES_CATALOG];
      }
      return data.map(mapProductRow);
    },

    async getActiveSubscription(
      targetUserId: string,
    ): Promise<SubscriptionRecord | null> {
      assertOwner(targetUserId, "billing.getActiveSubscription");

      const { data, error } = await session
        .from("subscriptions")
        .select(
          "id, user_id, plan_code, product_code, status, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_id, created_at, updated_at",
        )
        .eq("user_id", targetUserId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRow>();

      if (error) {
        throw mapPostgrestError(error, "billing.getActiveSubscription");
      }

      return data ? mapSubscriptionRow(data) : null;
    },

    async listOrders(
      targetUserId: string,
      limit: number = 15,
    ): Promise<BillingOrder[]> {
      assertOwner(targetUserId, "billing.listOrders");

      const { data, error } = await session
        .from("billing_orders")
        .select(
          "id, user_id, product_code, idempotency_key, status, amount_centavos, currency, provider, provider_ref, coins_credited, paid_at, created_at",
        )
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<BillingOrderRow[]>();

      if (error) {
        throw mapPostgrestError(error, "billing.listOrders");
      }

      return (data ?? []).map(mapOrderRow);
    },

    async createOrder(input): Promise<BillingOrder> {
      assertOwner(input.userId, "billing.createOrder");

      const { data, error } = await session
        .rpc("create_billing_order", {
          p_product_code: input.productCode,
          p_idempotency_key: input.idempotencyKey,
          p_provider: input.provider,
        })
        .single<BillingOrderRow>();

      if (error) {
        throw mapPostgrestError(error, "billing.createOrder");
      }

      return mapOrderRow(data);
    },

    async fulfillOrder(input): Promise<BillingOrder> {
      assertOwner(input.userId, "billing.fulfillOrder");

      const { data, error } = await session
        .rpc("fulfill_billing_order", {
          p_order_id: input.orderId,
          p_provider_ref: input.providerRef,
        })
        .single<BillingOrderRow>();

      if (error) {
        throw mapPostgrestError(error, "billing.fulfillOrder");
      }

      return mapOrderRow(data);
    },

    async cancelSubscription(
      targetUserId: string,
    ): Promise<SubscriptionRecord | null> {
      assertOwner(targetUserId, "billing.cancelSubscription");

      const { data, error } = await session
        .rpc("cancel_user_subscription")
        .single<SubscriptionRow>();

      if (error) {
        if (error.message?.includes("No active subscription")) {
          return null;
        }
        throw mapPostgrestError(error, "billing.cancelSubscription");
      }

      return data ? mapSubscriptionRow(data) : null;
    },
  };
}
