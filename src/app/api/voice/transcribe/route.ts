import { NextResponse } from "next/server";
import { createContainer } from "@/composition/container";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_SECONDS,
} from "@/core/application/use-cases/transcribe-lesson";

export const dynamic = "force-dynamic";

const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

function normalizeMimeType(raw: string): string {
  return raw.split(";")[0]?.trim().toLowerCase() ?? "";
}

async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const stream = request.body;
  if (!stream) {
    return new Uint8Array(0);
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
  return combined;
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

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data request." },
      { status: 400 },
    );
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength !== null) {
    const parsedLength = Number(rawContentLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Audio exceeds the 2 MB limit." },
        { status: 413 },
      );
    }
  }

  let rawBody: Uint8Array<ArrayBuffer> | null;
  try {
    rawBody = await readBoundedBody(request, MAX_REQUEST_BYTES);
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body." },
      { status: 400 },
    );
  }

  if (rawBody === null) {
    return NextResponse.json(
      { error: "Audio exceeds the 2 MB limit." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await new Response(rawBody, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    return NextResponse.json(
      { error: "Malformed multipart form data." },
      { status: 400 },
    );
  }

  const audioField = formData.get("audio");
  if (!(audioField instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing audio file." },
      { status: 400 },
    );
  }

  const audioBytes = new Uint8Array(await audioField.arrayBuffer());
  if (audioBytes.byteLength === 0) {
    return NextResponse.json(
      { error: "Audio payload is empty." },
      { status: 400 },
    );
  }

  if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio exceeds the 2 MB limit." },
      { status: 413 },
    );
  }

  const mimeType = normalizeMimeType(audioField.type);
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported audio media type." },
      { status: 415 },
    );
  }

  const rawDuration = formData.get("durationSeconds");
  if (typeof rawDuration !== "string" || rawDuration.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing durationSeconds." },
      { status: 400 },
    );
  }

  const durationSeconds = Number(rawDuration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return NextResponse.json(
      { error: "Invalid durationSeconds." },
      { status: 400 },
    );
  }

  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    return NextResponse.json(
      { error: "Audio exceeds the 60-second limit." },
      { status: 413 },
    );
  }

  try {
    const result = await container.transcribeLesson({
      audio: audioBytes,
      mimeType,
      durationSeconds,
    });

    switch (result.status) {
      case "ok":
        return NextResponse.json({ text: result.text }, { status: 200 });
      case "unauthenticated":
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 },
        );
      case "invalid_audio":
        return NextResponse.json(
          { error: "Invalid audio payload." },
          { status: 400 },
        );
      case "payload_too_large":
        return NextResponse.json(
          { error: "Audio exceeds the 2 MB or 60-second limit." },
          { status: 413 },
        );
      case "tired_for_today":
        return NextResponse.json({ state: "tired" }, { status: 429 });
      case "provider_error":
        return NextResponse.json({ state: "unavailable" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }
}
