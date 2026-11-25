import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createPaymongoPaymentGateway,
  extractPaymongoPaidSessionId,
  verifyPaymongoWebhookSignature,
} from "@/adapters/billing/paymongo-payment-gateway";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { checkoutCoinPack } from "@/core/application/use-cases/billing";
import { findSalesProduct } from "@/core/domain/billing";

describe("PayMongo Checkout gateway and webhook verification", () => {
  it("creates a PayMongo checkout session with Basic auth, PHP centavos, and e-wallet/card methods", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_test_123",
            attributes: {
              checkout_url: "https://checkout.paymongo.com/cs_test_123",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const gateway = createPaymongoPaymentGateway({
      secretKey: "sk_test_example_secret",
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
      provider: "paymongo",
      providerRef: "cs_test_123",
      checkoutUrl: "https://checkout.paymongo.com/cs_test_123",
      requiresRedirect: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.paymongo.com/v1/checkout_sessions");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("sk_test_example_secret:").toString("base64")}`,
    );

    const body = JSON.parse(String(init?.body)) as {
      data: {
        attributes: {
          line_items: Array<{ amount: number; currency: string }>;
          payment_method_types: string[];
          success_url: string;
          cancel_url: string;
        };
      };
    };
    expect(body.data.attributes.line_items[0]).toMatchObject({
      amount: 11900,
      currency: "PHP",
    });
    expect(body.data.attributes.payment_method_types).toEqual([
      "gcash",
      "paymaya",
      "qrph",
      "card",
    ]);
    expect(body.data.attributes.success_url).toBe(
      "https://noggin.app/profile/shop?checkout=success&product=coins_300",
    );
  });

  it("verifies Paymongo-Signature HMAC-SHA256 digests and rejects tampered payloads", () => {
    const secret = "whsk_test_secret";
    const timestamp = "1795610000";
    const rawBody = JSON.stringify({
      data: {
        attributes: {
          type: "checkout_session.payment.paid",
          data: { id: "cs_test_abc" },
        },
      },
    });
    const sig = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    expect(
      verifyPaymongoWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},te=${sig},li=`,
        webhookSecret: secret,
        isLive: false,
      }),
    ).toBe(true);

    expect(
      verifyPaymongoWebhookSignature({
        rawBody: `${rawBody} `,
        signatureHeader: `t=${timestamp},te=${sig},li=`,
        webhookSecret: secret,
        isLive: false,
      }),
    ).toBe(false);

    expect(
      verifyPaymongoWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},te=deadbeef`,
        webhookSecret: secret,
        isLive: false,
      }),
    ).toBe(false);

    expect(extractPaymongoPaidSessionId(JSON.parse(rawBody))).toBe(
      "cs_test_abc",
    );
  });

  it("keeps redirect checkout orders pending until webhook fulfillment credits coins", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "buyer-pm" });

    const redirectGateway = {
      providerName: "paymongo",
      async authorizePurchase() {
        return {
          provider: "paymongo",
          providerRef: "cs_pending_99",
          checkoutUrl: "https://checkout.paymongo.com/cs_pending_99",
          requiresRedirect: true,
        };
      },
    };

    const res = await checkoutCoinPack(
      {
        currentUser: deps.currentUser,
        billing: deps.billing,
        paymentGateway: redirectGateway,
      },
      { productCode: "c750", idempotencyKey: "pm-idem-1" },
    );

    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.pendingPayment).toBe(true);
    expect(res.coinsAdded).toBe(0);
    expect(res.checkoutUrl).toBe("https://checkout.paymongo.com/cs_pending_99");
    expect(res.order.status).toBe("pending");
    expect(res.order.providerRef).toBe("cs_pending_99");

    const fulfilled = await deps.billing.fulfillOrderByProviderRef("cs_pending_99");
    expect(fulfilled?.status).toBe("paid");
    expect(fulfilled?.coinsCredited).toBe(850);
    expect(stores.economy.get("buyer-pm")?.coins).toBe(1090);
  });
});
