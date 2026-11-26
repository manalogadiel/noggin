import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentResult,
} from "@/core/application/ports";
import type { SalesProductCode } from "@/core/domain/billing";

const POLAR_SANDBOX_API_BASE = "https://sandbox-api.polar.sh/v1";
const POLAR_LIVE_API_BASE = "https://api.polar.sh/v1";
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
  coins_100: "POLAR_PRODUCT_COINS_100",
  coins_300: "POLAR_PRODUCT_COINS_300",
  coins_750: "POLAR_PRODUCT_COINS_750",
  coins_1800: "POLAR_PRODUCT_COINS_1800",
  plus_monthly: "POLAR_PRODUCT_PLUS_MONTHLY",
  plus_yearly: "POLAR_PRODUCT_PLUS_YEARLY",
};

export type PolarProductIdMap = Partial<Record<SalesProductCode, string>>;

export function resolvePolarProductIdsFromEnv(
  env: Record<string, string | undefined>,
): PolarProductIdMap {
  const mapped: PolarProductIdMap = {};
  const jsonRaw = env.POLAR_PRODUCT_IDS?.trim();

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

export interface PolarGatewayOptions {
  accessToken: string;
  appUrl: string;
  productIds: PolarProductIdMap;
  sandbox?: boolean;
  fetchImpl?: typeof fetch;
}

interface PolarCheckoutResponse {
  id?: string;
  url?: string;
  detail?: unknown;
  error?: string;
}

function formatPolarErrorDetail(payload: PolarCheckoutResponse, status: number): string {
  if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
    return payload.detail.trim();
  }
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error.trim();
  }
  if (payload.detail !== undefined && payload.detail !== null) {
    return JSON.stringify(payload.detail);
  }
  return `HTTP ${status}`;
}

export function createPolarPaymentGateway(
  options: PolarGatewayOptions,
): PaymentGateway {
  const accessToken = options.accessToken.trim();
  const baseUrl = options.appUrl.replace(/\/+$/, "");
  const apiBase =
    options.sandbox === false ? POLAR_LIVE_API_BASE : POLAR_SANDBOX_API_BASE;
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    providerName: "polar",

    async authorizePurchase(input): Promise<PaymentIntentResult> {
      const polarProductId = options.productIds[input.product.code]?.trim();
      if (!polarProductId) {
        throw new Error(
          `Polar product ID not configured for ${input.product.code}`,
        );
      }

      const successUrl = `${baseUrl}/profile/shop?checkout=success&product=${encodeURIComponent(input.product.code)}&checkout_id={CHECKOUT_ID}`;

      const response = await fetchFn(`${apiBase}/checkouts/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          products: [polarProductId],
          success_url: successUrl,
          metadata: {
            order_id: input.orderId ?? "",
            user_id: input.userId,
            product_code: input.product.code,
            idempotency_key: input.idempotencyKey,
          },
        }),
      });

      const payload = (await response.json()) as PolarCheckoutResponse;
      const checkoutId = payload.id?.trim();
      const checkoutUrl = payload.url?.trim();

      if (!response.ok || !checkoutId || !checkoutUrl) {
        const detail = formatPolarErrorDetail(payload, response.status);
        throw new Error(`Polar checkout creation failed: ${detail}`);
      }

      return {
        provider: "polar",
        providerRef: checkoutId,
        checkoutUrl,
        requiresRedirect: true,
      };
    },
  };
}

export interface VerifyPolarWebhookSignatureInput {
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

export function verifyPolarWebhookSignature(
  input: VerifyPolarWebhookSignatureInput,
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

export function extractPolarPaidCheckoutId(eventBody: unknown): string | null {
  if (typeof eventBody !== "object" || eventBody === null) {
    return null;
  }

  const record = eventBody as Record<string, unknown>;
  if (record.type !== "order.paid") {
    return null;
  }

  const data = record.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  if (dataRecord.paid === false) {
    return null;
  }

  const checkoutId = dataRecord.checkout_id;
  return typeof checkoutId === "string" && checkoutId.trim().length > 0
    ? checkoutId.trim()
    : null;
}
