import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AttemptRepository,
  CurrentUser,
  NotebookRepository,
  SynthesizedAudio,
  TranscribeInput,
  UsageRepository,
  VoiceCacheRepository,
} from "@/core/application/ports";
import { speakAnswer, type SpeakAnswerInput } from "@/core/application/use-cases/speak-answer";
import { transcribeLesson } from "@/core/application/use-cases/transcribe-lesson";
import {
  answer,
  clip,
  fetchMock,
  geminiReply,
  geminiTts,
  groqReply,
  groqStt,
  mockProviderEnv,
  loadEntry,
  providerRequest,
  transcript,
} from "./fixtures";

const { createContainer, createServerSupabaseClient } = vi.hoisted(() => ({
  createContainer: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/composition/container", () => ({ createContainer }));
vi.mock("@/adapters/supabase/server-client", () => ({ createServerSupabaseClient }));
vi.mock("server-only", () => ({}));

const routes = import.meta.glob<{ POST(request: Request): Promise<Response> }>(
  "../../../app/api/voice/{transcribe,speak}/route.ts",
);

async function post(route: "transcribe" | "speak", request: Request) {
  const { POST } = await loadEntry(routes, `../../../app/api/voice/${route}/route.ts`);
  return POST(request);
}

const userId = "057a6375-41e5-4d2c-8b60-27d4051108d8";
const nogId = "315ce8f0-cc27-47cd-9396-c43c03c3969c";
const messageId = "15d80297-3da4-49e9-8004-193a33601c31";
const attemptId = "6b5d9b95-e7ab-4cc8-9e0b-7c0762be9d54";
const foreignId = "0112d804-0fb3-47fc-b757-a51503421418";
const foreignOwner = "4ab6c4ed-294f-48c1-89fd-ca87938eb25b";
const unknownId = "e7b8784e-c3f4-4a45-b42f-65fad579d89a";
const messageOwners = new Map([[messageId, userId], [foreignId, foreignOwner]]);
const attemptOwners = new Map([[attemptId, userId], [foreignId, foreignOwner]]);
const maxAudioBytes = 2 * 1024 * 1024;

const getUser = vi.fn();
const currentUser = { get: vi.fn<CurrentUser["get"]>() };
const usage = { consumeQuota: vi.fn<UsageRepository["consumeQuota"]>() };
const notebook = { findOwnedMessage: vi.fn<NotebookRepository["findOwnedMessage"]>() };
const attempts = { findOwned: vi.fn<AttemptRepository["findOwned"]>() };

const cacheEntries = new Map<string, SynthesizedAudio>();
const voiceCache = {
  get: vi.fn<VoiceCacheRepository["get"]>(),
  put: vi.fn<VoiceCacheRepository["put"]>(),
};

function transcribeRequest({
  audio = clip.audio,
  mimeType = clip.mimeType,
  duration = clip.durationSeconds,
  headers,
}: {
  audio?: Uint8Array<ArrayBuffer>;
  mimeType?: string;
  duration?: number;
  headers?: HeadersInit;
} = {}) {
  const form = new FormData();
  form.set("audio", new Blob([audio], { type: mimeType }), "lesson-clip");
  form.set("durationSeconds", String(duration));
  return new Request("https://noggin.example.test/api/voice/transcribe", {
    method: "POST",
    headers,
    body: form,
  });
}

function speakRequest(body: unknown) {
  return new Request("https://noggin.example.test/api/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockProviderEnv();
  cacheEntries.clear();
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  createServerSupabaseClient.mockResolvedValue({ auth: { getUser } });
  currentUser.get.mockImplementation(async () => (await getUser()).data.user);
  usage.consumeQuota.mockResolvedValue({ allowed: true, used: 0, cap: 600 });
  notebook.findOwnedMessage.mockImplementation(async (owner, id) =>
    owner === messageOwners.get(id)
      ? { id, nogId, role: "nog", kind: "answer", body: answer }
      : null,
  );
  attempts.findOwned.mockImplementation(async (owner, id) =>
    owner === attemptOwners.get(id) ? { id, nogId, nogAnswer: answer } : null,
  );
  voiceCache.get.mockImplementation(async (key) => cacheEntries.get(key) ?? null);
  voiceCache.put.mockImplementation(async (key, audio) => {
    cacheEntries.set(key, audio);
  });
  createContainer.mockResolvedValue({
    currentUser,
    transcribeLesson: (input: TranscribeInput) => transcribeLesson({
      currentUser,
      usage,
      speechToText: {
        transcribe: async (input) => (await groqStt()).transcribe(input),
      },
    }, input),
    speakAnswer: (input: SpeakAnswerInput) => speakAnswer({
      currentUser,
      notebook,
      attempts,
      voiceCache,
      usage,
      textToSpeech: {
        speak: async (input) => (await geminiTts()).speak(input),
      },
    }, input),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([
  ["transcribe", () => transcribeRequest()],
  ["speak", () => speakRequest({ messageId })],
] as const)("returns 401 from %s before reading the body without a session", async (route, request) => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  const body = request();
  const reads = [
    vi.spyOn(body, "body", "get"),
    vi.spyOn(body, "formData"),
    vi.spyOn(body, "json"),
    vi.spyOn(body, "arrayBuffer"),
    vi.spyOn(body, "blob"),
    vi.spyOn(body, "text"),
    vi.spyOn(body, "clone"),
  ];

  expect((await post(route, body)).status).toBe(401);
  for (const read of reads) expect(read).not.toHaveBeenCalled();
  expect(body.bodyUsed).toBe(false);
  expect(usage.consumeQuota).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

describe("POST /api/voice/transcribe", () => {
  it("returns 413 when actual audio bytes exceed 2 MiB despite a smaller Content-Length", async () => {
    const response = await post("transcribe", transcribeRequest({
      audio: new Uint8Array(maxAudioBytes + 1),
      headers: { "Content-Length": "1024" },
    }));

    expect(response.status).toBe(413);
    expect(usage.consumeQuota).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 413 for a declared duration of 61 seconds", async () => {
    expect((await post("transcribe", transcribeRequest({ duration: 61 }))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 415 for text/plain", async () => {
    expect((await post("transcribe", transcribeRequest({ mimeType: "text/plain" }))).status).toBe(415);
    expect(usage.consumeQuota).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"])(
    "accepts %s and responds with the transcript",
    async (mimeType) => {
      fetchMock.mockResolvedValueOnce(groqReply());

      const response = await post("transcribe", transcribeRequest({ mimeType }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ text: transcript });
      expect(usage.consumeQuota).toHaveBeenCalledWith(userId, "stt_seconds", clip.durationSeconds);
      expect(usage.consumeQuota).toHaveBeenCalledBefore(fetchMock);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("accepts exactly 2 MiB and 60 seconds", async () => {
    fetchMock.mockResolvedValueOnce(groqReply());
    const response = await post("transcribe", transcribeRequest({
      audio: new Uint8Array(maxAudioBytes),
      duration: 60,
    }));

    expect(response.status).toBe(200);
    expect(usage.consumeQuota).toHaveBeenCalledWith(userId, "stt_seconds", 60);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns 429 tired without calling the provider when the seconds cap is reached", async () => {
    usage.consumeQuota.mockResolvedValue({ allowed: false, used: 600, cap: 600 });

    const response = await post("transcribe", transcribeRequest());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ state: "tired" });
    expect(usage.consumeQuota).toHaveBeenCalledWith(userId, "stt_seconds", clip.durationSeconds);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 unavailable when Groq responds with a 5xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Upstream error", { status: 502 }));

    const response = await post("transcribe", transcribeRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ state: "unavailable" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("POST /api/voice/speak", () => {
  it("returns 400 for malformed JSON", async () => {
    const request = new Request("https://noggin.example.test/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"messageId":',
    });

    expect((await post("speak", request)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["free text", { text: "Say anything I ask." }],
    ["free text with a valid ID", { text: "Say anything I ask.", messageId }],
    ["both IDs", { messageId, attemptId }],
    ["no ID", {}],
    ["an invalid ID", { messageId: "not-an-id" }],
  ])("returns 400 for %s before looking up text or calling the provider", async (_name, body) => {
    expect((await post("speak", speakRequest(body))).status).toBe(400);
    expect(notebook.findOwnedMessage).not.toHaveBeenCalled();
    expect(attempts.findOwned).not.toHaveBeenCalled();
    expect(voiceCache.get).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["messageId", "attemptId"] as const)(
    "returns the same 404 for foreign and unknown %s values",
    async (field) => {
      const foreign = await post("speak", speakRequest({ [field]: foreignId }));
      const missing = await post("speak", speakRequest({ [field]: unknownId }));

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(await foreign.text()).toBe(await missing.text());
      const lookup = field === "messageId" ? notebook.findOwnedMessage : attempts.findOwned;
      expect(lookup).toHaveBeenCalledWith(userId, foreignId);
      expect(lookup).toHaveBeenCalledWith(userId, unknownId);
      expect(voiceCache.get).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("returns 429 tired without calling the provider when the character cap is reached", async () => {
    usage.consumeQuota.mockResolvedValue({ allowed: false, used: 600, cap: 600 });

    const response = await post("speak", speakRequest({ messageId }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ state: "tired" });
    expect(usage.consumeQuota).toHaveBeenCalledWith(userId, "tts_chars", answer.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the same WAV from the voice cache for repeat requests and matching saved answers", async () => {
    fetchMock.mockResolvedValueOnce(geminiReply());

    const first = await post("speak", speakRequest({ messageId }));
    const repeat = await post("speak", speakRequest({ messageId }));
    const fromAttempt = await post("speak", speakRequest({ attemptId }));

    for (const response of [first, repeat, fromAttempt]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/wav");
      expect(response.headers.get("cache-control")?.split(/\s*,\s*/).sort())
        .toEqual(["max-age=86400", "private"]);
    }
    const audio = Buffer.from(await first.arrayBuffer());
    expect(audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(Buffer.from(await repeat.arrayBuffer())).toEqual(audio);
    expect(Buffer.from(await fromAttempt.arrayBuffer())).toEqual(audio);
    expect(attempts.findOwned).toHaveBeenCalledWith(userId, attemptId);
    expect(notebook.findOwnedMessage).toHaveBeenCalledTimes(2);
    expect(voiceCache.get).toHaveBeenCalledTimes(3);
    expect(voiceCache.put).toHaveBeenCalledOnce();
    expect(usage.consumeQuota).toHaveBeenCalledWith(userId, "tts_chars", answer.length);
    expect(usage.consumeQuota).toHaveBeenCalledBefore(fetchMock);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = await providerRequest().text();
    expect(body).toContain(answer);
    expect(body).not.toContain(messageId);
  });

  it("returns 503 unavailable when Gemini responds with a 5xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Upstream error", { status: 503 }));

    const response = await post("speak", speakRequest({ attemptId }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ state: "unavailable" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(voiceCache.put).not.toHaveBeenCalled();
  });
});
