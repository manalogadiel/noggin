import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentResult,
} from "@/core/application/ports";
import type { SalesProductCode } from "@/core/domain/billing";

const DODO_TEST_API_BASE = "https://test.dodopayments.com";
const DODO_LIVE_API_BASE = "https://live.dodopayments.com";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

const SALES_PRODUCT_CODES: readonly SalesProductCode[] = [
  "coins_100",
  "coins_300",
  "coins_750",
  "coins_1800",
  "plus_monthly",
  "plus_yearly",
];

const PRODUCT_ENV_KEYS: Record<SalesProductCode, string> = {
  coins_100: "DODO_PRODUCT_COINS_100",
  coins_300: "DODO_PRODUCT_COINS_300",
  coins_750: "DODO_PRODUCT_COINS_750",
  coins_1800: "DODO_PRODUCT_COINS_1800",
  plus_monthly: "DODO_PRODUCT_PLUS_MONTHLY",
  plus_yearly: "DODO_PRODUCT_PLUS_YEARLY",
};

export type DodoProductIdMap = Partial<Record<SalesProductCode, string>>;

export function resolveDodoProductIdsFromEnv(
  env: Record<string, string | undefined>,
): DodoProductIdMap {
  const mapped: DodoProductIdMap = {};
  const jsonRaw = env.DODO_PRODUCT_IDS?.trim();

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        const record = parsed as Record<string, unknown>;
        for (const code of SALES_PRODUCT_CODES) {
          const val = record[code];
          if (typeof val === "string" && val.trim().length > 0) {
            mapped[code] = val.trim();
          }
        }
      }
    } catch {
      // Ignore malformed JSON and rely on explicit per-product env vars.
    }
  }

  for (const code of SALES_PRODUCT_CODES) {
    const val = env[PRODUCT_ENV_KEYS[code]]?.trim();
    if (val) {
      mapped[code] = val;
    }
  }

  return mapped;
}

export interface DodoGatewayOptions {
  apiKey: string;
  appUrl: string;
  productIds: DodoProductIdMap;
  testMode?: boolean;
  fetchImpl?: typeof fetch;
}

interface DodoCheckoutResponse {
  session_id?: string | null;
  checkout_url?: string | null;
  payment_link?: string | null;
  message?: string;
  error?: string;
  detail?: unknown;
}

function formatDodoErrorDetail(
  payload: DodoCheckoutResponse,
  status: number,
): string {
  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message.trim();
  }
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error.trim();
  }
  if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
    return payload.detail.trim();
  }
  if (payload.detail !== undefined && payload.detail !== null) {
    return JSON.stringify(payload.detail);
  }
  return `HTTP ${status}`;
}

