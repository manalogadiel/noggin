// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/(app)/nogs/[id]/feed/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import {
  DEFAULT_PROFILE_SETTINGS,
  type ProfileSettings,
} from "@/core/application/ports";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { GetProfileSettingsResult } from "@/core/application/use-cases/get-profile-settings";
import type { GetTopicNotebookResult } from "@/core/application/use-cases/get-topic-notebook";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import { nog, tcp } from "../feed-lesson/fixtures";
import {
  installVoiceBrowserMocks,
  MockAudioContext,
  MockMediaRecorder,
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

function setProfileMicMode(micMode: ProfileSettings["micMode"]) {
  getProfileSettings.mockResolvedValue({
    status: "ok",
    settings: {
      ...DEFAULT_PROFILE_SETTINGS,
      micMode,
    },
  });
}

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

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
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
  setProfileMicMode("tap");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("Mic support & Consent dialog (Feed)", () => {
  it("disables the mic button with 'Voice isn't supported in this browser' when MediaRecorder or mediaDevices is missing", async () => {
    installVoiceBrowserMocks({
      mediaRecorderSupported: false,
      mediaDevicesSupported: false,
    });

    await renderFeedWithTopic();

    const micBtn = getMicButton();
    expect(micBtn).toBeDisabled();
    expect(micBtn).toHaveAttribute(
      "title",
      "Voice isn't supported in this browser",
    );
  });

  it("opens the consent dialog on first mic tap with listening Nog art, privacy link, and Allow / decline actions", async () => {
    const user = userEvent.setup();
    const { getUserMediaMock } = installVoiceBrowserMocks();

    await renderFeedWithTopic();

    const micBtn = getMicButton();
    expect(micBtn).toBeEnabled();
    await user.click(micBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();
    expect(
      within(dialog).getByRole("heading", { level: 2, name: "Can I hear you?" }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        /I['’]ll turn what you say into text for your lesson\.\s*Your recording isn['’]t kept\s*[—–-]\s*only the words\./i,
      ),
    ).toBeVisible();

    const happyArt = dialog.querySelector('img[src*="hatchling-happy.png"]');
    expect(happyArt).not.toBeNull();

    const privacyLink = within(dialog).getByRole("link", { name: /^privacy$/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");

    expect(
      within(dialog).getByRole("button", { name: /^allow mic$/i }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: /^i['’]ll type instead$/i }),
    ).toBeVisible();
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });

  it("stores 'declined', returns focus to the lesson textarea, shows 'Typing works great too!', and asks again on a later mic tap", async () => {
    const user = userEvent.setup();
    const { getUserMediaMock } = installVoiceBrowserMocks();

    await renderFeedWithTopic();

    await user.click(getMicButton());
    const dialog = screen.getByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: /^i['’]ll type instead$/i }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("noggin.micConsent")).toBe("declined");
    expect(screen.getByText(/typing works great too!/i)).toBeVisible();

    const textarea = getLessonTextarea();
    expect(textarea).toBeEnabled();
    expect(document.activeElement).toBe(textarea);

    await user.type(textarea, "SYN starts the handshake.");
    expect(textarea).toHaveValue("SYN starts the handshake.");
    expect(getUserMediaMock).not.toHaveBeenCalled();

    // Declining is never a permanent lock-out: a later mic tap opens the dialog again.
    await user.click(getMicButton());
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("stores 'granted' when Allow mic is clicked, starts recording immediately, and skips the dialog on subsequent mic taps", async () => {
    const user = userEvent.setup();
    const { getUserMediaMock } = installVoiceBrowserMocks();

    await renderFeedWithTopic();

    await user.click(getMicButton());
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^allow mic$/i }));

    expect(window.localStorage.getItem("noggin.micConsent")).toBe("granted");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getUserMediaMock).toHaveBeenCalledExactlyOnceWith({ audio: true });
    expect(await screen.findByText(/^recording$/i)).toBeVisible();

    // Stop recording and verify a second tap starts recording without showing the dialog again.
    await user.click(screen.getByRole("button", { name: /stop recording/i }));
    await user.click(await screen.findByRole("button", { name: /mic|record|voice/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
  });
});

describe("Tap mode & Hold (push-to-talk) recording modes", () => {
  it("records inline in tap mode with a red Recording pill, 7-bar waveform, timer, polite status announcements, and visible textarea", async () => {
    const { getUserMediaMock } = installVoiceBrowserMocks();
    window.localStorage.setItem("noggin.micConsent", "granted");
    vi.useFakeTimers();

    await renderFeedWithTopic();

    await act(async () => {
      fireEvent.click(getMicButton());
    });

    expect(getUserMediaMock).toHaveBeenCalledExactlyOnceWith({ audio: true });
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(MockMediaRecorder.instances[0].state).toBe("recording");
    expect(MockAudioContext.instances.length).toBeGreaterThanOrEqual(1);

    // The lesson textarea stays visible while recording inline.
    expect(getLessonTextarea()).toBeVisible();
    expect(screen.getByText(/^recording$/i)).toBeVisible();

    const startedAnnouncement = screen.getByText(/recording started/i);
    expect(
      startedAnnouncement.closest('[aria-live="polite"], [role="status"]'),
    ).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    const timerNode = screen.getByText("0:12");
    expect(timerNode).toBeVisible();
    expect(timerNode.closest('[aria-live="off"]')).not.toBeNull();

    // 7-bar waveform is rendered inside the recording pill.
    const stopBtn = screen.getByRole("button", { name: /stop recording/i });
    const pill = stopBtn.closest("div, section") ?? stopBtn.parentElement!;
    const bars = pill.querySelectorAll("[data-waveform-bar]");
    expect(bars.length).toBe(7);

    await act(async () => {
      fireEvent.click(stopBtn);
    });

    expect(MockMediaRecorder.instances[0].stop).toHaveBeenCalledOnce();
    const stoppedAnnouncement = screen.getByText(/recording stopped/i);
    expect(
      stoppedAnnouncement.closest('[aria-live="polite"], [role="status"]'),
    ).not.toBeNull();
  });

  it("auto-stops recording at 60 seconds and sends the recording for transcription", async () => {
    const { fetchMock } = installVoiceBrowserMocks();
    window.localStorage.setItem("noggin.micConsent", "granted");
    vi.useFakeTimers();

    await renderFeedWithTopic();

    await act(async () => {
      fireEvent.click(getMicButton());
    });
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(MockMediaRecorder.instances[0].state).toBe("recording");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(MockMediaRecorder.instances[0].stop).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/voice/transcribe",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses hold (push-to-talk) mode when profile settings specify micMode='hold', recording while pointer or Space/Enter is held", async () => {
    const { fetchMock, getUserMediaMock } = installVoiceBrowserMocks();
    window.localStorage.setItem("noggin.micConsent", "granted");
    setProfileMicMode("hold");
    vi.useFakeTimers();

    await renderFeedWithTopic();

    const holdBtn = screen.getByRole("button", { name: /hold to talk/i });
    expect(holdBtn).toBeVisible();

    // Pointer hold: pointerdown starts, pointerup after 2 seconds stops and transcribes.
    await act(async () => {
      fireEvent.pointerDown(holdBtn);
    });
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(MockMediaRecorder.instances[0].state).toBe("recording");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await act(async () => {
      fireEvent.pointerUp(holdBtn);
    });

    expect(MockMediaRecorder.instances[0].stop).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Keyboard hold: Space keydown starts, keyup after 2 seconds stops and transcribes.
    const holdBtnAgain = screen.getByRole("button", { name: /hold to talk/i });
    await act(async () => {
      fireEvent.keyDown(holdBtnAgain, { key: " ", code: "Space" });
    });
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    expect(MockMediaRecorder.instances[1].state).toBe("recording");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await act(async () => {
      fireEvent.keyUp(holdBtnAgain, { key: " ", code: "Space" });
    });

    expect(MockMediaRecorder.instances[1].stop).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
