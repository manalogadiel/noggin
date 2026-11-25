import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/composition/container";

export const dynamic = "force-dynamic";

const roomIdSchema = z.enum([
  "day",
  "minimal",
  "greenhouse",
  "treehouse",
  "night",
]);
const skinPackIdSchema = z.enum(["pastel", "neon", "dark", "sunset"]);
const coverStyleSchema = z.enum([
  "sage",
  "honey",
  "gingham",
  "berry",
  "denim",
  "forest",
]);

const patchSchema = z
  .object({
    activeRoomBg: roomIdSchema.optional(),
    activeSkinPack: skinPackIdSchema.optional(),
    equippedSlots: z
      .array(z.string().max(40).nullable())
      .max(4)
      .optional(),
    notebookPrefs: z
      .record(
        z.string().min(1).max(80),
        z
          .object({
            maxPages: z.number().int().min(1).max(60).optional(),
            cover: coverStyleSchema.optional(),
            title: z.string().trim().max(40).optional(),
          })
          .strict(),
      )
      .optional(),
    audioPrefs: z
      .object({
        music: z.number().min(0).max(100),
        sfx: z.number().min(0).max(100),
        voice: z.number().min(0).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();

export async function GET(): Promise<Response> {
  let container;
  try {
    container = await createContainer();
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }

  const result = await container.getPlayerEconomy();
  if (result.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    state: result.state,
    ledger: result.ledger,
  });
}

export async function PATCH(request: Request): Promise<Response> {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid economy preferences payload." },
      { status: 400 },
    );
  }

  const result = await container.updatePlayerPreferences(parsed.data);
  if (result.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  return NextResponse.json({ state: result.state });
}
