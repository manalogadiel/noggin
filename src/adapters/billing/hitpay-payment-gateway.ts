import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentResult,
} from "@/core/application/ports";

const HITPAY_SANDBOX_API_BASE = "https://api.sandbox.hit-pay.com/v1";
const HITPAY_LIVE_API_BASE = "https://api.hit-pay.com/v1";
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;

export interface HitpayGatewayOptions {
  apiKey: string;
  appUrl: string;
  sandbox?: boolean;
  paymentMethods?: string[];
  fetchImpl?: typeof fetch;
}

interface HitpayPaymentRequestResponse {
  id?: string;
  url?: string;
  message?: string;
}

export function createHitpayPaymentGateway(
  options: HitpayGatewayOptions,
): PaymentGateway {
  const apiKey = options.apiKey.trim();
  const baseUrl = options.appUrl.replace(/\/+$/, "");
  const apiBase =
    options.sandbox === false ? HITPAY_LIVE_API_BASE : HITPAY_SANDBOX_API_BASE;
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    providerName: "hitpay",

    async authorizePurchase(input): Promise<PaymentIntentResult> {
      const amount = (input.product.priceCentavos / 100).toFixed(2);
      const redirectUrl = `${baseUrl}/profile/shop?checkout=success&product=${encodeURIComponent(input.product.code)}`;
      const webhookUrl = `${baseUrl}/api/billing/webhooks/hitpay`;

      const payloadBody: Record<string, unknown> = {
        amount,
        currency: input.product.currency,
        purpose: `Noggin: ${input.product.name}`,
        reference_number: input.orderId ?? input.idempotencyKey,
        redirect_url: redirectUrl,
        webhook: webhookUrl,
        allow_repeated_payments: false,
        send_email: false,
        send_sms: false,
      };

      if (options.paymentMethods && options.paymentMethods.length > 0) {
        payloadBody.payment_methods = options.paymentMethods;
      }

      const response = await fetchFn(`${apiBase}/payment-requests`, {
        method: "POST",
        headers: {
          "X-BUSINESS-API-KEY": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payloadBody),
      });

      const payload = (await response.json()) as HitpayPaymentRequestResponse;
      const requestId = payload.id?.trim();
      const checkoutUrl = payload.url?.trim();

      if (!response.ok || !requestId || !checkoutUrl) {
        const detail = payload.message ?? `HTTP ${response.status}`;
        throw new Error(`HitPay payment request creation failed: ${detail}`);
      }

      return {
        provider: "hitpay",
        providerRef: requestId,
        checkoutUrl,
        requiresRedirect: true,
      };
    },
  };
}

function timingSafeHexEqual(expectedHex: string, candidateHex: string): boolean {
  const normalized = candidateHex.trim().toLowerCase();
  if (!SHA256_HEX_REGEX.test(normalized)) {
    return false;
  }
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const candidateBuf = Buffer.from(normalized, "hex");
  if (expectedBuf.length === 0 || expectedBuf.length !== candidateBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, candidateBuf);
}

export interface VerifyHitpayEventSignatureInput {
  rawBody: string;
  signatureHeader: string | null;
  salt: string;
}

export function verifyHitpayEventSignature(
  input: VerifyHitpayEventSignatureInput,
): boolean {
  const trimmedSalt = input.salt.trim();
  if (!input.signatureHeader || !trimmedSalt) {
    return false;
  }

  const computed = createHmac("sha256", trimmedSalt)
    .update(input.rawBody)
    .digest("hex");

  return timingSafeHexEqual(computed, input.signatureHeader);
}

export interface VerifyHitpayCallbackHmacInput {
  params: Record<string, string>;
  salt: string;
}

export function verifyHitpayCallbackHmac(
  input: VerifyHitpayCallbackHmacInput,
): boolean {
  const trimmedSalt = input.salt.trim();
  const received = input.params.hmac ?? "";
  if (!received.trim() || !trimmedSalt) {
    return false;
  }

  const sortedKeys = Object.keys(input.params)
    .filter((key) => key !== "hmac")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const concatenated = sortedKeys
    .map((key) => `${key}${input.params[key] ?? ""}`)
    .join("");

  const computed = createHmac("sha256", trimmedSalt)
    .update(concatenated)
    .digest("hex");

  return timingSafeHexEqual(computed, received);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function extractHitpayCompletedRequestId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const flatStatus = readNonEmptyString(record.status)?.toLowerCase();
  if (flatStatus === "completed") {
    return (
      readNonEmptyString(record.payment_request_id) ??
      readNonEmptyString(record.id)
    );
  }

  const eventName = (
    readNonEmptyString(record.event_type) ?? readNonEmptyString(record.event)
  )?.toLowerCase();

  const data = record.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  const dataStatus = readNonEmptyString(dataRecord.status)?.toLowerCase();
  if (eventName === "payment_request.completed" || dataStatus === "completed") {
    return (
      readNonEmptyString(dataRecord.id) ??
      readNonEmptyString(dataRecord.payment_request_id)
    );
  }

  return null;
}
