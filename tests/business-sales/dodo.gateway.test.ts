import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDodoPaymentGateway,
  extractDodoFulfillmentRef,
  resolveDodoProductIdsFromEnv,
  verifyDodoWebhookSignature,
} from "@/adapters/billing/dodo-payment-gateway";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import {
  checkoutCoinPack,
  subscribeNogginPlus,
} from "@/core/application/use-cases/billing";
import { findSalesProduct } from "@/core/domain/billing";

const { createServiceSupabaseClient } = vi.hoisted(() => ({
  createServiceSupabaseClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/service-client", () => ({
  createServiceSupabaseClient,
}));

import { POST as dodoWebhookPost } from "@/app/api/billing/webhooks/dodo/route";

describe("Dodo Payments Checkout gateway and Standard Webhooks verification", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves Dodo product IDs from JSON map and individual env overrides", () => {
    const resolved = resolveDodoProductIdsFromEnv({
      DODO_PRODUCT_IDS: JSON.stringify({
        coins_100: "pdt_json_100",
        coins_300: "pdt_json_300",
      }),
      DODO_PRODUCT_COINS_300: "pdt_env_300",
      DODO_PRODUCT_PLUS_MONTHLY: "pdt_env_plus_m",
    });

    expect(resolved).toEqual({
      coins_100: "pdt_json_100",
      coins_300: "pdt_env_300",
      plus_monthly: "pdt_env_plus_m",
    });

    expect(
      resolveDodoProductIdsFromEnv({
        DODO_PRODUCT_IDS: "{not-json",
        DODO_PRODUCT_COINS_750: "pdt_750",
      }),
    ).toEqual({ coins_750: "pdt_750" });
  });

  it("creates a test-mode Dodo checkout session with Bearer auth, product_cart, return_url, and metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "cks_test_123",
          checkout_url: "https://test.checkout.dodopayments.com/session/cks_test_123",
          payment_id: null,
          client_secret: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const gateway = createDodoPaymentGateway({
      apiKey: "dodo_test_abc",
      appUrl: "https://playnoggin.vercel.app/",
      productIds: {
        coins_300: "pdt_coins_300",
      },
      fetchImpl: fetchMock,
    });

    const intent = await gateway.authorizePurchase({
      userId: "user-1",
      product: findSalesProduct("c300")!,
      idempotencyKey: "idem-dodo-1",
      orderId: "ord-dodo-1",
    });

    expect(intent).toEqual({
      provider: "dodo",
      providerRef: "cks_test_123",
      checkoutUrl: "https://test.checkout.dodopayments.com/session/cks_test_123",
      requiresRedirect: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.dodopayments.com/checkouts");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer dodo_test_abc");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      product_cart: [{ product_id: "pdt_coins_300", quantity: 1 }],
      return_url:
        "https://playnoggin.vercel.app/profile/shop?checkout=success&product=coins_300",
      metadata: {
        order_id: "ord-dodo-1",
        user_id: "user-1",
        product_code: "coins_300",
        idempotency_key: "idem-dodo-1",
      },
    });
  });

  it("targets live Dodo API when testMode=false and fails clearly when product mapping or API request fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "cks_live_456",
          checkout_url: "https://checkout.dodopayments.com/session/cks_live_456",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const liveGateway = createDodoPaymentGateway({
      apiKey: "dodo_live_xyz",
      appUrl: "https://playnoggin.vercel.app",
      testMode: false,
      productIds: {
        plus_monthly: "pdt_plus_monthly",
      },
      fetchImpl: fetchMock,
    });

    await liveGateway.authorizePurchase({
      userId: "user-2",
      product: findSalesProduct("plus_monthly")!,
      idempotencyKey: "idem-dodo-2",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://live.dodopayments.com/checkouts");

    await expect(
      liveGateway.authorizePurchase({
        userId: "user-2",
        product: findSalesProduct("c100")!,
        idempotencyKey: "idem-missing",
      }),
    ).rejects.toThrow("Dodo product ID not configured for coins_100");

    const failingFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const errGateway = createDodoPaymentGateway({
      apiKey: "bad_key",
      appUrl: "https://playnoggin.vercel.app",
      productIds: { coins_100: "pdt_100" },
      fetchImpl: failingFetch,
    });
    await expect(
      errGateway.authorizePurchase({
        userId: "user-2",
        product: findSalesProduct("c100")!,
        idempotencyKey: "idem-err",
      }),
    ).rejects.toThrow("Dodo checkout creation failed: Unauthorized API key");
  });

  it("verifies Standard Webhooks whsec_ base64 keys, literal secrets, multi-signatures, and tolerance", () => {
    const rawBody = JSON.stringify({
      type: "payment.succeeded",
      data: {
        payment_id: "pay_1",
        checkout_session_id: "cks_1",
        status: "succeeded",
      },
    });
    const webhookId = "msg_dodo123";
    const now = 1795610000;
    const timestamp = String(now - 20);

    const base64SecretBytes = Buffer.from("super-secret-dodo-key-32-bytes!!");
    const whsecSecret = `whsec_${base64SecretBytes.toString("base64")}`;
    const expectedB64 = createHmac("sha256", base64SecretBytes)
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      verifyDodoWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,badhash v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(true);

    const literalSecret = "dodo_whs_literal_secret";
    const expectedLiteralB64 = createHmac("sha256", Buffer.from(literalSecret, "utf8"))
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      verifyDodoWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${expectedLiteralB64}`,
        webhookSecret: literalSecret,
        nowSeconds: now,
      }),
    ).toBe(true);

    expect(
      verifyDodoWebhookSignature({
        rawBody: `${rawBody} `,
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(false);

    expect(
      verifyDodoWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp: String(now - 600),
        webhookSignature: `v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(false);

    expect(
      verifyDodoWebhookSignature({
        rawBody,
        webhookId: null,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it("extracts fulfillment references from payment.succeeded and subscription.active events only", () => {
    expect(
      extractDodoFulfillmentRef({
        type: "payment.succeeded",
        data: {
          payment_id: "pay_1",
          checkout_session_id: "cks_paid_1",
          status: "succeeded",
          metadata: { order_id: "11111111-1111-1111-1111-111111111111" },
        },
      }),
    ).toEqual({
      eventType: "payment.succeeded",
      checkoutSessionId: "cks_paid_1",
      orderId: "11111111-1111-1111-1111-111111111111",
    });

    expect(
      extractDodoFulfillmentRef({
        type: "subscription.active",
        data: {
          subscription_id: "sub_1",
          status: "active",
          metadata: { order_id: "22222222-2222-2222-2222-222222222222" },
        },
      }),
    ).toEqual({
      eventType: "subscription.active",
      checkoutSessionId: null,
      orderId: "22222222-2222-2222-2222-222222222222",
    });

    expect(
      extractDodoFulfillmentRef({
        type: "payment.failed",
        data: { checkout_session_id: "cks_fail_1", status: "failed" },
      }),
    ).toBeNull();

    expect(
      extractDodoFulfillmentRef({
        type: "payment.succeeded",
        data: { checkout_session_id: "cks_fail_2", status: "failed" },
      }),
    ).toBeNull();

    expect(
      extractDodoFulfillmentRef({
        type: "subscription.active",
        data: { subscription_id: "sub_2", status: "active" },
      }),
    ).toBeNull();
  });

  it("fulfills webhook orders via checkout_session_id and falls back to metadata order_id for subscription.active", async () => {
    const secretBytes = Buffer.from("dodo-route-test-secret-32-bytes!");
    const whsecSecret = `whsec_${secretBytes.toString("base64")}`;
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = whsecSecret;

    const nowTs = String(Math.floor(Date.now() / 1000));
    const signRequest = (body: Record<string, unknown>, id = "msg_route_1") => {
      const raw = JSON.stringify(body);
      const sig = createHmac("sha256", secretBytes)
        .update(`${id}.${nowTs}.${raw}`)
        .digest("base64");
      return new Request("https://playnoggin.vercel.app/api/billing/webhooks/dodo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "webhook-id": id,
          "webhook-timestamp": nowTs,
          "webhook-signature": `v1,${sig}`,
        },
        body: raw,
      });
    };

    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "ord-1", status: "paid" }, error: null }),
    });
    const maybeSingleOrder = vi.fn().mockResolvedValue({
      data: { provider_ref: "cks_sub_99" },
      error: null,
    });
    const eqProvider = vi.fn().mockReturnValue({ maybeSingle: maybeSingleOrder });
    const eqId = vi.fn().mockReturnValue({ eq: eqProvider });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    const from = vi.fn().mockReturnValue({ select });
    createServiceSupabaseClient.mockReturnValue({ rpc, from });

    // 1. payment.succeeded fulfills directly via checkout_session_id
    const res1 = await dodoWebhookPost(
      signRequest({
        type: "payment.succeeded",
        data: {
          payment_id: "pay_100",
          checkout_session_id: "cks_coins_100",
          status: "succeeded",
        },
      }),
    );
    expect(res1.status).toBe(200);
    await expect(res1.json()).resolves.toMatchObject({
      received: true,
      fulfilled: true,
      checkoutSessionId: "cks_coins_100",
    });
    expect(rpc).toHaveBeenCalledWith("fulfill_billing_order_by_provider_ref", {
      p_provider_ref: "cks_coins_100",
    });

    // 2. subscription.active without checkout_session_id resolves provider_ref via metadata.order_id
    rpc.mockClear();
    const orderUuid = "33333333-3333-4333-8333-333333333333";
    const res2 = await dodoWebhookPost(
      signRequest(
        {
          type: "subscription.active",
          data: {
            subscription_id: "sub_99",
            status: "active",
            metadata: { order_id: orderUuid },
          },
        },
        "msg_route_2",
      ),
    );
    expect(res2.status).toBe(200);
    await expect(res2.json()).resolves.toMatchObject({
      received: true,
      fulfilled: true,
      orderId: orderUuid,
    });
    expect(from).toHaveBeenCalledWith("billing_orders");
    expect(rpc).toHaveBeenCalledWith("fulfill_billing_order_by_provider_ref", {
      p_provider_ref: "cks_sub_99",
    });

    // 3. Invalid signature returns 401
    const badRes = await dodoWebhookPost(
      new Request("https://playnoggin.vercel.app/api/billing/webhooks/dodo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "webhook-id": "msg_bad",
          "webhook-timestamp": nowTs,
          "webhook-signature": "v1,invalid",
        },
        body: JSON.stringify({ type: "payment.succeeded", data: {} }),
      }),
    );
    expect(badRes.status).toBe(401);
  });

  it("keeps Dodo coin pack and Plus orders pending until webhook fulfillment", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "buyer-dodo" });

    let seq = 0;
    const redirectGateway = {
      providerName: "dodo",
      async authorizePurchase() {
        seq += 1;
        return {
          provider: "dodo",
          providerRef: `cks_dodo_${seq}`,
          checkoutUrl: `https://test.checkout.dodopayments.com/session/cks_dodo_${seq}`,
          requiresRedirect: true,
        };
      },
    };

    const coinRes = await checkoutCoinPack(
      {
        currentUser: deps.currentUser,
        billing: deps.billing,
        paymentGateway: redirectGateway,
      },
      { productCode: "c750", idempotencyKey: "dodo-idem-1" },
    );

    expect(coinRes.status).toBe("ok");
    if (coinRes.status !== "ok") return;
    expect(coinRes.pendingPayment).toBe(true);
    expect(coinRes.coinsAdded).toBe(0);
    expect(coinRes.order.status).toBe("pending");
    expect(coinRes.order.providerRef).toBe("cks_dodo_1");

    const plusRes = await subscribeNogginPlus(
      {
        currentUser: deps.currentUser,
        billing: deps.billing,
        paymentGateway: redirectGateway,
      },
      { productCode: "plus_yearly", idempotencyKey: "dodo-idem-2" },
    );

    expect(plusRes.status).toBe("ok");
    if (plusRes.status !== "ok") return;
    expect(plusRes.pendingPayment).toBe(true);
    await expect(
      deps.billing.getActiveSubscription("buyer-dodo"),
    ).resolves.toBeNull();

    const fulfilledCoins = await deps.billing.fulfillOrderByProviderRef("cks_dodo_1");
    expect(fulfilledCoins?.status).toBe("paid");
    expect(fulfilledCoins?.coinsCredited).toBe(850);
    expect(stores.economy.get("buyer-dodo")?.coins).toBe(1090);

    const fulfilledPlus = await deps.billing.fulfillOrderByProviderRef("cks_dodo_2");
    expect(fulfilledPlus?.status).toBe("paid");
    const activeSub = await deps.billing.getActiveSubscription("buyer-dodo");
    expect(activeSub?.planCode).toBe("plus");
    expect(activeSub?.status).toBe("active");
  });
});
