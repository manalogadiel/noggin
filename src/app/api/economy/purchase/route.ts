import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/composition/container";

export const dynamic = "force-dynamic";

const purchaseSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("shop"),
      kind: z.enum(["room", "skin_pack", "accessory", "streak_restore"]),
      itemId: z.string().min(1).max(60),
    })
    .strict(),
  z
    .object({
      action: z.literal("expand_pages"),
      bookId: z.string().min(1).max(80),
      addPages: z.number().int().positive().max(60),
    })
    .strict(),
  z
    .object({
      action: z.literal("claim_task"),
      taskId: z.string().min(1).max(60),
    })
    .strict(),
  z
    .object({
      action: z.literal("use_streak_restore"),
    })
    .strict(),
]);

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

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid purchase payload." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.action === "shop") {
    const result = await container.purchaseShopItem({
      kind: input.kind,
      itemId: input.itemId,
    });
    if (result.status === "unauthenticated") {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    if (result.status === "rejected") {
      return NextResponse.json(
        { code: result.code, error: result.error },
        { status: 400 },
      );
    }
    return NextResponse.json({ state: result.state });
  }

  if (input.action === "expand_pages") {
    const result = await container.expandNotebookPages({
      bookId: input.bookId,
      addPages: input.addPages,
    });
    if (result.status === "unauthenticated") {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    if (result.status === "rejected") {
      return NextResponse.json(
        { code: result.code, error: result.error },
        { status: 400 },
      );
    }
    return NextResponse.json({ state: result.state });
  }

  if (input.action === "claim_task") {
    const result = await container.claimDailyTask({ taskId: input.taskId });
    if (result.status === "unauthenticated") {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    if (result.status === "rejected") {
      return NextResponse.json(
        { code: result.code, error: result.error },
        { status: 400 },
      );
    }
    return NextResponse.json({
      state: result.state,
      rewardCoins: result.rewardCoins,
      rewardXp: result.rewardXp,
    });
  }

  const result = await container.useStreakRestore();
  if (result.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (result.status === "rejected") {
    return NextResponse.json(
      { code: result.code, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ state: result.state });
}
