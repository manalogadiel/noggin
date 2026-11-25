import {
  type BillingOrder,
  type BillingSummary,
  findSalesProduct,
  SALES_CATALOG,
  type SubscriptionRecord,
  totalCoinsForProduct,
} from "../../domain/billing";
import type {
  BillingRepository,
  CurrentUser,
  PaymentGateway,
} from "../ports";

export interface BillingDeps {
  currentUser: CurrentUser;
  billing: BillingRepository;
  paymentGateway: PaymentGateway;
}

export type GetBillingSummaryResult =
  | { status: "unauthenticated" }
  | { status: "ok"; summary: BillingSummary };

export async function getBillingSummary(
  deps: Pick<BillingDeps, "currentUser" | "billing">,
): Promise<GetBillingSummaryResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const [products, subscription, recentOrders] = await Promise.all([
    deps.billing.listProducts(),
    deps.billing.getActiveSubscription(user.id),
    deps.billing.listOrders(user.id, 15),
  ]);

  return {
    status: "ok",
    summary: {
      planCode: subscription?.status === "active" ? "plus" : "free",
      subscription,
      recentOrders,
      products: products.length > 0 ? products : [...SALES_CATALOG],
    },
  };
}

export interface CheckoutProductInput {
  productCode: string;
  idempotencyKey: string;
}

export type CheckoutProductResult =
  | { status: "unauthenticated" }
  | {
      status: "invalid";
      code: "unknown_product" | "wrong_product_kind" | "missing_idempotency_key";
      error: string;
    }
  | {
      status: "ok";
      order: BillingOrder;
      coinsAdded: number;
      planCode: "free" | "plus";
    };

async function runProductCheckout(
  deps: BillingDeps,
  input: CheckoutProductInput,
  expectedKind: "coin_pack" | "subscription",
): Promise<CheckoutProductResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const key = input.idempotencyKey.trim();
  if (!key) {
    return {
      status: "invalid",
      code: "missing_idempotency_key",
      error: "Idempotency key is required.",
    };
  }

  const product = findSalesProduct(input.productCode.trim());
  if (!product) {
    return {
      status: "invalid",
      code: "unknown_product",
      error: "Unknown or inactive product.",
    };
  }

  if (product.kind !== expectedKind) {
    return {
      status: "invalid",
      code: "wrong_product_kind",
      error: `Expected a ${expectedKind} product.`,
    };
  }

  const created = await deps.billing.createOrder({
    userId: user.id,
    productCode: product.code,
    idempotencyKey: key,
    provider: deps.paymentGateway.providerName,
  });

  if (created.status === "paid") {
    return {
      status: "ok",
      order: created,
      coinsAdded: created.coinsCredited,
      planCode: expectedKind === "subscription" ? "plus" : "free",
    };
  }

  const intent = await deps.paymentGateway.authorizePurchase({
    userId: user.id,
    product,
    idempotencyKey: key,
  });

  const fulfilled = await deps.billing.fulfillOrder({
    userId: user.id,
    orderId: created.id,
    providerRef: intent.providerRef,
  });

  return {
    status: "ok",
    order: fulfilled,
    coinsAdded:
      fulfilled.coinsCredited > 0
        ? fulfilled.coinsCredited
        : totalCoinsForProduct(product),
    planCode: expectedKind === "subscription" ? "plus" : "free",
  };
}

export async function checkoutCoinPack(
  deps: BillingDeps,
  input: CheckoutProductInput,
): Promise<CheckoutProductResult> {
  return runProductCheckout(deps, input, "coin_pack");
}

export async function subscribeNogginPlus(
  deps: BillingDeps,
  input: CheckoutProductInput,
): Promise<CheckoutProductResult> {
  return runProductCheckout(deps, input, "subscription");
}

export type CancelSubscriptionResult =
  | { status: "unauthenticated" }
  | { status: "not_found"; error: string }
  | { status: "ok"; subscription: SubscriptionRecord };

export async function cancelNogginPlus(
  deps: Pick<BillingDeps, "currentUser" | "billing">,
): Promise<CancelSubscriptionResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const updated = await deps.billing.cancelSubscription(user.id);
  if (!updated) {
    return {
      status: "not_found",
      error: "No active Noggin Plus subscription found.",
    };
  }

  return { status: "ok", subscription: updated };
}
