// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/(app)/nogs/[id]/feed/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import { DEFAULT_PROFILE_SETTINGS } from "@/core/application/ports";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { GetProfileSettingsResult } from "@/core/application/use-cases/get-profile-settings";
import type { GetTopicNotebookResult } from "@/core/application/use-cases/get-topic-notebook";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import { nog, tcp } from "../feed-lesson/fixtures";
import {
  installVoiceBrowserMocks,
  MockSpeechRecognition,
} from "./voice-mocks";

const {
  addTopicAction,
  answerFollowUpAction,
  reviseLessonAction,
  teachLessonAction,
  getNogRoom,
  getTopicNotebook,
  listTopics,
  getProfileSettings,
} = vi.hoisted(() => ({
  addTopicAction: vi.fn(),
  answerFollowUpAction: vi.fn(),
  reviseLessonAction: vi.fn(),
  teachLessonAction: vi.fn(),
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  getTopicNotebook:
    vi.fn<(input: { nogId: string; topicId: string }) => Promise<GetTopicNotebookResult>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
  getProfileSettings: vi.fn<() => Promise<GetProfileSettingsResult>>(),
}));

vi.mock("@/app/(app)/actions/topic-actions", () => ({ addTopicAction }));
vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  addTopicAction,
  answerFollowUpAction,
  reviseLessonAction,
  teachLessonAction,
}));
vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogRoom,
    getTopicNotebook,
    listTopics,
    getProfileSettings,
  }),
}));
vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-testid={`nog-scene-${scene}`} />,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => `/nogs/${nog.id}/feed`,
  useSearchParams: () => new URLSearchParams(`topic=${tcp.id}`),
}));

async function renderFeedWithTopic() {
  return render(
    await FeedPage({
      params: Promise.resolve({ id: nog.id }),
      searchParams: Promise.resolve({ topic: tcp.id }),
    }),
  );
}

function getMicButton() {
  return screen.getByRole("button", { name: /mic|record|voice|hold to talk/i });
}

function getLessonTextarea() {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Your lesson" });
}

