import { inspect } from "node:util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SpeechToText } from "@/core/application/ports";
import {
  answer,
  clip,
  env,
  fetchMock,
  geminiReply,
  geminiTts,
  groqReply,
  groqStt,
  groqUrl,
  loadEntry,
  mockProviderEnv,
  pcm,
  providerRequest,
  reportedDuration,
  transcript,
  whisperCppUrl,
} from "./fixtures";

vi.mock("server-only", () => ({}));

const whisperModules = import.meta.glob<{
  createWhisperCppStt(): SpeechToText;
}>("../whisper-cpp-stt.ts");

beforeEach(mockProviderEnv);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("sends multipart audio to Groq and preserves its reported duration", async () => {
  fetchMock.mockResolvedValueOnce(groqReply());
  const stt = await groqStt();

  await expect(stt.transcribe(clip)).resolves.toMatchObject({
    text: transcript,
    durationSeconds: reportedDuration,
  });

  expect(fetchMock).toHaveBeenCalledOnce();
  const request = providerRequest();
  expect(request.url).toBe(groqUrl);
  expect(request.method).toBe("POST");
  expect(request.headers.get("authorization")).toBe(`Bearer ${env.GROQ_API_KEY}`);
  const form = await request.formData();
  expect(form.get("model")).toBe(env.STT_MODEL);
  expect(form.get("response_format")).toBe("verbose_json");
  const upload = form.get("file");
  expect(upload).toBeInstanceOf(File);
  if (!(upload instanceof File)) throw new Error("Expected a Groq audio file");
  expect(upload.type).toBe(clip.mimeType);
  expect(new Uint8Array(await upload.arrayBuffer())).toEqual(clip.audio);
});

it("posts audio to the configured local whisper.cpp server without provider credentials", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("WHISPER_CPP_URL", whisperCppUrl);
  fetchMock.mockResolvedValueOnce(Response.json({ text: transcript }));
  const { createWhisperCppStt } = await loadEntry(whisperModules, "../whisper-cpp-stt.ts");

  await expect(createWhisperCppStt().transcribe(clip)).resolves.toMatchObject({ text: transcript });

  expect(fetchMock).toHaveBeenCalledOnce();
  const request = providerRequest();
  expect(new URL(request.url).origin).toBe(whisperCppUrl);
  expect(request.method).toBe("POST");
  expect(request.headers.has("authorization")).toBe(false);
  expect(request.headers.has("x-goog-api-key")).toBe(false);
  const upload = (await request.formData()).get("file");
  expect(upload).toBeInstanceOf(File);
  if (!(upload instanceof File)) throw new Error("Expected a whisper.cpp audio file");
  expect(new Uint8Array(await upload.arrayBuffer())).toEqual(clip.audio);
});

it("requests Gemini audio with x-goog-api-key and wraps the 24 kHz PCM samples in WAV", async () => {
  fetchMock.mockResolvedValueOnce(geminiReply());
  const tts = await geminiTts();

  const result = await tts.speak({ text: answer });

  expect(fetchMock).toHaveBeenCalledOnce();
  const request = providerRequest();
  const url = new URL(request.url);
  expect(url.origin).toBe("https://generativelanguage.googleapis.com");
  expect(url.pathname).toMatch(new RegExp(`/models/${env.TTS_MODEL}:generateContent$`));
  expect(request.method).toBe("POST");
  expect(request.headers.get("x-goog-api-key")).toBe(env.GEMINI_API_KEY);
  expect(request.headers.has("authorization")).toBe(false);
  expect(url.href).not.toContain(env.GEMINI_API_KEY);
  await expect(request.json()).resolves.toMatchObject({
    contents: [{ parts: [{ text: expect.stringContaining(answer) }] }],
    generationConfig: { responseModalities: ["AUDIO"] },
  });

  expect(result.mimeType).toBe("audio/wav");
  const wav = Buffer.from(result.audio);
  expect(wav.length).toBe(44 + pcm.length);
  expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
  expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  expect(wav.toString("ascii", 8, 16)).toBe("WAVEfmt ");
  expect(wav.readUInt32LE(16)).toBe(16);
  expect(wav.readUInt16LE(20)).toBe(1);
  expect(wav.readUInt16LE(22)).toBe(1);
  expect(wav.readUInt32LE(24)).toBe(24_000);
  expect(wav.readUInt32LE(28)).toBe(48_000);
  expect(wav.readUInt16LE(32)).toBe(2);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.toString("ascii", 36, 40)).toBe("data");
  expect(wav.readUInt32LE(40)).toBe(pcm.length);
  expect(wav.subarray(44)).toEqual(pcm);
});

it("keeps lesson audio, transcripts and spoken text out of provider diagnostics", async () => {
  const logs = (["log", "debug", "info", "warn", "error"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
  const stt = await groqStt();
  const tts = await geminiTts();
  const lessonAudio = Buffer.from("private-lesson-audio-samples");
  fetchMock.mockResolvedValueOnce(groqReply()).mockResolvedValueOnce(geminiReply())
    .mockResolvedValueOnce(new Response(transcript, { status: 502 }))
    .mockResolvedValueOnce(new Response(answer, { status: 503 }));

  await stt.transcribe({ ...clip, audio: lessonAudio });
  await tts.speak({ text: answer });
  const sttError = await stt.transcribe({ ...clip, audio: lessonAudio }).catch((error: unknown) => error);
  const ttsError = await tts.speak({ text: answer }).catch((error: unknown) => error);

  const diagnostics = inspect([sttError, ttsError, ...logs.flatMap((log) => log.mock.calls)], { depth: null });
  for (const value of [
    lessonAudio.toString(),
    lessonAudio.toString("base64"),
    inspect(lessonAudio),
    transcript,
    answer,
    env.GROQ_API_KEY,
    env.GEMINI_API_KEY,
  ]) {
    expect(diagnostics).not.toContain(value);
  }
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
