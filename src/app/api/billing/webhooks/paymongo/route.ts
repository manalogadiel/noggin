import { NextResponse } from "next/server";
import {
  extractPaymongoPaidSessionId,
  verifyPaymongoWebhookSignature,
} from "@/adapters/billing/paymongo-payment-gateway";
import { createServiceSupabaseClient } from "@/adapters/supabase/service-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "PayMongo webhook secret not configured." },
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

  const signatureHeader = request.headers.get("paymongo-signature");
  const isLive = (process.env.PAYMONGO_SECRET_KEY ?? "")
    .trim()
    .startsWith("sk_live_");

  if (
    !verifyPaymongoWebhookSignature({
      rawBody,
      signatureHeader,
      webhookSecret,
      isLive,
    })
  ) {
    return NextResponse.json(
      { error: "Invalid PayMongo signature." },
      { status: 401 },
    );
  }

  let eventBody: unknown;
  try {
    eventBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const sessionId = extractPaymongoPaidSessionId(eventBody);
  if (!sessionId) {
    return NextResponse.json({ received: true, fulfilled: false });
  }

  const service = createServiceSupabaseClient();
  const { data, error } = await service
    .rpc("fulfill_billing_order_by_provider_ref", {
      p_provider_ref: sessionId,
    })
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fulfill PayMongo order." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    received: true,
    fulfilled: Boolean(data),
    sessionId,
  });
}
