import { NextResponse } from "next/server";
import {
  extractHitpayCompletedRequestId,
  verifyHitpayCallbackHmac,
  verifyHitpayEventSignature,
} from "@/adapters/billing/hitpay-payment-gateway";
import { createServiceSupabaseClient } from "@/adapters/supabase/service-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const webhookSalt = process.env.HITPAY_WEBHOOK_SALT?.trim() ?? "";
  const apiSalt = process.env.HITPAY_SALT?.trim() ?? "";
  const eventSalt = webhookSalt || apiSalt;
  const callbackSalt = apiSalt || webhookSalt;

  if (!eventSalt && !callbackSalt) {
    return NextResponse.json(
      { error: "HitPay webhook salt not configured." },
      { status: 503 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Unable to read webhook payload." },
      { status: 400 },
    );
  }

  const signatureHeader =
    request.headers.get("hitpay-signature") ??
    request.headers.get("x-hitpay-signature");

  let parsedPayload: unknown;
  if (signatureHeader) {
    if (
      !verifyHitpayEventSignature({
        rawBody,
        signatureHeader,
        salt: eventSalt,
      })
    ) {
      return NextResponse.json(
        { error: "Invalid HitPay signature." },
        { status: 401 },
      );
    }

    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 },
      );
    }
  } else {
    const searchParams = new URLSearchParams(rawBody);
    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }

    if (!params.hmac) {
      return NextResponse.json(
        { error: "Missing HitPay signature." },
        { status: 401 },
      );
    }

    if (!verifyHitpayCallbackHmac({ params, salt: callbackSalt })) {
      return NextResponse.json(
        { error: "Invalid HitPay signature." },
        { status: 401 },
      );
    }

    parsedPayload = params;
  }

  const paymentRequestId = extractHitpayCompletedRequestId(parsedPayload);
  if (!paymentRequestId) {
    return NextResponse.json({ received: true, fulfilled: false });
  }

  const service = createServiceSupabaseClient();
  const { data, error } = await service
    .rpc("fulfill_billing_order_by_provider_ref", {
      p_provider_ref: paymentRequestId,
    })
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fulfill HitPay order." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    received: true,
    fulfilled: Boolean(data),
    paymentRequestId,
  });
}
