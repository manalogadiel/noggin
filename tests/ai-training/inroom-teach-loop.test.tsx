// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { TopicThoughtCards } from "@/components/notebook/topic-thought-cards";
import { NogRoomView } from "@/components/room/nog-room-view";
import type {
  NogRecord,
  ProfileSettings,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import type { VitalsResult } from "@/core/domain/vitals";

const teachLessonMock = vi.fn();
const answerFollowUpMock = vi.fn();
const reviseLessonMock = vi.fn();
const askNogMock = vi.fn();
const addTopicMock = vi.fn();
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
  answerFollowUpAction: (...args: unknown[]) => answerFollowUpMock(...args),
  reviseLessonAction: (...args: unknown[]) => reviseLessonMock(...args),
}));
vi.mock("@/app/(app)/actions/ask-actions", () => ({
  askNogAction: (...args: unknown[]) => askNogMock(...args),
}));
vi.mock("@/app/(app)/actions/topic-actions", () => ({
  addTopicAction: (...args: unknown[]) => addTopicMock(...args),
}));
vi.mock("@/app/(app)/nogs/[id]/water/actions", () => ({
  reviewCardAction: vi.fn(),
}));
vi.mock("@/components/voice/voice-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/voice/voice-client")>();
  return {
    ...actual,
    requestSpeechAudio: (...args: unknown[]) => requestSpeechAudioMock(...args),
  };
});

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

const defaultSettings: ProfileSettings = {
  grillMode: "roast",
  micMode: "tap",
  voiceEnabled: true,
  soundsEnabled: true,
};

const topicA: TopicSummary = {
  id: "topic-tcp",
  subjectId: "subj-1",
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};

const topicB: TopicSummary = {
  id: "topic-dns",
  subjectId: "subj-1",
  slug: "dns",
  title: "DNS lookup",
  status: "ready",
  questionCount: 8,
};

const existingCard: ThoughtCardRecord = {
  id: "card-syn",
  nogId: nog.id,
  topicId: topicA.id,
  label: "Client SYN",
  paraphrase: "Client sends SYN first.",
  status: "understood",
  sourceLessonId: "lesson-0",
  quote: "Client sends SYN first.",
  evidenceCount: 3,
};

