// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { AskExchangeRecord } from "@/core/application/ports";
import type { AskNogInput, AskNogResult, ListAskHistoryResult } from "@/core/application/use-cases/ask-nog";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import { nog, tcp, dns } from "../feed-lesson/fixtures";

const { askNogAction, getNogRoom, listTopics, listAskHistory, getProfileSettings, notFound, redirect } = vi.hoisted(() => ({
  askNogAction: vi.fn<(input: AskNogInput) => Promise<AskNogResult>>(),
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
  listAskHistory: vi.fn<(input: { nogId: string; limit?: number }) => Promise<ListAskHistoryResult>>(),
  getProfileSettings: vi.fn(async () => ({ status: "ok", settings: { micMode: "tap" } })),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/app/(app)/actions/ask-actions", () => ({ askNogAction }));
vi.mock("@/composition/container", () => ({
  createContainer: async () => ({ getNogRoom, listTopics, listAskHistory, getProfileSettings }),
}));
vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-testid={`nog-scene-${scene}`} />,
}));
vi.mock("@/components/voice/speak-button", () => ({
  SpeakButton: ({ messageId, text }: { messageId?: string; text: string }) => (
    <button type="button" data-message-id={messageId} data-text={text}>Play voice</button>
  ),
}));
vi.mock("@/components/voice/mic-button", () => ({
  MicButton: ({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => onTranscript("What is SYN?")}>Use mic</button>
  ),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  notFound,
  redirect,
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const roomResult = {
  status: "ok",
  nog: { ...nog, name: "Pingu" },
  cards: [],
} as unknown as GetNogRoomResult;
const topicsResult: ListTopicsResult = { status: "ok", topics: [tcp, dns] } as ListTopicsResult;

const olderExchange: AskExchangeRecord = {
  questionMessageId: "q-old", answerMessageId: "a-old", nogId: nog.id,
  question: "What is DNS?", answer: "It turns names into addresses!", mood: "happy",
  createdAt: "2026-11-22T09:00:00.000Z",
};
const newerExchange: AskExchangeRecord = {
  questionMessageId: "q-new", answerMessageId: "a-new", nogId: nog.id,
  question: "What starts TCP?", answer: "The client sends SYN first.", mood: "happy",
  createdAt: "2026-11-22T10:00:00.000Z",
};

const knownAnswer: AskNogResult = {
  status: "ok",
  knows: true,
  answer: "SYN opens the handshake!",
  mood: "happy",
  citedCards: [{ id: "card-syn", label: "SYN", quote: "The client sends SYN." }],
  answerMessageId: "msg-answer-1",
};

async function renderPage(history: AskExchangeRecord[] = []) {
  listAskHistory.mockResolvedValue({ status: "ok", exchanges: history });
  const { default: AskPage } = await import("@/app/(app)/nogs/[id]/ask/page");
  const element = await AskPage({ params: Promise.resolve({ id: nog.id }) });
  return render(element as ReactElement);
}

function questionBox() {
  return screen.getByRole("textbox", { name: /your question/i });
}

function askButton() {
  return screen.getByRole("button", { name: /^ask$/i });
}

beforeEach(() => {
  window.history.replaceState(null, "", `/nogs/${nog.id}/ask`);
  getNogRoom.mockResolvedValue(roomResult);
  listTopics.mockResolvedValue(topicsResult);
  askNogAction.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Ask page", () => {
  it("shows the Nog's name, an idle line and an All-topics picker without a duplicate back button", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "Ask Pingu" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /back to room/i })).not.toBeInTheDocument();
    expect(screen.getByText("Ask me something you taught me!")).toBeVisible();
    const picker = screen.getByRole("combobox", { name: /topic/i });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All topics", tcp.title, dns.title,
    ]);
    expect(questionBox()).toHaveAttribute("placeholder", "Ask Pingu anything you've taught…");
    expect(screen.queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    expect(listAskHistory).toHaveBeenCalledWith({ nogId: nog.id, limit: 20 });
  });

  it("shows recent exchanges newest first as owner and Nog bubbles", async () => {
    await renderPage([olderExchange, newerExchange]);

    const recent = screen.getByRole("region", { name: "Recent" });
    const text = recent.textContent ?? "";
    expect(text.indexOf("What starts TCP?")).toBeLessThan(text.indexOf("What is DNS?"));
    expect(within(recent).getByText("The client sends SYN first.")).toBeVisible();
    expect(within(recent).getByText("It turns names into addresses!")).toBeVisible();
  });

  it("omits RoomRail on the Ask page in favor of TopBar navigation", async () => {
    await renderPage();
    expect(screen.queryByRole("navigation", { name: "Nog room sections" })).not.toBeInTheDocument();
  });

  it("sends signed-out owners to login and unknown nogs to not found", async () => {
    const { default: AskPage } = await import("@/app/(app)/nogs/[id]/ask/page");
    getNogRoom.mockResolvedValueOnce({ status: "unauthenticated" } as GetNogRoomResult);
    listAskHistory.mockResolvedValue({ status: "unauthenticated" });
    await expect(AskPage({ params: Promise.resolve({ id: nog.id }) })).rejects.toThrow(
      `NEXT_REDIRECT:/login?next=${encodeURIComponent(`/nogs/${nog.id}/ask`)}`,
    );

    getNogRoom.mockResolvedValueOnce({ status: "not_found" } as GetNogRoomResult);
    listAskHistory.mockResolvedValue({ status: "not_found" });
    await expect(AskPage({ params: Promise.resolve({ id: nog.id }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("asking", () => {
  it("keeps Ask disabled until there is a question", async () => {
    await renderPage();
    expect(askButton()).toBeDisabled();
    await userEvent.type(questionBox(), "   ");
    expect(askButton()).toBeDisabled();
  });

  it("sends the question with the chosen topic and shows the answer with its cited notes", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValue(knownAnswer);
    await renderPage();

    await user.selectOptions(screen.getByRole("combobox", { name: /topic/i }), tcp.id);
    await user.type(questionBox(), "What starts TCP?");
    await user.click(askButton());

    expect(askNogAction).toHaveBeenCalledWith({ nogId: nog.id, question: "What starts TCP?", topicId: tcp.id });
    const live = await screen.findByRole("status");
    await waitFor(() => expect(live).toHaveTextContent("SYN opens the handshake!"));
    expect(screen.getByText("From my notes")).toBeVisible();

    const chip = screen.getByRole("button", { name: /SYN/ });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/The client sends SYN\./)).toBeVisible();

    const speak = screen.getAllByRole("button", { name: "Play voice" })[0];
    expect(speak).toHaveAttribute("data-message-id", "msg-answer-1");
    expect(speak).toHaveAttribute("data-text", "SYN opens the handshake!");

    const recent = screen.getByRole("region", { name: "Recent" });
    expect(within(recent).getByText("What starts TCP?")).toBeVisible();
    expect(questionBox()).toHaveValue("");
  });

  it("sends a null topic for All topics", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValue(knownAnswer);
    await renderPage();

    await user.type(questionBox(), "What starts TCP?");
    await user.click(askButton());
    expect(askNogAction).toHaveBeenCalledWith({ nogId: nog.id, question: "What starts TCP?", topicId: null });
  });

  it("shows a thinking state while waiting", async () => {
    const user = userEvent.setup();
    let finish: (value: AskNogResult) => void = () => undefined;
    askNogAction.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await renderPage();

    await user.type(questionBox(), "What starts TCP?");
    await user.click(askButton());
    expect(screen.getByRole("button", { name: /thinking/i })).toBeDisabled();
    expect(questionBox()).toBeDisabled();
    finish(knownAnswer);
    await screen.findAllByText("SYN opens the handshake!");
  });

  it("offers a teach link for the chosen topic when the Nog was not taught", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValue({
      status: "ok", knows: false, answer: "You haven't taught me that yet!", mood: "curious",
      citedCards: [], answerMessageId: "msg-answer-2",
    });
    await renderPage();

    await user.selectOptions(screen.getByRole("combobox", { name: /topic/i }), dns.id);
    await user.type(questionBox(), "What is a resolver?");
    await user.click(askButton());

    const teach = await screen.findByRole("link", { name: /teach me this/i });
    expect(teach).toHaveAttribute("href", `/nogs/${nog.id}?teach=feed&topic=${dns.id}`);
    expect(screen.queryByText("From my notes")).not.toBeInTheDocument();
  });

  it("links to in-room feed when asking across all topics", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValue({
      status: "ok", knows: false, answer: "You haven't taught me that yet!", mood: "curious",
      citedCards: [], answerMessageId: "msg-answer-3",
    });
    await renderPage();

    await user.type(questionBox(), "What is a resolver?");
    await user.click(askButton());
    expect(await screen.findByRole("link", { name: /teach me this/i })).toHaveAttribute("href", `/nogs/${nog.id}?teach=feed`);
  });

  it("blocks questions over 60 words", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(questionBox(), Array.from({ length: 61 }, () => "word").join(" "));
    expect(screen.getByText("Keep it under 60 words.")).toBeVisible();
    expect(askButton()).toBeDisabled();
    expect(askNogAction).not.toHaveBeenCalled();
  }, 15_000);

  it("disables asking for the day when the Nog is all asked out", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValue({ status: "tired_for_today" });
    await renderPage();

    await user.type(questionBox(), "What starts TCP?");
    await user.click(askButton());
    expect(await screen.findByText("I'm all asked out for today. Let's talk tomorrow!")).toBeVisible();
    expect(questionBox()).toBeDisabled();
    expect(askButton()).toBeDisabled();
  });

  it("lets the owner retry the same question after brain fog", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValueOnce({ status: "brain_fog" }).mockResolvedValueOnce(knownAnswer);
    await renderPage();

    await user.type(questionBox(), "What starts TCP?");
    await user.click(askButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("My head's a bit foggy. Try again?");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(askNogAction).toHaveBeenCalledTimes(2);
    expect(askNogAction).toHaveBeenLastCalledWith({ nogId: nog.id, question: "What starts TCP?", topicId: null });
    expect((await screen.findAllByText("SYN opens the handshake!"))[0]).toBeVisible();
  });

  it("appends a mic transcript to the question", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(questionBox(), "Quick one:");
    await user.click(screen.getByRole("button", { name: "Use mic" }));
    expect(questionBox()).toHaveValue("Quick one: What is SYN?");
  });

  it("never shows technical fields to the owner", async () => {
    const user = userEvent.setup();
    askNogAction.mockResolvedValue(knownAnswer);
    await renderPage([newerExchange]);
    await user.type(questionBox(), "What starts TCP?");
    await user.click(askButton());
    await screen.findAllByText("SYN opens the handshake!");

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/knows|card-syn|msg-answer|citedCards|answerMessageId/);
  });
});
