import "server-only";
import { z } from "zod";
import type { SpeechToText, TranscribeInput } from "@/core/application/ports";

const REQUEST_TIMEOUT_MS = 20_000;

const MIME_TO_FILENAME: Record<string, string> = {
  "audio/webm": "audio.webm",
  "audio/ogg": "audio.ogg",
  "audio/mp4": "audio.mp4",
  "audio/mpeg": "audio.mp3",
  "audio/wav": "audio.wav",
};

const localTranscriptionResponseSchema = z.object({
  text: z.string(),
  duration: z.number().finite().nonnegative().optional(),
});

export interface LocalTranscriptionResult {
  text: string;
  durationSeconds?: number;
}

export interface LocalWhisperStt extends SpeechToText {
  transcribe(input: TranscribeInput): Promise<LocalTranscriptionResult>;
}

export class LocalSttConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalSttConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LocalSttProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LocalSttProviderError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function trimNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveEndpointUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new LocalSttConfigError(
      "Invalid WHISPER_CPP_URL: must be a valid http(s) URL.",
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LocalSttConfigError(
      "Invalid WHISPER_CPP_URL: must use http or https.",
    );
  }
  if (parsed.pathname === "/" || parsed.pathname === "") {
    parsed.pathname = "/inference";
  }
  return parsed.toString();
}

function fileNameForMimeType(mimeType: string): string {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_FILENAME[normalized] ?? "audio.webm";
}

function toArrayBufferCopy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function isWhisperCppFallbackEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  const rawUrl = trimNonEmpty(process.env.WHISPER_CPP_URL);
  if (!rawUrl) {
    return false;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function createWhisperCppStt(): LocalWhisperStt {
  if (process.env.NODE_ENV !== "development") {
    throw new LocalSttConfigError(
      "Local speech transcription fallback is only allowed in development.",
    );
  }

  const rawUrl = trimNonEmpty(process.env.WHISPER_CPP_URL);
  if (!rawUrl) {
    throw new LocalSttConfigError(
      "Missing required local speech transcription configuration: WHISPER_CPP_URL",
    );
  }

  const endpointUrl = resolveEndpointUrl(rawUrl);

  return {
    async transcribe(input: TranscribeInput): Promise<LocalTranscriptionResult> {
      const form = new FormData();
      const file = new File(
        [toArrayBufferCopy(input.audio)],
        fileNameForMimeType(input.mimeType),
        { type: input.mimeType },
      );
      form.set("file", file);
      form.set("response_format", "json");

      let response: Response;
      try {
        response = await fetch(endpointUrl, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new LocalSttProviderError(
          "Local speech transcription request failed.",
        );
      }

      if (!response.ok) {
        throw new LocalSttProviderError(
          `Local speech transcription returned HTTP ${response.status}.`,
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new LocalSttProviderError(
          "Local speech transcription returned invalid JSON.",
        );
      }

      const parsed = localTranscriptionResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new LocalSttProviderError(
          "Local speech transcription returned an unexpected response shape.",
        );
      }

      const result: LocalTranscriptionResult = {
        text: parsed.data.text.trim(),
      };
      if (parsed.data.duration !== undefined) {
        result.durationSeconds = parsed.data.duration;
      }
      return result;
    },
  };
}
