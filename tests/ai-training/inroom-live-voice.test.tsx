// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { NogRoomView } from "@/components/room/nog-room-view";
import { useRecorder } from "@/components/voice/use-recorder";
import { MIC_CONSENT_STORAGE_KEY } from "@/components/voice/voice-client";
import type {
  NogRecord,
  ProfileSettings,
  TopicSummary,
} from "@/core/application/ports";
import type { VitalsResult } from "@/core/domain/vitals";

const teachLessonMock = vi.fn();
const askNogMock = vi.fn();
const transcribeAudioMock = vi.fn();
const requestSpeechAudioMock = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/nogs/nog-1",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/(auth)/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  teachLessonAction: (...args: unknown[]) => teachLessonMock(...args),
  answerFollowUpAction: vi.fn(),
  reviseLessonAction: vi.fn(),
}));
vi.mock("@/app/(app)/actions/ask-actions", () => ({
  askNogAction: (...args: unknown[]) => askNogMock(...args),
}));
vi.mock("@/app/(app)/actions/topic-actions", () => ({
  addTopicAction: vi.fn(),
}));
vi.mock("@/app/(app)/nogs/[id]/water/actions", () => ({
  reviewCardAction: vi.fn(),
}));
vi.mock("@/components/voice/voice-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/voice/voice-client")>();
  return {
    ...actual,
    transcribeAudio: (...args: unknown[]) => transcribeAudioMock(...args),
    requestSpeechAudio: (...args: unknown[]) => requestSpeechAudioMock(...args),
  };
});

class MockMediaRecorder {
  static isTypeSupported = () => true;
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["audio-bytes"], { type: "audio/webm" }),
    } as BlobEvent);
    this.onstop?.();
  }
}

const trackStopMock = vi.fn();
const getUserMediaMock = vi.fn();
const playMock = vi.fn();
const pauseMock = vi.fn();
const audioInstances: Array<{
  src: string;
  volume: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: typeof playMock;
  pause: typeof pauseMock;
}> = [];
const createObjectUrlMock = vi.fn();
const revokeObjectUrlMock = vi.fn();
const speechSpeakMock = vi.fn();
const speechCancelMock = vi.fn();

const nog: NogRecord = {
  id: "nog-1",
  ownerId: "user-1",
  subjectId: "subj-1",
  subjectName: "Networking",
  name: "Pingu",
  stage: "sprout",
  happiness: 80,
};

const vitals: VitalsResult = {
  happiness: 0.8,
  clarity: 0.9,
  vitality: 0.9,
  faint: false,
};

const settings: ProfileSettings = {
  grillMode: "roast",
  micMode: "tap",
  voiceEnabled: true,
  soundsEnabled: true,
};

const topic: TopicSummary = {
  id: "topic-tcp",
  subjectId: "subj-1",
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};

