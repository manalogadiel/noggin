// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerReveal } from "@/components/check/answer-reveal";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import { nog } from "../feed-lesson/fixtures";
import { firstQuestion, tcp } from "../quick-check/fixtures";
import {
  installVoiceBrowserMocks,
  MockAudioElement,
  MockSpeechSynthesisUtterance,
} from "./voice-mocks";

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-testid={`nog-scene-${scene}`} />,
}));

function setReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: matches && media === "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function renderAnswerReveal(options?: { alreadyRevealed?: boolean }) {
  return render(
    <AnswerReveal
      nogName={nog.name}
      topicTitle={tcp.title}
      attempt={firstQuestion}
      questionNumber={1}
      totalQuestions={2}
      alreadyRevealed={options?.alreadyRevealed ?? true}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setReducedMotion(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SpeakButton in Quick Check (AnswerReveal)", () => {
  it("appears only after the answer finishes typing and never auto-plays", async () => {
    const { fetchMock, speechSynthesisMock } = installVoiceBrowserMocks();
    setReducedMotion(false);
    vi.useFakeTimers();

    renderAnswerReveal({ alreadyRevealed: false });

    // While typing, the speak button is not shown yet and no audio is requested.
    expect(
      screen.queryByRole("button", { name: new RegExp(`hear ${nog.name}['’]s answer`, "i") }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(MockAudioElement.instances).toHaveLength(0);
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();

    const totalWords = firstQuestion.nogAnswer.trim().split(/\s+/).length;
    for (let i = 0; i < totalWords; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
    }

    const speakBtn = screen.getByRole("button", {
      name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
    });
    expect(speakBtn).toBeVisible();

    // Even after reveal finishes, it never auto-plays.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(MockAudioElement.instances).toHaveLength(0);
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
  });

  it("fetches /api/voice/speak with { attemptId }, plays the audio blob, switches to Stop while playing, and revokes the object URL on end or stop", async () => {
    const user = userEvent.setup();
    const {
      fetchMock,
      createObjectURLMock,
      revokeObjectURLMock,
      speechSynthesisMock,
    } = installVoiceBrowserMocks();

    const wavBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    fetchMock.mockImplementation(
      async () =>
        new Response(wavBytes, {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        }),
    );

    renderAnswerReveal({ alreadyRevealed: true });

    const speakBtn = screen.getByRole("button", {
      name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
    });
    await user.click(speakBtn);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/voice/speak",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const requestInit = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      attemptId: firstQuestion.id,
    });

    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(MockAudioElement.instances).toHaveLength(1);
    expect(MockAudioElement.instances[0].play).toHaveBeenCalledOnce();
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();

    // While playing, the button switches to "Stop".
    const stopBtn = await screen.findByRole("button", { name: /^stop$/i });
    expect(stopBtn).toBeVisible();

    // Clicking Stop pauses playback, revokes the URL, and restores the Hear label.
    await user.click(stopBtn);
    expect(MockAudioElement.instances[0].pause).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:noggin-voice-test");
    expect(
      screen.getByRole("button", {
        name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
      }),
    ).toBeVisible();

    // Playing again and finishing naturally also revokes the object URL and restores the button.
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
      }),
    );
    expect(MockAudioElement.instances).toHaveLength(2);
    expect(await screen.findByRole("button", { name: /^stop$/i })).toBeVisible();

    await act(async () => {
      MockAudioElement.instances[1].finishPlayback();
    });

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", {
        name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
      }),
    ).toBeVisible();
  });

  it("falls back to browser speechSynthesis with the Nog's answer when /api/voice/speak returns 503 or 429", async () => {
    const user = userEvent.setup();
    const { fetchMock, speechSynthesisMock } = installVoiceBrowserMocks({
      speechSynthesisSupported: true,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderAnswerReveal({ alreadyRevealed: true });

    const speakBtn = screen.getByRole("button", {
      name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
    });
    await user.click(speakBtn);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(speechSynthesisMock.speak).toHaveBeenCalledOnce();
    const utterance = speechSynthesisMock.speak.mock
      .calls[0][0] as MockSpeechSynthesisUtterance;
    expect(utterance).toBeInstanceOf(MockSpeechSynthesisUtterance);
    expect(utterance.text).toBe(firstQuestion.nogAnswer);
  });

  it("shows 'Voice unavailable' when /api/voice/speak fails and browser speechSynthesis is missing", async () => {
    const user = userEvent.setup();
    const { fetchMock } = installVoiceBrowserMocks({
      speechSynthesisSupported: false,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderAnswerReveal({ alreadyRevealed: true });

    const speakBtn = screen.getByRole("button", {
      name: new RegExp(`hear ${nog.name}['’]s answer`, "i"),
    });
    await user.click(speakBtn);

    expect(await screen.findByText(/voice unavailable/i)).toBeVisible();
  });
});