async function recordAndStop(durationMs = 2_000) {
  await act(async () => {
    fireEvent.click(getMicButton());
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(durationMs);
  });
  const stopBtn = screen.getByRole("button", { name: /stop recording/i });
  await act(async () => {
    fireEvent.click(stopBtn);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  window.localStorage.setItem("noggin.micConsent", "granted");
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));

  listTopics.mockResolvedValue({ status: "ok", topics: [tcp] });
  getNogRoom.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.8, clarity: 0.5, vitality: 1, faint: false },
    cards: [],
  });
  getTopicNotebook.mockResolvedValue({
    status: "ok",
    topic: tcp,
    pages: [],
    thoughtCards: [],
  });
  getProfileSettings.mockResolvedValue({
    status: "ok",
    settings: DEFAULT_PROFILE_SETTINGS,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("Transcription & LessonEditor integration", () => {
  it("shows 'Transcribing…', posts audio to /api/voice/transcribe, appends the transcript with one space, and updates the word count and brain meter", async () => {
    const { fetchMock } = installVoiceBrowserMocks();
    let resolveTranscribe!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveTranscribe = resolve;
      }),
    );
    vi.useFakeTimers();

    await renderFeedWithTopic();

    const textarea = getLessonTextarea();
    fireEvent.change(textarea, {
      target: { value: "The client sends SYN." },
    });
    expect(
      screen.getByRole("meter", { name: /brain capacity/i, value: { now: 4, max: 120 } }),
    ).toBeVisible();

    await recordAndStop(2_000);

    expect(screen.getByText(/transcribing/i)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/voice/transcribe",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );

    const sentForm = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(sentForm.get("audio")).toBeInstanceOf(Blob);
    expect(Number(sentForm.get("durationSeconds"))).toBeGreaterThanOrEqual(1);

    await act(async () => {
      resolveTranscribe(
        new Response(
          JSON.stringify({ text: "  The server replies with SYN-ACK.  " }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });

    expect(textarea).toHaveValue(
      "The client sends SYN. The server replies with SYN-ACK.",
    );
    expect(screen.getByText(/\b9\s*\/\s*120\b/)).toBeVisible();
    expect(
      screen.getByRole("meter", { name: /brain capacity/i, value: { now: 9, max: 120 } }),
    ).toBeVisible();

    // Still editable before feeding.
    fireEvent.change(textarea, {
      target: {
        value:
          "The client sends SYN. The server replies with SYN-ACK. Finally the client sends ACK.",
      },
    });
    expect(
      screen.getByRole("meter", { name: /brain capacity/i, value: { now: 14, max: 120 } }),
    ).toBeVisible();
  });

  it("discards recordings shorter than 0.5 seconds with 'Too short — hold a little longer' without calling /api/voice/transcribe", async () => {
    const { fetchMock } = installVoiceBrowserMocks();
    vi.useFakeTimers();

    await renderFeedWithTopic();

    await recordAndStop(250);

    expect(
      screen.getByText(/too short\s*[—–-]\s*hold a little longer/i),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Mic & transcription error states and fallbacks", () => {
  it("shows 'Mic is blocked — you can type instead' when getUserMedia is denied", async () => {
    const { fetchMock, getUserMediaMock } = installVoiceBrowserMocks();
    getUserMediaMock.mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    await renderFeedWithTopic();

    await act(async () => {
      fireEvent.click(getMicButton());
    });

    expect(
      await screen.findByText(/mic is blocked\s*[—–-]\s*you can type instead/i),
    ).toBeVisible();
    expect(getUserMediaMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getLessonTextarea()).toBeEnabled();
  });

  it("falls back to browser SpeechRecognition on 503 when available and appends the browser transcript into the editor", async () => {
    const { fetchMock } = installVoiceBrowserMocks({
      speechRecognitionSupported: true,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.useFakeTimers();

    await renderFeedWithTopic();

    const textarea = getLessonTextarea();
    fireEvent.change(textarea, {
      target: { value: "First step:" },
    });

    await recordAndStop(2_000);

    expect(
      screen.getByText(/trying your browser['’]s listener/i),
    ).toBeVisible();
    expect(MockSpeechRecognition.instances.length).toBeGreaterThanOrEqual(1);
    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition.start).toHaveBeenCalledOnce();

    await act(async () => {
      recognition.emitFinalTranscript("client sends SYN packet");
    });

    expect(textarea).toHaveValue("First step: client sends SYN packet");
    expect(
      screen.getByRole("meter", { name: /brain capacity/i, value: { now: 6, max: 120 } }),
    ).toBeVisible();
  });

  it("shows 'Couldn't hear that — type it instead' on 503 when browser SpeechRecognition is unavailable", async () => {
    const { fetchMock } = installVoiceBrowserMocks({
      speechRecognitionSupported: false,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.useFakeTimers();

    await renderFeedWithTopic();
    await recordAndStop(2_000);

    expect(
      screen.getByText(/couldn['’]t hear that\s*[—–-]\s*type it instead/i),
    ).toBeVisible();
    expect(getLessonTextarea()).toBeEnabled();
  });

  it("shows 'Your Nog's ears are tired for today — type it instead' when /api/voice/transcribe returns 429", async () => {
    const { fetchMock } = installVoiceBrowserMocks();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "tired" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.useFakeTimers();

    await renderFeedWithTopic();
    await recordAndStop(2_000);

    expect(
      screen.getByText(
        /your nog['’]s ears are tired for today\s*[—–-]\s*type it instead/i,
      ),
    ).toBeVisible();
  });

  it("shows 'That was too long — keep it under a minute' when /api/voice/transcribe returns 413", async () => {
    const { fetchMock } = installVoiceBrowserMocks();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Audio exceeds the 60-second limit." }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.useFakeTimers();

    await renderFeedWithTopic();
    await recordAndStop(2_000);

    expect(
      screen.getByText(/that was too long\s*[—–-]\s*keep it under a minute/i),
    ).toBeVisible();
  });
});
