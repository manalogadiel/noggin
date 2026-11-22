import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clip, fetchMock, groqReply, groqStt, mockProviderEnv, transcript } from "@/adapters/voice/__tests__/fixtures";
import { transcribeAudio } from "@/components/voice/voice-client";

const { createContainer, createServerSupabaseClient } = vi.hoisted(() => ({
  createContainer: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("@/composition/container", () => ({ createContainer }));
vi.mock("@/adapters/supabase/server-client", () => ({ createServerSupabaseClient }));
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Groq Whisper uses the topic as a vocabulary hint", () => {
  beforeEach(() => mockProviderEnv());

  async function sentForm(): Promise<FormData> {
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    return new Request(...call).formData();
  }

  it("sends the hint as the Whisper prompt", async () => {
    fetchMock.mockResolvedValueOnce(groqReply());
    const stt = await groqStt();
    await expect(stt.transcribe({ ...clip, hint: "TCP handshake" })).resolves.toMatchObject({ text: transcript });
    expect((await sentForm()).get("prompt")).toBe("TCP handshake");
  });

  it("sends no prompt without a hint", async () => {
    fetchMock.mockResolvedValueOnce(groqReply());
    const stt = await groqStt();
    await stt.transcribe(clip);
    expect((await sentForm()).has("prompt")).toBe(false);
  });
});

describe("/api/voice/transcribe passes a cleaned hint through", () => {
  const transcribeLesson = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    transcribeLesson.mockReset().mockResolvedValue({ status: "ok", text: "hello" });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "057a6375-41e5-4d2c-8b60-27d4051108d8" } }, error: null });
    createServerSupabaseClient.mockResolvedValue({ auth: { getUser } });
    createContainer.mockResolvedValue({ transcribeLesson, currentUser: { get: async () => ({ id: "u" }) } });
  });

  async function post(hint?: string) {
    const form = new FormData();
    form.set("audio", new Blob([clip.audio], { type: "audio/webm" }), "lesson.webm");
    form.set("durationSeconds", "4");
    if (hint !== undefined) form.set("hint", hint);
    const { POST } = await import("@/app/api/voice/transcribe/route");
    return POST(new Request("https://noggin.example.test/api/voice/transcribe", { method: "POST", body: form }));
  }

  it("forwards a trimmed hint without control characters", async () => {
    const response = await post("  TCP\u0000 handshake\n ");
    expect(response.status).toBe(200);
    expect(transcribeLesson).toHaveBeenCalledWith(expect.objectContaining({ hint: "TCP handshake" }));
  });

  it("caps the hint at 120 characters", async () => {
    await post("x".repeat(300));
    const input = transcribeLesson.mock.calls[0][0] as { hint?: string };
    expect(input.hint).toHaveLength(120);
  });

  it("omits an empty hint", async () => {
    await post("   ");
    const input = transcribeLesson.mock.calls[0][0] as { hint?: string };
    expect(input.hint).toBeUndefined();
    await post();
    const second = transcribeLesson.mock.calls[1][0] as { hint?: string };
    expect(second.hint).toBeUndefined();
  });
});

describe("the mic client sends the topic hint", () => {
  it("appends hint only when given", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({ text: "hi" }));
    vi.stubGlobal("fetch", fetchSpy);
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });

    await transcribeAudio(audio, 3, undefined, "Photosynthesis");
    await transcribeAudio(audio, 3);

    const first = fetchSpy.mock.calls[0][1].body as FormData;
    const second = fetchSpy.mock.calls[1][1].body as FormData;
    expect(first.get("hint")).toBe("Photosynthesis");
    expect(second.has("hint")).toBe(false);
  });
});
