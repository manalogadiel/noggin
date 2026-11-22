import "server-only";
import { z } from "zod";
import type { SpeechToText, TranscribeInput } from "@/core/application/ports";

const GROQ_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const REQUEST_TIMEOUT_MS = 20_000;

const MIME_TO_FILENAME: Record<string, string> = {
  "audio/webm": "audio.webm",
  "audio/ogg": "audio.ogg",
  "audio/mp4": "audio.mp4",
  "audio/mpeg": "audio.mp3",
  "audio/wav": "audio.wav",
};

const groqTranscriptionResponseSchema = z.object({
  text: z.string(),
  duration: z.number().finite().nonnegative().optional(),
});

export interface GroqTranscriptionResult {
  text: string;
  durationSeconds?: number;
}

export interface GroqWhisperStt extends SpeechToText {
  transcribe(input: TranscribeInput): Promise<GroqTranscriptionResult>;
}

export class GroqSttConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqSttConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GroqSttProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GroqSttProviderError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function readNonEmptyEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
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

export function createGroqWhisperStt(): GroqWhisperStt {
  const apiKey = readNonEmptyEnv("GROQ_API_KEY");
  const model = readNonEmptyEnv("STT_MODEL");

  const missing: string[] = [];
  if (!apiKey) missing.push("GROQ_API_KEY");
  if (!model) missing.push("STT_MODEL");
  if (missing.length > 0) {
    throw new GroqSttConfigError(
      `Missing required speech transcription configuration: ${missing.join(", ")}`,
    );
  }

  return {
    async transcribe(input: TranscribeInput): Promise<GroqTranscriptionResult> {
      const form = new FormData();
      const file = new File(
        [toArrayBufferCopy(input.audio)],
        fileNameForMimeType(input.mimeType),
        { type: input.mimeType },
      );
      form.set("file", file);
      form.set("model", model!);
      form.set("response_format", "verbose_json");
      const hint = input.hint?.trim();
      if (hint) {
        form.set("prompt", hint);
      }

      let response: Response;
      try {
        response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey!}`,
          },
          body: form,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new GroqSttProviderError(
          "Speech transcription provider request failed.",
        );
      }

      if (!response.ok) {
        throw new GroqSttProviderError(
          `Speech transcription provider returned HTTP ${response.status}.`,
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new GroqSttProviderError(
          "Speech transcription provider returned invalid JSON.",
        );
      }

      const parsed = groqTranscriptionResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new GroqSttProviderError(
          "Speech transcription provider returned an unexpected response shape.",
        );
      }

      const result: GroqTranscriptionResult = {
        text: parsed.data.text.trim(),
      };
      if (parsed.data.duration !== undefined) {
        result.durationSeconds = parsed.data.duration;
      }
      return result;
    },
  };
}
