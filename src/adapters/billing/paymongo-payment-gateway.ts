import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentResult,
} from "@/core/application/ports";

const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

export interface PaymongoGatewayOptions {
  secretKey: string;
  appUrl: string;
  fetchImpl?: typeof fetch;
}

interface PaymongoCheckoutResponse {
  data?: {
    id?: string;
    attributes?: {
      checkout_url?: string;
    };
  };
  errors?: Array<{ detail?: string; code?: string }>;
}

export function createPaymongoPaymentGateway(
  options: PaymongoGatewayOptions,
): PaymentGateway {
  const secretKey = options.secretKey.trim();
  const baseUrl = options.appUrl.replace(/\/+$/, "");
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    providerName: "paymongo",

    async authorizePurchase(input): Promise<PaymentIntentResult> {
      const auth = Buffer.from(`${secretKey}:`).toString("base64");
      const successUrl = `${baseUrl}/profile/shop?checkout=success&product=${encodeURIComponent(input.product.code)}`;
      const cancelUrl = `${baseUrl}/profile/shop?checkout=cancelled`;

      const response = await fetchFn(`${PAYMONGO_API_BASE}/checkout_sessions`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              line_items: [
                {
                  currency: input.product.currency,
                  amount: input.product.priceCentavos,
                  name: input.product.name,
                  quantity: 1,
                },
              ],
              payment_method_types: ["gcash", "paymaya", "qrph", "card"],
              success_url: successUrl,
              cancel_url: cancelUrl,
              description: `Noggin: ${input.product.name}`,
              metadata: {
                order_id: input.orderId ?? "",
                user_id: input.userId,
                product_code: input.product.code,
                idempotency_key: input.idempotencyKey,
              },
            },
          },
        }),
      });

      const payload = (await response.json()) as PaymongoCheckoutResponse;
      const sessionId = payload.data?.id;
      const checkoutUrl = payload.data?.attributes?.checkout_url;

      if (!response.ok || !sessionId || !checkoutUrl) {
        const detail = payload.errors?.[0]?.detail ?? `HTTP ${response.status}`;
        throw new Error(`PayMongo checkout creation failed: ${detail}`);
      }

      return {
        provider: "paymongo",
        providerRef: sessionId,
        checkoutUrl,
        requiresRedirect: true,
      };
    },
  };
}

export interface VerifyPaymongoSignatureInput {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string;
  isLive?: boolean;
}

export function verifyPaymongoWebhookSignature(
  input: VerifyPaymongoSignatureInput,
): boolean {
  const { rawBody, signatureHeader, webhookSecret, isLive = false } = input;
  if (!signatureHeader || !webhookSecret.trim()) {
    return false;
  }

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const eqIndex = segment.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = segment.slice(0, eqIndex).trim();
    const val = segment.slice(eqIndex + 1).trim();
    if (key && val) {
      parts[key] = val;
    }
  }

  const timestamp = parts.t;
  const candidate = isLive ? parts.li : parts.te ?? parts.li;
  if (!timestamp || !candidate) {
    return false;
  }

  const computed = createHmac("sha256", webhookSecret.trim())
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(computed, "hex");
  const receivedBuf = Buffer.from(candidate, "hex");
  if (expectedBuf.length === 0 || expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function extractPaymongoPaidSessionId(eventBody: unknown): string | null {
  if (typeof eventBody !== "object" || eventBody === null) {
    return null;
  }
  const data = (eventBody as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const attrs = (data as { attributes?: unknown }).attributes;
  if (typeof attrs !== "object" || attrs === null) {
    return null;
  }

  const eventType = (attrs as { type?: unknown }).type;
  if (eventType !== "checkout_session.payment.paid") {
    return null;
  }

  const resource = (attrs as { data?: unknown }).data;
  if (typeof resource !== "object" || resource === null) {
    return null;
  }
  const sessionId = (resource as { id?: unknown }).id;
  return typeof sessionId === "string" && sessionId.trim().length > 0
    ? sessionId.trim()
    : null;
}
