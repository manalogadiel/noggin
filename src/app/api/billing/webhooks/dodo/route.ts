import { NextResponse } from "next/server";
import {
  extractDodoFulfillmentRef,
  verifyDodoWebhookSignature,
} from "@/adapters/billing/dodo-payment-gateway";
import { createServiceSupabaseClient } from "@/adapters/supabase/service-client";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  const webhookSecret =
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET?.trim() ||
    process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() ||
    "";

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Dodo Payments webhook secret not configured." },
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
    !verifyDodoWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature,
      webhookSecret,
    })
  ) {
    return NextResponse.json(
      { error: "Invalid Dodo Payments webhook signature." },
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

  const ref = extractDodoFulfillmentRef(eventBody);
  if (!ref) {
    return NextResponse.json({ received: true, fulfilled: false });
  }

  const service = createServiceSupabaseClient();
  let fulfilledOrder: unknown = null;

  if (ref.checkoutSessionId) {
    const { data, error } = await service
      .rpc("fulfill_billing_order_by_provider_ref", {
        p_provider_ref: ref.checkoutSessionId,
      })
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fulfill Dodo Payments order." },
        { status: 500 },
      );
    }
    fulfilledOrder = data;
  }

  if (!fulfilledOrder && ref.orderId && UUID_REGEX.test(ref.orderId)) {
    const { data: orderRow, error: lookupError } = await service
      .from("billing_orders")
      .select("provider_ref")
      .eq("id", ref.orderId)
      .eq("provider", "dodo")
      .maybeSingle<{ provider_ref: string | null }>();

    if (lookupError) {
      return NextResponse.json(
        { error: "Failed to look up Dodo Payments order." },
        { status: 500 },
      );
    }

    const fallbackRef = orderRow?.provider_ref?.trim();
    if (fallbackRef) {
      const { data, error } = await service
        .rpc("fulfill_billing_order_by_provider_ref", {
          p_provider_ref: fallbackRef,
        })
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Failed to fulfill Dodo Payments order." },
          { status: 500 },
        );
      }
      fulfilledOrder = data;
    }
  }

  return NextResponse.json({
    received: true,
    fulfilled: Boolean(fulfilledOrder),
    eventType: ref.eventType,
    checkoutSessionId: ref.checkoutSessionId,
    orderId: ref.orderId,
  });
}
