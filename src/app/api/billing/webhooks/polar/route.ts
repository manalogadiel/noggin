import { NextResponse } from "next/server";
import {
  extractPolarPaidCheckoutId,
  verifyPolarWebhookSignature,
} from "@/adapters/billing/polar-payment-gateway";
import { createServiceSupabaseClient } from "@/adapters/supabase/service-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Polar webhook secret not configured." },
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

  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");

  if (
    !verifyPolarWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature,
      webhookSecret,
    })
  ) {
    return NextResponse.json(
      { error: "Invalid Polar webhook signature." },
      { status: 401 },
    );
  }

  let eventBody: unknown;
  try {
    eventBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const checkoutId = extractPolarPaidCheckoutId(eventBody);
  if (!checkoutId) {
    return NextResponse.json({ received: true, fulfilled: false });
  }

  const service = createServiceSupabaseClient();
  const { data, error } = await service
    .rpc("fulfill_billing_order_by_provider_ref", {
      p_provider_ref: checkoutId,
    })
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fulfill Polar order." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    received: true,
    fulfilled: Boolean(data),
    checkoutId,
  });
}
