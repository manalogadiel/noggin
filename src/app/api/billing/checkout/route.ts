import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/composition/container";
import { findSalesProduct } from "@/core/domain/billing";

export const dynamic = "force-dynamic";

const checkoutSchema = z
  .object({
    productCode: z.string().trim().min(1).max(60),
    idempotencyKey: z.string().trim().min(4).max(120),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  let container;
  try {
    container = await createContainer();
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout payload." },
      { status: 400 },
    );
  }

  const product = findSalesProduct(parsed.data.productCode);
  if (!product) {
    return NextResponse.json(
      { code: "unknown_product", error: "Unknown or inactive product." },
      { status: 400 },
    );
  }

  const result =
    product.kind === "subscription"
      ? await container.subscribeNogginPlus({
          productCode: product.code,
          idempotencyKey: parsed.data.idempotencyKey,
        })
      : await container.checkoutCoinPack({
          productCode: product.code,
          idempotencyKey: parsed.data.idempotencyKey,
        });

  if (result.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (result.status === "invalid") {
    return NextResponse.json(
      { code: result.code, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    order: result.order,
    coinsAdded: result.coinsAdded,
    planCode: result.planCode,
  });
}
