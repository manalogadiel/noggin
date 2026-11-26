import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createPolarPaymentGateway,
  extractPolarPaidCheckoutId,
  resolvePolarProductIdsFromEnv,
  verifyPolarWebhookSignature,
} from "@/adapters/billing/polar-payment-gateway";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import {
  checkoutCoinPack,
  subscribeNogginPlus,
} from "@/core/application/use-cases/billing";
import { findSalesProduct } from "@/core/domain/billing";

describe("Polar.sh Checkout gateway and Standard Webhooks verification", () => {
  it("resolves product IDs from JSON map and individual env overrides", () => {
    const resolved = resolvePolarProductIdsFromEnv({
      POLAR_PRODUCT_IDS: JSON.stringify({
        coins_100: "prod_json_100",
        coins_300: "prod_json_300",
      }),
      POLAR_PRODUCT_COINS_300: "prod_env_300",
      POLAR_PRODUCT_PLUS_MONTHLY: "prod_env_plus_m",
    });

    expect(resolved).toEqual({
      coins_100: "prod_json_100",
      coins_300: "prod_env_300",
      plus_monthly: "prod_env_plus_m",
    });

    expect(
      resolvePolarProductIdsFromEnv({
        POLAR_PRODUCT_IDS: "{not-json",
        POLAR_PRODUCT_COINS_750: "prod_750",
      }),
    ).toEqual({ coins_750: "prod_750" });
  });

  it("creates a sandbox Polar checkout session with Bearer auth, product UUID, success_url, and metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chk_sandbox_123",
          url: "https://sandbox.polar.sh/checkout/polar_c_123",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const gateway = createPolarPaymentGateway({
      accessToken: "polar_oat_sandbox_abc",
      appUrl: "https://noggin.app/",
      productIds: {
        coins_300: "11111111-1111-1111-1111-111111111300",
      },
      fetchImpl: fetchMock,
    });

    const intent = await gateway.authorizePurchase({
      userId: "user-1",
      product: findSalesProduct("c300")!,
      idempotencyKey: "idem-polar-1",
      orderId: "ord-polar-1",
    });

    expect(intent).toEqual({
      provider: "polar",
      providerRef: "chk_sandbox_123",
      checkoutUrl: "https://sandbox.polar.sh/checkout/polar_c_123",
      requiresRedirect: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer polar_oat_sandbox_abc");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      products: ["11111111-1111-1111-1111-111111111300"],
      success_url:
        "https://noggin.app/profile/shop?checkout=success&product=coins_300&checkout_id={CHECKOUT_ID}",
      metadata: {
        order_id: "ord-polar-1",
        user_id: "user-1",
        product_code: "coins_300",
        idempotency_key: "idem-polar-1",
      },
    });
  });

  it("targets live Polar API when sandbox=false and fails clearly when product mapping or API request fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chk_live_456",
          url: "https://polar.sh/checkout/polar_c_456",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const liveGateway = createPolarPaymentGateway({
      accessToken: "polar_oat_live_xyz",
      appUrl: "https://noggin.app",
      sandbox: false,
      productIds: {
        plus_monthly: "22222222-2222-2222-2222-222222222201",
      },
      fetchImpl: fetchMock,
    });

    await liveGateway.authorizePurchase({
      userId: "user-2",
      product: findSalesProduct("plus_monthly")!,
      idempotencyKey: "idem-polar-2",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.polar.sh/v1/checkouts/");

    await expect(
      liveGateway.authorizePurchase({
        userId: "user-2",
        product: findSalesProduct("c100")!,
        idempotencyKey: "idem-missing",
      }),
    ).rejects.toThrow("Polar product ID not configured for coins_100");

    const failingFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid access token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const errGateway = createPolarPaymentGateway({
      accessToken: "bad_token",
      appUrl: "https://noggin.app",
      productIds: { coins_100: "prod_100" },
      fetchImpl: failingFetch,
    });
    await expect(
      errGateway.authorizePurchase({
        userId: "user-2",
        product: findSalesProduct("c100")!,
        idempotencyKey: "idem-err",
      }),
    ).rejects.toThrow("Polar checkout creation failed: Invalid access token");
  });

  it("verifies Standard Webhooks whsec_ base64 keys, literal secrets, multi-signatures, and tolerance", () => {
    const rawBody = JSON.stringify({
      type: "order.paid",
      data: { id: "ord_1", checkout_id: "chk_1", paid: true },
    });
    const webhookId = "msg_2abc123";
    const now = 1795610000;
    const timestamp = String(now - 30);

    const base64SecretBytes = Buffer.from("super-secret-polar-key-32bytes!!");
    const whsecSecret = `whsec_${base64SecretBytes.toString("base64")}`;
    const expectedB64 = createHmac("sha256", base64SecretBytes)
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      verifyPolarWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,deadbeef v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(true);

    const legacySecret = "polar_whs_literal_secret_abc";
    const expectedLegacyB64 = createHmac("sha256", Buffer.from(legacySecret, "utf8"))
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      verifyPolarWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${expectedLegacyB64}`,
        webhookSecret: legacySecret,
        nowSeconds: now,
      }),
    ).toBe(true);

    expect(
      verifyPolarWebhookSignature({
        rawBody: `${rawBody} `,
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(false);

    expect(
      verifyPolarWebhookSignature({
        rawBody,
        webhookId,
        webhookTimestamp: String(now - 600),
        webhookSignature: `v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(false);

    expect(
      verifyPolarWebhookSignature({
        rawBody,
        webhookId: null,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${expectedB64}`,
        webhookSecret: whsecSecret,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it("extracts checkout_id only from paid order.paid events", () => {
    expect(
      extractPolarPaidCheckoutId({
        type: "order.paid",
        data: { id: "ord_1", checkout_id: "chk_paid_1", paid: true },
      }),
    ).toBe("chk_paid_1");

    expect(
      extractPolarPaidCheckoutId({
        type: "order.created",
        data: { id: "ord_2", checkout_id: "chk_2" },
      }),
    ).toBeNull();

    expect(
      extractPolarPaidCheckoutId({
        type: "order.paid",
        data: { id: "ord_3", checkout_id: "chk_3", paid: false },
      }),
    ).toBeNull();

    expect(
      extractPolarPaidCheckoutId({
        type: "order.paid",
        data: { id: "ord_4", checkout_id: null, paid: true },
      }),
    ).toBeNull();
  });

  it("keeps Polar coin pack and Plus orders pending until webhook fulfillment", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "buyer-polar" });

    let seq = 0;
    const redirectGateway = {
      providerName: "polar",
      async authorizePurchase() {
        seq += 1;
        return {
          provider: "polar",
          providerRef: `chk_polar_${seq}`,
          checkoutUrl: `https://sandbox.polar.sh/checkout/chk_polar_${seq}`,
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
      { productCode: "c750", idempotencyKey: "polar-idem-1" },
    );

    expect(coinRes.status).toBe("ok");
    if (coinRes.status !== "ok") return;
    expect(coinRes.pendingPayment).toBe(true);
    expect(coinRes.coinsAdded).toBe(0);
    expect(coinRes.order.status).toBe("pending");
    expect(coinRes.order.providerRef).toBe("chk_polar_1");

    const plusRes = await subscribeNogginPlus(
      {
        currentUser: deps.currentUser,
        billing: deps.billing,
        paymentGateway: redirectGateway,
      },
      { productCode: "plus_yearly", idempotencyKey: "polar-idem-2" },
    );

    expect(plusRes.status).toBe("ok");
    if (plusRes.status !== "ok") return;
    expect(plusRes.pendingPayment).toBe(true);
    await expect(
      deps.billing.getActiveSubscription("buyer-polar"),
    ).resolves.toBeNull();

    const fulfilledCoins = await deps.billing.fulfillOrderByProviderRef("chk_polar_1");
    expect(fulfilledCoins?.status).toBe("paid");
    expect(fulfilledCoins?.coinsCredited).toBe(850);
    expect(stores.economy.get("buyer-polar")?.coins).toBe(1090);

    const fulfilledPlus = await deps.billing.fulfillOrderByProviderRef("chk_polar_2");
    expect(fulfilledPlus?.status).toBe("paid");
    const activeSub = await deps.billing.getActiveSubscription("buyer-polar");
    expect(activeSub?.planCode).toBe("plus");
    expect(activeSub?.status).toBe("active");
  });
});
