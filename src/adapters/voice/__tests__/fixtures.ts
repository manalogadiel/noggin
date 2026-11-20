/// <reference types="vite/client" />
import { vi } from "vitest";
import type { SpeechToText, TextToSpeech } from "@/core/application/ports";

export const groqUrl = "https://api.groq.com/openai/v1/audio/transcriptions";
export const whisperCppUrl = "http://127.0.0.1:8765";
export const transcript = "The learner describes a SYN packet.";
export const answer = "The server replies with SYN-ACK.";
export const reportedDuration = 12;
export const clip = {
  audio: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x10, 0x30]),
  mimeType: "audio/webm",
  durationSeconds: 4,
};
export const pcm = Buffer.from([0x00, 0x00, 0x34, 0x12, 0xcb, 0xed, 0xff, 0x7f]);
export const env = {
  GROQ_API_KEY: "fixture-groq-key",
  STT_MODEL: "fixture-stt-model",
  GEMINI_API_KEY: "AQ.fixture-gemini-key",
  TTS_MODEL: "fixture-tts-model",
};

export const fetchMock = vi.fn<typeof fetch>();

export function mockProviderEnv() {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.stubEnv("WHISPER_CPP_URL", undefined);
  vi.stubEnv("NODE_ENV", "test");
  fetchMock.mockReset().mockRejectedValue(new Error("Unexpected provider request"));
  vi.stubGlobal("fetch", fetchMock);
}

export function groqReply() {
  return Response.json({ text: transcript, duration: reportedDuration });
}

export function geminiReply() {
  return Response.json({
    candidates: [{
      content: {
        role: "model",
        parts: [{ inlineData: {
          mimeType: "audio/L16;codec=pcm;rate=24000",
          data: pcm.toString("base64"),
        } }],
      },
    }],
  });
}

export function providerRequest(index = 0) {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`No provider request at index ${index}`);
  return new Request(...call);
}

export async function loadEntry<T>(
  entries: Record<string, () => Promise<T>>,
  path: string,
): Promise<T> {
  const load = entries[path];
  if (!load) throw new Error(`Missing voice entry point: ${path}`);
  return load();
}

const groqModules = import.meta.glob<{
  createGroqWhisperStt(): SpeechToText;
}>("../groq-whisper-stt.ts");

const geminiModules = import.meta.glob<{
  createGeminiTts(): TextToSpeech;
}>("../gemini-tts.ts");

export async function groqStt() {
  const { createGroqWhisperStt } = await loadEntry(groqModules, "../groq-whisper-stt.ts");
  return createGroqWhisperStt();
}

export async function geminiTts() {
  const { createGeminiTts } = await loadEntry(geminiModules, "../gemini-tts.ts");
  return createGeminiTts();
}
