import "server-only";
import { z } from "zod";
import type {
  SpeakInput,
  SynthesizedAudio,
  TextToSpeech,
} from "@/core/application/ports";

const GEMINI_API_ORIGIN = "https://generativelanguage.googleapis.com";
const DEFAULT_TTS_VOICE = "Puck";
const DEFAULT_PCM_SAMPLE_RATE = 24_000;
const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;
const WAV_HEADER_BYTES = 44;
const REQUEST_TIMEOUT_MS = 25_000;

const inlineDataSchema = z.object({
  mimeType: z.string().optional(),
  mime_type: z.string().optional(),
  data: z.string().min(1),
});

const partSchema = z.object({
  inlineData: inlineDataSchema.optional(),
  inline_data: inlineDataSchema.optional(),
});

const geminiTtsResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(partSchema),
          })
          .optional(),
      }),
    )
    .min(1),
});

export class GeminiTtsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiTtsConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GeminiTtsProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GeminiTtsProviderError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function trimNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseSampleRate(mimeType: string | undefined): number {
  if (!mimeType) {
    return DEFAULT_PCM_SAMPLE_RATE;
  }
  const match = /\brate=(\d+)\b/i.exec(mimeType);
  if (!match) {
    return DEFAULT_PCM_SAMPLE_RATE;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PCM_SAMPLE_RATE;
}

function isWavPayload(mimeType: string | undefined, bytes: Uint8Array): boolean {
  if (!mimeType || !/^audio\/(?:x-)?wav\b/i.test(mimeType)) {
    return false;
  }
  return (
    bytes.byteLength >= WAV_HEADER_BYTES &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  );
}

export function wrapPcmAsWav(
  pcm: Uint8Array,
  sampleRate = DEFAULT_PCM_SAMPLE_RATE,
): Uint8Array<ArrayBuffer> {
  const byteRate = sampleRate * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
  const blockAlign = PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  // RIFF chunk descriptor
  out[0] = 0x52; // R
  out[1] = 0x49; // I
  out[2] = 0x46; // F
  out[3] = 0x46; // F
  view.setUint32(4, 36 + pcm.byteLength, true);

  // WAVE format + fmt subchunk header
  out[8] = 0x57; // W
  out[9] = 0x41; // A
  out[10] = 0x56; // V
  out[11] = 0x45; // E
  out[12] = 0x66; // f
  out[13] = 0x6d; // m
  out[14] = 0x74; // t
  out[15] = 0x20; // (space)
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, PCM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, PCM_BITS_PER_SAMPLE, true);

  // data subchunk header
  out[36] = 0x64; // d
  out[37] = 0x61; // a
  out[38] = 0x74; // t
  out[39] = 0x61; // a
  view.setUint32(40, pcm.byteLength, true);
  out.set(pcm, WAV_HEADER_BYTES);

  return out;
}

export function resolveGeminiTtsVoice(): string {
  return trimNonEmpty(process.env.TTS_VOICE) ?? DEFAULT_TTS_VOICE;
}

export function createGeminiTts(): TextToSpeech {
  const apiKey = trimNonEmpty(process.env.GEMINI_API_KEY);
  const model = trimNonEmpty(process.env.TTS_MODEL);
  const voiceName = resolveGeminiTtsVoice();

  if (!apiKey && !model) {
    throw new GeminiTtsConfigError(
      "Missing required speech synthesis configuration: GEMINI_API_KEY, TTS_MODEL",
    );
  }
  if (!apiKey) {
    throw new GeminiTtsConfigError(
      "Missing required speech synthesis configuration: GEMINI_API_KEY",
    );
  }
  if (!model) {
    throw new GeminiTtsConfigError(
      "Missing required speech synthesis configuration: TTS_MODEL",
    );
  }

  const endpointUrl = `${GEMINI_API_ORIGIN}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  return {
    async speak(input: SpeakInput): Promise<SynthesizedAudio> {
      const selectedVoice = trimNonEmpty(input.voice) ?? voiceName;
      let response: Response;
      try {
        response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey!,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: input.text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: selectedVoice,
                  },
                },
              },
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new GeminiTtsProviderError(
          "Speech synthesis provider request failed.",
        );
      }

      if (!response.ok) {
        throw new GeminiTtsProviderError(
          `Speech synthesis provider returned HTTP ${response.status}.`,
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new GeminiTtsProviderError(
          "Speech synthesis provider returned invalid JSON.",
        );
      }

      const parsed = geminiTtsResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new GeminiTtsProviderError(
          "Speech synthesis provider returned an unexpected response shape.",
        );
      }

      let inlineData: z.infer<typeof inlineDataSchema> | undefined;
      for (const candidate of parsed.data.candidates) {
        for (const part of candidate.content?.parts ?? []) {
          const found = part.inlineData ?? part.inline_data;
          if (found) {
            inlineData = found;
            break;
          }
        }
        if (inlineData) {
          break;
        }
      }

      if (!inlineData) {
        throw new GeminiTtsProviderError(
          "Speech synthesis provider returned no audio payload.",
        );
      }

      const rawBuffer = Buffer.from(inlineData.data, "base64");
      if (rawBuffer.byteLength === 0) {
        throw new GeminiTtsProviderError(
          "Speech synthesis provider returned empty audio data.",
        );
      }

      const rawBytes = new Uint8Array(
        rawBuffer.buffer,
        rawBuffer.byteOffset,
        rawBuffer.byteLength,
      );
      const inlineMime = inlineData.mimeType ?? inlineData.mime_type;

      if (isWavPayload(inlineMime, rawBytes)) {
        const wavCopy = new Uint8Array(rawBytes.byteLength);
        wavCopy.set(rawBytes);
        return {
          audio: wavCopy,
          mimeType: "audio/wav",
        };
      }

      const sampleRate = parseSampleRate(inlineMime);
      return {
        audio: wrapPcmAsWav(rawBytes, sampleRate),
        mimeType: "audio/wav",
      };
    },
  };
}
