import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import type { SpeakAnswerInput, SpeakAnswerResult } from "@/core/application/use-cases/speak-answer";
import type { TranscribeLessonResult } from "@/core/application/use-cases/transcribe-lesson";
import type { TranscribeInput } from "@/core/application/ports";
import {
  answer,
  clip,
  env,
  fetchMock,
  geminiReply,
  groqUrl,
  loadEntry,
  mockProviderEnv,
  providerRequest,
  transcript,
  whisperCppUrl,
} from "./fixtures";

const {
  createServerSupabaseClient,
  createServiceSupabaseClient,
  createSupabaseRepositories,
  createLlmAdapters,
} = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  createServiceSupabaseClient: vi.fn(),
  createSupabaseRepositories: vi.fn(),
  createLlmAdapters: vi.fn(),
}));

vi.mock("@/adapters/supabase/server-client", () => ({ createServerSupabaseClient }));
vi.mock("@/adapters/supabase/service-client", () => ({ createServiceSupabaseClient }));
vi.mock("@/adapters/supabase/repositories", () => ({ createSupabaseRepositories }));
vi.mock("@/adapters/ai/fallback-llm", () => ({ createLlmAdapters }));
vi.mock("server-only", () => ({}));

type VoiceContainer = {
  transcribeLesson(input: TranscribeInput): Promise<TranscribeLessonResult>;
  speakAnswer(input: SpeakAnswerInput): Promise<SpeakAnswerResult>;
};
const containerPath = "../../../composition/container.ts";
const modules = import.meta.glob<{
  createContainer(): Promise<VoiceContainer>;
}>("../../../composition/container.ts");

async function composeVoice() {
  const { createContainer } = await loadEntry(modules, containerPath);
  return createContainer();
}

const userId = "057a6375-41e5-4d2c-8b60-27d4051108d8";
const messageId = "15d80297-3da4-49e9-8004-193a33601c31";
const nogId = "315ce8f0-cc27-47cd-9396-c43c03c3969c";
const storage = new Map<string, Blob>();
const upload = vi.fn(async (path: string, body: BlobPart) => {
  storage.set(path, new Blob([body], { type: "audio/wav" }));
  return { data: { path }, error: null };
});
const download = vi.fn(async (path: string) => {
  const data = storage.get(path);
  return data
    ? { data, error: null }
    : { data: null, error: { message: "Object not found", statusCode: "404" } };
});
const serviceBucket = vi.fn(() => ({ upload, download }));
const sessionBucket = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockProviderEnv();
  storage.clear();
  const config = {
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture-supabase.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
    LLM_PROVIDER: "openai-compatible",
    LLM_BASE_URL: "https://fixture-llm.example.test/v1",
    LLM_API_KEY: "fixture-llm-key",
    LLM_MODEL: "fixture-llm-model",
  };
  for (const [name, value] of Object.entries(config)) vi.stubEnv(name, value);

  const { deps } = createInMemoryPorts({ userId });
  const findOwnedMessage = vi.fn<typeof deps.notebook.findOwnedMessage>(async (owner, id) =>
    owner === userId && id === messageId
      ? { id, nogId, role: "nog", kind: "answer", body: answer }
      : null,
  );
  createSupabaseRepositories.mockReturnValue({
    ...deps,
    notebook: { ...deps.notebook, findOwnedMessage },
    voiceCache: undefined,
    profiles: { findById: vi.fn(async () => ({ id: userId, grillMode: "gentle" })) },
    appConfig: { getFeatures: vi.fn(async () => ({ speech_mimicry: false })) },
  });
  const getUser = vi.fn(async () => ({ data: { user: { id: userId } }, error: null }));
  createServerSupabaseClient.mockResolvedValue({ auth: { getUser }, storage: { from: sessionBucket } });
  createServiceSupabaseClient.mockReturnValue({ storage: { from: serviceBucket } });
  createLlmAdapters.mockReturnValue({ listener: deps.listener, brain: deps.brain, grader: deps.grader });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([
  ["development", whisperCppUrl, true],
  ["development", undefined, false],
  ["production", whisperCppUrl, false],
] as const)("selects the whisper.cpp fallback for environment %s and URL %s: %s", async (nodeEnv, url, useFallback) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("WHISPER_CPP_URL", url);
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ text: transcript }));
  const container = await composeVoice();

  const result = await container.transcribeLesson(clip);

  expect(result).toMatchObject(useFallback ? { status: "ok", text: transcript } : { status: "provider_error" });
  expect(fetchMock).toHaveBeenCalledTimes(useFallback ? 2 : 1);
  expect(providerRequest().url).toBe(groqUrl);
  if (useFallback) expect(new URL(providerRequest(1).url).origin).toBe(whisperCppUrl);
});

it("reads repeat audio from the service voice-cache bucket by model and text hash", async () => {
  fetchMock.mockResolvedValueOnce(geminiReply());
  const input = { source: "nog_message", id: messageId } as const;

  const first = await (await composeVoice()).speakAnswer(input);
  const repeat = await (await composeVoice()).speakAnswer(input);

  expect(first).toMatchObject({ status: "ok", mimeType: "audio/wav", cached: false });
  expect(repeat).toMatchObject({ status: "ok", mimeType: "audio/wav", cached: true });
  if (first.status !== "ok" || repeat.status !== "ok") throw new Error("Expected playable audio");
  expect(Buffer.from(repeat.audio)).toEqual(Buffer.from(first.audio));
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(serviceBucket).toHaveBeenCalledWith("voice-cache");
  expect(sessionBucket).not.toHaveBeenCalled();
  expect(upload).toHaveBeenCalledOnce();
  const path = upload.mock.calls[0][0];
  const hash = createHash("sha256").update(env.TTS_MODEL + answer).digest("hex");
  expect(path).toContain(hash);
  expect(download).toHaveBeenLastCalledWith(path);
  expect(download.mock.invocationCallOrder.at(-1)).toBeGreaterThan(upload.mock.invocationCallOrder[0]);
});
