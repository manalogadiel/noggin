import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createHitpayPaymentGateway,
  extractHitpayCompletedRequestId,
  verifyHitpayCallbackHmac,
  verifyHitpayEventSignature,
} from "@/adapters/billing/hitpay-payment-gateway";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import {
  checkoutCoinPack,
  subscribeNogginPlus,
} from "@/core/application/use-cases/billing";
import { findSalesProduct } from "@/core/domain/billing";

describe("HitPay Payment Request gateway and webhook verification", () => {
  it("creates a sandbox HitPay payment request with PHP decimal amount and redirect/webhook URLs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "hp_req_sandbox_123",
          url: "https://securecheckout.sandbox.hit-pay.com/payment-request/@noggin/hp_req_sandbox_123/checkout",
          status: "pending",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const gateway = createHitpayPaymentGateway({
      apiKey: "hp_test_key_123",
      appUrl: "https://noggin.app/",
      fetchImpl: fetchMock,
    });

    const product = findSalesProduct("c300")!;
    const intent = await gateway.authorizePurchase({
      userId: "user-1",
      product,
      idempotencyKey: "idem-1",
      orderId: "ord-1",
    });

    expect(intent).toEqual({
      provider: "hitpay",
      providerRef: "hp_req_sandbox_123",
      checkoutUrl:
        "https://securecheckout.sandbox.hit-pay.com/payment-request/@noggin/hp_req_sandbox_123/checkout",
      requiresRedirect: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sandbox.hit-pay.com/v1/payment-requests");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-BUSINESS-API-KEY"]).toBe("hp_test_key_123");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      amount: "119.00",
      currency: "PHP",
      purpose: "Noggin: 300 Coins + 20 Bonus",
      reference_number: "ord-1",
      redirect_url:
        "https://noggin.app/profile/shop?checkout=success&product=coins_300",
      webhook: "https://noggin.app/api/billing/webhooks/hitpay",
      allow_repeated_payments: false,
      send_email: false,
      send_sms: false,
    });
    expect("payment_methods" in body).toBe(false);
  });

  it("targets live HitPay API when sandbox=false and passes explicit payment methods when configured", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "hp_req_live_456",
          url: "https://checkout.hit-pay.com/pay/hp_req_live_456",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const gateway = createHitpayPaymentGateway({
      apiKey: "hp_live_key",
      appUrl: "https://noggin.app",
      sandbox: false,
      paymentMethods: ["gcash", "qrph_netbank", "card"],
      fetchImpl: fetchMock,
    });

    const intent = await gateway.authorizePurchase({
      userId: "user-2",
      product: findSalesProduct("plus_monthly")!,
      idempotencyKey: "idem-2",
      orderId: "ord-2",
    });

    expect(intent.providerRef).toBe("hp_req_live_456");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.hit-pay.com/v1/payment-requests");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.amount).toBe("249.00");
    expect(body.payment_methods).toEqual(["gcash", "qrph_netbank", "card"]);
  });

  it("throws when HitPay returns a non-OK status", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const gateway = createHitpayPaymentGateway({
      apiKey: "bad_key",
      appUrl: "https://noggin.app",
      fetchImpl: fetchMock,
    });

    await expect(
      gateway.authorizePurchase({
        userId: "user-1",
        product: findSalesProduct("c100")!,
        idempotencyKey: "idem-err",
      }),
    ).rejects.toThrow("HitPay payment request creation failed: Unauthorized");
  });

  it("verifies Hitpay-Signature HMAC-SHA256 digests and rejects tampered or malformed signatures", () => {
    const salt = "wh_salt_secret";
    const rawBody = JSON.stringify({
      event_type: "payment_request.completed",
      data: { id: "hp_evt_99", status: "completed" },
    });
    const sig = createHmac("sha256", salt).update(rawBody).digest("hex");

    expect(
      verifyHitpayEventSignature({
        rawBody,
        signatureHeader: sig,
        salt,
      }),
    ).toBe(true);

    expect(
      verifyHitpayEventSignature({
        rawBody: `${rawBody} `,
        signatureHeader: sig,
        salt,
      }),
    ).toBe(false);

    expect(
      verifyHitpayEventSignature({
        rawBody,
        signatureHeader: "not-a-hex-digest",
        salt,
      }),
    ).toBe(false);

    expect(
      verifyHitpayEventSignature({
        rawBody,
        signatureHeader: sig,
        salt: "",
      }),
    ).toBe(false);
  });

  it("verifies HitPay form-urlencoded callback HMACs using sorted key-value concatenation", () => {
    const apiSalt = "api_salt_123";
    const fields = {
      status: "completed",
      amount: "119.00",
      currency: "PHP",
      payment_id: "pay_1",
      payment_request_id: "hp_cb_77",
      reference_number: "ord-1",
    };

    const sortedPayload = Object.keys(fields)
      .sort()
      .map((k) => `${k}${fields[k as keyof typeof fields]}`)
      .join("");
    const hmac = createHmac("sha256", apiSalt)
      .update(sortedPayload)
      .digest("hex");

    expect(
      verifyHitpayCallbackHmac({
        params: { ...fields, hmac },
        salt: apiSalt,
      }),
    ).toBe(true);

    expect(
      verifyHitpayCallbackHmac({
        params: { ...fields, amount: "1.00", hmac },
        salt: apiSalt,
      }),
    ).toBe(false);

    expect(
      verifyHitpayCallbackHmac({
        params: { ...fields },
        salt: apiSalt,
      }),
    ).toBe(false);

    expect(
      verifyHitpayCallbackHmac({
        params: { ...fields, hmac },
        salt: "wrong_salt",
      }),
    ).toBe(false);
  });

  it("extracts completed payment request IDs from callback and event payloads only when completed", () => {
    expect(
      extractHitpayCompletedRequestId({
        payment_request_id: "hp_cb_1",
        status: "completed",
      }),
    ).toBe("hp_cb_1");

    expect(
      extractHitpayCompletedRequestId({
        payment_request_id: "hp_cb_2",
        status: "pending",
      }),
    ).toBeNull();

    expect(
      extractHitpayCompletedRequestId({
        event_type: "payment_request.completed",
        data: { id: "hp_evt_1" },
      }),
    ).toBe("hp_evt_1");

    expect(
      extractHitpayCompletedRequestId({
        event_type: "payment_request.failed",
        data: { id: "hp_evt_2", status: "failed" },
      }),
    ).toBeNull();
  });

  it("keeps HitPay redirect coin and Plus orders pending until webhook fulfillment", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "buyer-hp" });

    let seq = 0;
    const redirectGateway = {
      providerName: "hitpay",
      async authorizePurchase() {
        seq += 1;
        return {
          provider: "hitpay",
          providerRef: `hp_req_${seq}`,
          checkoutUrl: `https://checkout.hit-pay.com/pay/hp_req_${seq}`,
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
      { productCode: "c750", idempotencyKey: "hp-idem-1" },
    );

    expect(coinRes.status).toBe("ok");
    if (coinRes.status !== "ok") return;
    expect(coinRes.pendingPayment).toBe(true);
    expect(coinRes.coinsAdded).toBe(0);
    expect(coinRes.checkoutUrl).toBe("https://checkout.hit-pay.com/pay/hp_req_1");
    expect(coinRes.order.status).toBe("pending");
    expect(coinRes.order.providerRef).toBe("hp_req_1");

    const plusRes = await subscribeNogginPlus(
      {
        currentUser: deps.currentUser,
        billing: deps.billing,
        paymentGateway: redirectGateway,
      },
      { productCode: "plus_monthly", idempotencyKey: "hp-idem-2" },
    );

    expect(plusRes.status).toBe("ok");
    if (plusRes.status !== "ok") return;
    expect(plusRes.pendingPayment).toBe(true);
    expect(plusRes.order.status).toBe("pending");
    await expect(
      deps.billing.getActiveSubscription("buyer-hp"),
    ).resolves.toBeNull();

    const fulfilledCoins = await deps.billing.fulfillOrderByProviderRef("hp_req_1");
    expect(fulfilledCoins?.status).toBe("paid");
    expect(fulfilledCoins?.coinsCredited).toBe(850);
    expect(stores.economy.get("buyer-hp")?.coins).toBe(1090);

    const fulfilledPlus = await deps.billing.fulfillOrderByProviderRef("hp_req_2");
    expect(fulfilledPlus?.status).toBe("paid");
    const activeSub = await deps.billing.getActiveSubscription("buyer-hp");
    expect(activeSub?.planCode).toBe("plus");
    expect(activeSub?.status).toBe("active");
  });
});
