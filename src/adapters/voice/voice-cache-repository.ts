import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SynthesizedAudio,
  VoiceCacheRepository,
} from "@/core/application/ports";

export const VOICE_CACHE_BUCKET = "voice-cache";
const VOICE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

export function computeVoiceCacheHash(model: string, text: string): string {
  return createHash("sha256")
    .update(model + text)
    .digest("hex");
}

function normalizeHash(key: string): string {
  if (SHA256_HEX_REGEX.test(key)) {
    return key;
  }
  return createHash("sha256").update(key).digest("hex");
}

function storagePathForHash(hash: string): string {
  return `${hash}.wav`;
}

function toArrayBufferCopy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export interface CreateSupabaseVoiceCacheOptions {
  service: SupabaseClient;
  model?: string;
}

export function createSupabaseVoiceCache(
  options: CreateSupabaseVoiceCacheOptions,
): VoiceCacheRepository {
  const { service, model } = options;

  return {
    async get(key: string): Promise<SynthesizedAudio | null> {
      const storage = service.storage;
      if (!storage || typeof storage.from !== "function") {
        return null;
      }

      const hash = normalizeHash(key);
      const path = storagePathForHash(hash);

      try {
        const { data, error } = await storage
          .from(VOICE_CACHE_BUCKET)
          .download(path);

        if (error || !data) {
          return null;
        }

        const buffer = await data.arrayBuffer();
        if (buffer.byteLength === 0) {
          return null;
        }

        return {
          audio: new Uint8Array(buffer),
          mimeType: data.type || "audio/wav",
        };
      } catch {
        return null;
      }
    },

    async put(key: string, synthesized: SynthesizedAudio): Promise<void> {
      const storage = service.storage;
      if (!storage || typeof storage.from !== "function") {
        return;
      }

      const hash = normalizeHash(key);
      const path = storagePathForHash(hash);

      try {
        const { error } = await storage
          .from(VOICE_CACHE_BUCKET)
          .upload(path, toArrayBufferCopy(synthesized.audio), {
            contentType: synthesized.mimeType,
            upsert: true,
          });

        if (error) {
          return;
        }
      } catch {
        return;
      }

      if (typeof service.from === "function") {
        try {
          const expiresAt = new Date(
            Date.now() + VOICE_CACHE_TTL_MS,
          ).toISOString();
          await service.from("voice_cache").upsert(
            {
              text_hash: hash,
              storage_path: path,
              voice_model: model ?? null,
              expires_at: expiresAt,
            },
            { onConflict: "text_hash" },
          );
        } catch {
          // Best-effort metadata record; cached object is already stored.
        }
      }
    },
  };
}