function renderRoom(initialTeachMode: "feed" | "live" = "live") {
  return render(
    <AppShell displayName="Learner">
      <NogRoomView
        nog={nog}
        vitals={vitals}
        progress={30}
        initialSettings={settings}
        onSaveSettings={async () => ({ status: "ok" })}
        onPet={async () => {}}
        topics={[topic]}
        initialTeachMode={initialTeachMode}
        initialTopicId={topic.id}
      />
    </AppShell>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  audioInstances.length = 0;
  window.localStorage.clear();

  getUserMediaMock.mockResolvedValue({
    getTracks: () => [{ stop: trackStopMock }],
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  let urlSeq = 0;
  createObjectUrlMock.mockImplementation(() => `blob:noggin-${++urlSeq}`);
  URL.createObjectURL = createObjectUrlMock;
  URL.revokeObjectURL = revokeObjectUrlMock;

  playMock.mockImplementation(function (this: { onended: (() => void) | null }) {
    return Promise.resolve().then(() => {
      this.onended?.();
    });
  });

  vi.stubGlobal(
    "Audio",
    class {
      volume = 1;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = playMock;
      pause = pauseMock;
      constructor(public src: string) {
        audioInstances.push(this);
      }
    },
  );

  vi.stubGlobal("speechSynthesis", {
    speak: speechSpeakMock,
    cancel: speechCancelMock,
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useRecorder.cancelRecording", () => {
  it("aborts in-flight transcription and resets phase to idle", async () => {
    let capturedSignal: AbortSignal | undefined;
    transcribeAudioMock.mockImplementationOnce(
      (_blob: Blob, _dur: number, signal?: AbortSignal) => {
        capturedSignal = signal;
        return new Promise((resolve) => {
          signal?.addEventListener("abort", () =>
            resolve({ status: "aborted" }),
          );
        });
      },
    );

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);

    let api!: ReturnType<typeof useRecorder>;
    function Harness() {
      api = useRecorder({ onTranscript: vi.fn(), reducedMotion: true, hint: "TCP" });
      return <div data-testid="phase">{api.phase}</div>;
    }

    render(<Harness />);
    await act(async () => {
      await api.startRecording();
    });
    expect(screen.getByTestId("phase")).toHaveTextContent("recording");

    nowSpy.mockReturnValue(2500);
    await act(async () => {
      api.stopRecording();
    });
    expect(screen.getByTestId("phase")).toHaveTextContent("transcribing");
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      api.cancelRecording();
    });
    expect(capturedSignal?.aborted).toBe(true);
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
    expect(trackStopMock).toHaveBeenCalled();
  });
});

describe("InRoomLiveVoice", () => {
  it("shows ConsentDialog before calling getUserMedia and returns cleanly to Feed on decline", async () => {
    const user = userEvent.setup();
    renderRoom("live");

    expect(screen.getByText("Can I hear you?")).toBeVisible();
    expect(getUserMediaMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /i’ll type instead/i }));
    expect(window.localStorage.getItem(MIC_CONSENT_STORAGE_KEY)).toBe("declined");
    expect(await screen.findByText("Typing works great too!")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /teach pingu/i })).toBeVisible();
  });

  it("posts audio to /api/voice/transcribe with topic hint, submits transcript, and speaks reply then follow-up via Gemini TTS", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(MIC_CONSENT_STORAGE_KEY, "granted");

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);

    transcribeAudioMock.mockResolvedValueOnce({
      status: "ok",
      text: "The client starts with SYN.",
    });

    teachLessonMock.mockResolvedValueOnce({
      status: "ok",
      page: {
        id: "lesson-voice-1",
        nogId: nog.id,
        topicId: topic.id,
        body: "The client starts with SYN.",
        wordCount: 5,
        kind: "lesson",
        idempotencyKey: "k-v1",
        createdAt: "2026-11-26T00:00:00.000Z",
        updatedAt: "2026-11-26T00:00:00.000Z",
      },
      digest: {
        reply: "Got it! SYN starts the handshake.",
        mood: "happy",
        followUpQuestions: ["What does the server send back?"],
        operations: [],
      },
      applied: {
        applied: true,
        cardIds: [],
        replyMessageId: "00000000-0000-4000-8000-000000000010",
        followUpMessageIds: ["00000000-0000-4000-8000-000000000011"],
      },
    });

    requestSpeechAudioMock
      .mockResolvedValueOnce({
        status: "ok",
        blob: new Blob(["wav-reply"], { type: "audio/wav" }),
      })
      .mockResolvedValueOnce({
        status: "ok",
        blob: new Blob(["wav-q1"], { type: "audio/wav" }),
      });

    renderRoom("live");

    const sendBtn = await screen.findByRole("button", { name: /stop and send voice/i });
    nowSpy.mockReturnValue(3000);
    await user.click(sendBtn);

    await waitFor(() =>
      expect(transcribeAudioMock).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.any(Number),
        expect.any(AbortSignal),
        "TCP handshake",
      ),
    );

    await waitFor(() =>
      expect(teachLessonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nogId: nog.id,
          topicId: topic.id,
          body: "The client starts with SYN.",
        }),
      ),
    );

    await waitFor(() => {
      expect(requestSpeechAudioMock).toHaveBeenNthCalledWith(
        1,
        { messageId: "00000000-0000-4000-8000-000000000010" },
        expect.any(AbortSignal),
      );
      expect(requestSpeechAudioMock).toHaveBeenNthCalledWith(
        2,
        { messageId: "00000000-0000-4000-8000-000000000011" },
        expect.any(AbortSignal),
      );
    });

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].volume).toBeCloseTo(0.9, 2);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(2);
  });

  it("falls back cleanly to window.speechSynthesis on TTS unavailable and cancels everything on Mute / End Live", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(MIC_CONSENT_STORAGE_KEY, "granted");

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);

    transcribeAudioMock.mockResolvedValueOnce({
      status: "ok",
      text: "Who sends SYN?",
    });
    askNogMock.mockResolvedValueOnce({
      status: "ok",
      knows: true,
      answer: "The client sends SYN first!",
      mood: "proud",
      citedCards: [],
      answerMessageId: "00000000-0000-4000-8000-000000000022",
    });
    requestSpeechAudioMock.mockResolvedValueOnce({ status: "unavailable" });

    renderRoom("live");

    // Switch Live Voice to Ask mode
    await user.click(screen.getByRole("button", { name: /^ask$/i }));

    const sendBtn = await screen.findByRole("button", { name: /stop and send voice/i });
    nowSpy.mockReturnValue(2500);
    await user.click(sendBtn);

    await waitFor(() =>
      expect(askNogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nogId: nog.id,
          question: "Who sends SYN?",
        }),
      ),
    );

    await waitFor(() => expect(speechSpeakMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^mute$/i }));
    expect(speechCancelMock).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /end live voice/i }));
    expect(screen.getByRole("textbox", { name: /ask pingu/i })).toBeVisible();
  });
});
