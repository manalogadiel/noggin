import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/composition/container";
import type { SpeakAnswerInput } from "@/core/application/use-cases/speak-answer";

export const dynamic = "force-dynamic";

const MAX_JSON_BODY_BYTES = 4 * 1024;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const speakRequestSchema = z.union([
  z
    .object({
      messageId: z.string().regex(UUID_REGEX),
    })
    .strict(),
  z
    .object({
      attemptId: z.string().regex(UUID_REGEX),
    })
    .strict(),
]);

async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const stream = request.body;
  if (!stream) {
    return "";
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export async function POST(request: Request): Promise<Response> {
  let container;
  try {
    container = await createContainer();
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }

  const user = await container.currentUser.get();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let rawText: string | null;
  try {
    rawText = await readBoundedText(request, MAX_JSON_BODY_BYTES);
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body." },
      { status: 400 },
    );
  }

  if (rawText === null || rawText.trim().length === 0) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = speakRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide exactly one valid messageId or attemptId." },
      { status: 400 },
    );
  }

  const input: SpeakAnswerInput =
    "messageId" in parsed.data
      ? { source: "nog_message", id: parsed.data.messageId }
      : { source: "check_attempt", id: parsed.data.attemptId };

  try {
    const result = await container.speakAnswer(input);

    switch (result.status) {
      case "ok": {
        const audioBody = new Uint8Array(result.audio.byteLength);
        audioBody.set(result.audio);
        return new Response(audioBody, {
          status: 200,
          headers: {
            "Content-Type": result.mimeType,
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      case "unauthenticated":
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 },
        );
      case "invalid_id":
        return NextResponse.json(
          { error: "Provide exactly one valid messageId or attemptId." },
          { status: 400 },
        );
      case "not_found":
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      case "tired_for_today":
        return NextResponse.json({ state: "tired" }, { status: 429 });
      case "provider_error":
        return NextResponse.json({ state: "unavailable" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }
}