export function createDodoPaymentGateway(
  options: DodoGatewayOptions,
): PaymentGateway {
  const apiKey = options.apiKey.trim();
  const baseUrl = options.appUrl.replace(/\/+$/, "");
  const apiBase =
    options.testMode === false ? DODO_LIVE_API_BASE : DODO_TEST_API_BASE;
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    providerName: "dodo",

    async authorizePurchase(input): Promise<PaymentIntentResult> {
      const dodoProductId = options.productIds[input.product.code]?.trim();
      if (!dodoProductId) {
        throw new Error(
          `Dodo product ID not configured for ${input.product.code}`,
        );
      }

      const returnUrl = `${baseUrl}/profile/shop?checkout=success&product=${encodeURIComponent(input.product.code)}`;

      const response = await fetchFn(`${apiBase}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          product_cart: [
            {
              product_id: dodoProductId,
              quantity: 1,
            },
          ],
          return_url: returnUrl,
          metadata: {
            order_id: input.orderId ?? "",
            user_id: input.userId,
            product_code: input.product.code,
            idempotency_key: input.idempotencyKey,
          },
        }),
      });

      let payload: DodoCheckoutResponse = {};
      try {
        payload = (await response.json()) as DodoCheckoutResponse;
      } catch {
        // Handle non-JSON upstream error responses cleanly below.
      }

      const sessionId = payload.session_id?.trim() ?? "";
      const checkoutUrl =
        payload.checkout_url?.trim() || payload.payment_link?.trim() || "";

      if (!response.ok || !sessionId || !checkoutUrl) {
        const detail = formatDodoErrorDetail(payload, response.status);
        throw new Error(`Dodo checkout creation failed: ${detail}`);
      }

      return {
        provider: "dodo",
        providerRef: sessionId,
        checkoutUrl,
        requiresRedirect: true,
      };
    },
  };
}

export interface VerifyDodoWebhookSignatureInput {
  rawBody: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  webhookSecret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}

function buildSecretKeyBuffers(secret: string): Buffer[] {
  const trimmed = secret.trim();
  if (!trimmed) {
    return [];
  }

  const keys: Buffer[] = [];
  if (trimmed.startsWith("whsec_")) {
    const rawBase64 = trimmed.slice("whsec_".length);
    if (rawBase64.length > 0 && BASE64_REGEX.test(rawBase64)) {
      const decoded = Buffer.from(rawBase64, "base64");
      if (decoded.length > 0) {
        keys.push(decoded);
      }
    }
  }
  keys.push(Buffer.from(trimmed, "utf8"));
  return keys;
}

export function verifyDodoWebhookSignature(
  input: VerifyDodoWebhookSignatureInput,
): boolean {
  const id = input.webhookId?.trim() ?? "";
  const tsStr = input.webhookTimestamp?.trim() ?? "";
  const sigHeader = input.webhookSignature?.trim() ?? "";
  const toleranceSeconds =
    input.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!id || !tsStr || !sigHeader) {
    return false;
  }

  if (!/^\d+$/.test(tsStr)) {
    return false;
  }

  const timestamp = Number.parseInt(tsStr, 10);
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(nowSeconds - timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const secretKeys = buildSecretKeyBuffers(input.webhookSecret);
  if (secretKeys.length === 0) {
    return false;
  }

  const signedContent = `${id}.${tsStr}.${input.rawBody}`;
  const candidateDigests: Buffer[] = [];

  for (const token of sigHeader.split(/\s+/)) {
    if (!token.startsWith("v1,") && !token.startsWith("v1=")) {
      continue;
    }
    const candidateB64 = token.slice(3).trim();
    if (!candidateB64 || !BASE64_REGEX.test(candidateB64)) {
      continue;
    }
    const decoded = Buffer.from(candidateB64, "base64");
    if (decoded.length > 0) {
      candidateDigests.push(decoded);
    }
  }

  if (candidateDigests.length === 0) {
    return false;
  }

  for (const keyBuf of secretKeys) {
    const expected = createHmac("sha256", keyBuf).update(signedContent).digest();
    for (const candidate of candidateDigests) {
      if (
        expected.length === candidate.length &&
        timingSafeEqual(expected, candidate)
      ) {
        return true;
      }
    }
  }

  return false;
}

export interface DodoFulfillmentRef {
  eventType: "payment.succeeded" | "subscription.active";
  checkoutSessionId: string | null;
  orderId: string | null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function extractDodoFulfillmentRef(
  eventBody: unknown,
): DodoFulfillmentRef | null {
  if (typeof eventBody !== "object" || eventBody === null) {
    return null;
  }

  const record = eventBody as Record<string, unknown>;
  const eventType = record.type;
  if (eventType !== "payment.succeeded" && eventType !== "subscription.active") {
    return null;
  }

  const data = record.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  const status = readNonEmptyString(dataRecord.status)?.toLowerCase();

  if (
    eventType === "payment.succeeded" &&
    status &&
    status !== "succeeded" &&
    status !== "paid"
  ) {
    return null;
  }

  if (
    eventType === "subscription.active" &&
    status &&
    status !== "active"
  ) {
    return null;
  }

  const checkoutSessionId = readNonEmptyString(dataRecord.checkout_session_id);
  const metadata =
    typeof dataRecord.metadata === "object" && dataRecord.metadata !== null
      ? (dataRecord.metadata as Record<string, unknown>)
      : null;
  const orderId = metadata ? readNonEmptyString(metadata.order_id) : null;

  if (!checkoutSessionId && !orderId) {
    return null;
  }

  return {
    eventType,
    checkoutSessionId,
    orderId,
  };
}