function renderFeed(
  overrides: Partial<React.ComponentProps<typeof NogRoomView>> = {},
) {
  return render(
    <AppShell displayName="Learner">
      <NogRoomView
        nog={nog}
        vitals={vitals}
        progress={25}
        initialSettings={defaultSettings}
        onSaveSettings={async () => ({ status: "ok" })}
        onPet={async () => {}}
        topics={[topicA, topicB]}
        thoughtCards={[existingCard]}
        initialTeachMode="feed"
        initialTopicId={topicA.id}
        {...overrides}
      />
    </AppShell>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("In-Room Teach & Ask loop", () => {
  it("tracks follow-up thread via answerFollowUpAction and resets on New note or follow_up_limit", async () => {
    const user = userEvent.setup();
    teachLessonMock.mockResolvedValueOnce({
      status: "ok",
      page: {
        id: "lesson-root-1",
        nogId: nog.id,
        topicId: topicA.id,
        body: "The client sends SYN first.",
        wordCount: 5,
        kind: "lesson",
        idempotencyKey: "k1",
        createdAt: "2026-11-26T00:00:00.000Z",
        updatedAt: "2026-11-26T00:00:00.000Z",
      },
      digest: {
        reply: "Nice start! Client kicks off with SYN.",
        mood: "excited",
        followUpQuestions: ["What does the server send back?"],
        operations: [
          {
            type: "create",
            label: "SYN Packet",
            paraphrase: "Client sends SYN first.",
            status: "understood",
            quote: "The client sends SYN first.",
          },
        ],
      },
      applied: {
        applied: true,
        cardIds: ["card-new-1"],
        replyMessageId: "00000000-0000-4000-8000-000000000001",
      },
    });
    answerFollowUpMock.mockResolvedValueOnce({
      status: "follow_up_limit",
    });

    renderFeed();

    const input = screen.getByRole("textbox", { name: /teach pingu/i });
    await user.type(input, "The client sends SYN first.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));

    expect(await screen.findByText("+ Learned: SYN Packet")).toBeVisible();
    expect(screen.getByText("What does the server send back?")).toBeVisible();
    expect(screen.getByRole("button", { name: /new note/i })).toBeVisible();
    expect(screen.getByText("Excited")).toBeVisible();
    expect(
      document.querySelector('[data-mood="excited"]'),
    ).not.toBeNull();

    await user.type(input, "The server replies with SYN-ACK.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));

    await waitFor(() =>
      expect(answerFollowUpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nogId: nog.id,
          topicId: topicA.id,
          lessonId: "lesson-root-1",
          body: "The server replies with SYN-ACK.",
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /new note/i })).not.toBeInTheDocument(),
    );

    teachLessonMock.mockResolvedValueOnce({
      status: "ok",
      page: {
        id: "lesson-root-2",
        nogId: nog.id,
        topicId: topicA.id,
        body: "Finally the client sends ACK.",
        wordCount: 5,
        kind: "lesson",
        idempotencyKey: "k2",
        createdAt: "2026-11-26T00:00:00.000Z",
        updatedAt: "2026-11-26T00:00:00.000Z",
      },
      digest: {
        reply: "Locked in!",
        mood: "proud",
        followUpQuestions: ["Why is ACK needed?"],
        operations: [],
      },
      applied: { applied: true, cardIds: [] },
    });

    await user.type(input, "Finally the client sends ACK.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));
    expect(await screen.findByRole("button", { name: /new note/i })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /new note/i }));
    expect(screen.queryByRole("button", { name: /new note/i })).not.toBeInTheDocument();
  });

  it("displays Stronger, Updated, Conflict (with Clarify), and offTopic feedback badges", async () => {
    const user = userEvent.setup();
    teachLessonMock.mockResolvedValueOnce({
      status: "ok",
      page: {
        id: "lesson-ops",
        nogId: nog.id,
        topicId: topicA.id,
        body: "Actually server sends SYN and also baking bread is tasty.",
        wordCount: 10,
        kind: "lesson",
        idempotencyKey: "k-ops",
        createdAt: "2026-11-26T00:00:00.000Z",
        updatedAt: "2026-11-26T00:00:00.000Z",
      },
      digest: {
        reply: "Hold up, that clashes!",
        mood: "shocked",
        followUpQuestions: [],
        offTopic: true,
        operations: [
          { type: "reinforce", cardId: existingCard.id, quote: "SYN" },
          {
            type: "update",
            cardId: existingCard.id,
            label: "Client SYN Detail",
            quote: "SYN",
          },
          { type: "conflict", cardId: existingCard.id, quote: "server sends SYN" },
        ],
      },
      applied: { applied: true, cardIds: [existingCard.id] },
    });

    renderFeed();

    await user.type(
      screen.getByRole("textbox", { name: /teach pingu/i }),
      "Actually server sends SYN and also baking bread is tasty.",
    );
    await user.click(screen.getByRole("button", { name: /send lesson/i }));

    expect(await screen.findByText("Stronger: Client SYN")).toBeVisible();
    expect(screen.getByText("Updated: Client SYN Detail")).toBeVisible();
    expect(screen.getByText("Conflict: Client SYN")).toBeVisible();
    expect(
      screen.getByText(/doesn’t sound like TCP handshake\. Saved as shaky\./i),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^clarify$/i }));
    expect(
      screen.getByPlaceholderText(/clarify "client syn"/i),
    ).toBeVisible();
  });

  it("handles already_taught without awarding rewards and safely auto-heals questions_pending at most once", async () => {
    const user = userEvent.setup();
    teachLessonMock.mockResolvedValueOnce({
      status: "already_taught",
      pageId: "lesson-0",
    });

    renderFeed();
    const input = screen.getByRole("textbox", { name: /teach pingu/i });

    await user.type(input, "Client sends SYN first.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));
    expect(await screen.findByText("You already taught me this one!")).toBeVisible();

    // Case 1: questions_pending -> addTopicAction ok -> retries once
    teachLessonMock
      .mockResolvedValueOnce({ status: "questions_pending" })
      .mockResolvedValueOnce({
        status: "ok",
        page: {
          id: "lesson-healed",
          nogId: nog.id,
          topicId: topicA.id,
          body: "Server sends SYN-ACK.",
          wordCount: 3,
          kind: "lesson",
          idempotencyKey: "k-h",
          createdAt: "2026-11-26T00:00:00.000Z",
          updatedAt: "2026-11-26T00:00:00.000Z",
        },
        digest: {
          reply: "Healed and saved!",
          mood: "happy",
          followUpQuestions: [],
          operations: [],
        },
        applied: { applied: true, cardIds: [] },
      });
    addTopicMock.mockResolvedValueOnce({ status: "ok", topic: topicA });

    await user.type(input, "Server sends SYN-ACK.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));
    expect(await screen.findByText("Healed and saved!")).toBeVisible();
    expect(addTopicMock).toHaveBeenCalledTimes(1);

    // Case 2: questions_pending -> addTopicAction pending -> stops retrying and shows Retry
    teachLessonMock.mockResolvedValueOnce({ status: "questions_pending" });
    addTopicMock.mockResolvedValueOnce({ status: "pending", topic: topicA });

    await user.type(input, "Client finishes with ACK.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));
    expect(await screen.findByRole("button", { name: /^retry$/i })).toBeVisible();
    expect(addTopicMock).toHaveBeenCalledTimes(2);

    // Case 3: questions_pending -> addTopicAction tired_for_today -> daily limit message
    teachLessonMock.mockResolvedValueOnce({ status: "questions_pending" });
    addTopicMock.mockResolvedValueOnce({ status: "tired_for_today" });

    await user.clear(input);
    await user.type(input, "Port numbers route segments.");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));
    expect(
      await screen.findByText(/full for today/i),
    ).toBeVisible();
  });

  it("handles Teach small talk locally without calling teachLessonAction, and supports Ask mode with cited cards, untaught switch, and reply TTS", async () => {
    const user = userEvent.setup();
    requestSpeechAudioMock.mockResolvedValueOnce({ status: "unavailable" });
    const speakSpy = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      speak: speakSpy,
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

    renderFeed();

    // Small talk in Teach mode stays in-character without saving a lesson page
    const teachInput = screen.getByRole("textbox", { name: /teach pingu/i });
    await user.type(teachInput, "how are you?");
    await user.click(screen.getByRole("button", { name: /send lesson/i }));
    expect(teachLessonMock).not.toHaveBeenCalled();

    // Switch to Ask mode
    await user.click(screen.getByRole("button", { name: /^ask$/i }));
    const askInput = screen.getByRole("textbox", { name: /ask pingu/i });

    askNogMock.mockResolvedValueOnce({
      status: "ok",
      knows: true,
      answer: "From my notes, the client sends SYN first!",
      mood: "proud",
      citedCards: [
        { id: "card-syn", label: "Client SYN", quote: "Client sends SYN first." },
      ],
      answerMessageId: "00000000-0000-4000-8000-000000000099",
    });

    await user.type(askInput, "Who sends SYN first?");
    await user.click(screen.getByRole("button", { name: /ask nog/i }));

    expect(
      await screen.findByText("From my notes, the client sends SYN first!"),
    ).toBeVisible();
    expect(screen.getByText("Client SYN")).toBeVisible();
    expect(document.querySelector('[data-mood="proud"]')).not.toBeNull();

    // Play reply audio button invokes requestSpeechAudio with answerMessageId
    const speakBtn = screen.getByRole("button", { name: /hear nog reply/i });
    await user.click(speakBtn);
    await waitFor(() =>
      expect(requestSpeechAudioMock).toHaveBeenCalledWith(
        { messageId: "00000000-0000-4000-8000-000000000099" },
        expect.any(AbortSignal),
      ),
    );
    expect(speakSpy).toHaveBeenCalled();

    // Untaught Ask shows "Teach this" switch button
    askNogMock.mockResolvedValueOnce({
      status: "ok",
      knows: false,
      answer: "You haven't taught me that yet!",
      mood: "curious",
      citedCards: [],
      answerMessageId: "00000000-0000-4000-8000-000000000100",
    });

    await user.type(askInput, "What is BGP?");
    await user.click(screen.getByRole("button", { name: /ask nog/i }));
    const teachThisBtn = await screen.findByRole("button", { name: /teach this/i });
    await user.click(teachThisBtn);
    expect(screen.getByRole("textbox", { name: /teach pingu/i })).toBeVisible();
  });

  it("shows Taught N× on reinforced Thought Cards and omits it when count is 1 or missing", () => {
    render(
      <TopicThoughtCards
        nogName="Pingu"
        cards={[
          existingCard,
          { ...existingCard, id: "card-once", label: "Single", evidenceCount: 1 },
          { ...existingCard, id: "card-undef", label: "Unset", evidenceCount: undefined },
        ]}
      />,
    );

    expect(screen.getByText("Taught 3×")).toBeVisible();
    expect(screen.queryByText("Taught 1×")).not.toBeInTheDocument();
  });
});
