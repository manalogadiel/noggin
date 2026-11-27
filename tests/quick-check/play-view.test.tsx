// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/(app)/nogs/[id]/feed/page";
import PlayPage from "@/app/(app)/nogs/[id]/play/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { GetTopicNotebookResult } from "@/core/application/use-cases/get-topic-notebook";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import type { ReviseLessonInput, ReviseLessonResult } from "@/core/application/use-cases/revise-lesson";
import { runQuickCheck, type RunQuickCheckInput } from "@/core/application/use-cases/run-quick-check";
import { card, dns, nog, originalPage, savedResult, tls } from "../feed-lesson/fixtures";
import { correctedAnswer, correctedLesson, firstQuestion, improvedCheck, initialCheck, secondQuestion, tcp, type CheckResponse } from "./fixtures";

const {
  runQuickCheckAction,
  reviseLessonAction,
  teachLessonAction,
  addTopicAction,
  getNogRoom,
  getTopicNotebook,
  listTopics,
} = vi.hoisted(() => ({
  runQuickCheckAction: vi.fn<(input: RunQuickCheckInput) => Promise<CheckResponse>>(),
  reviseLessonAction: vi.fn<(input: ReviseLessonInput) => Promise<ReviseLessonResult>>(),
  teachLessonAction: vi.fn(),
  addTopicAction: vi.fn(),
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  getTopicNotebook: vi.fn<(input: { nogId: string; topicId: string }) => Promise<GetTopicNotebookResult>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
}));

vi.mock("@/app/(app)/actions/check-actions", () => ({ runQuickCheckAction }));
vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  reviseLessonAction,
  teachLessonAction,
  answerFollowUpAction: vi.fn(),
}));
vi.mock("@/app/(app)/actions/topic-actions", () => ({ addTopicAction }));
vi.mock("@/composition/container", () => ({
  createContainer: async () => ({ getNogRoom, getTopicNotebook, listTopics }),
}));
vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-testid={`nog-scene-${scene}`} />,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push: (href: string) => window.history.pushState(null, "", href),
    replace: (href: string) => window.history.replaceState(null, "", href),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const roomHref = `/nogs/${nog.id}`;
const checkInput = { nogId: nog.id, topicId: tcp.id };
const pendingTopic = { ...tls, status: "pending", questionCount: 0 } as const;

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

beforeEach(() => {
  vi.resetAllMocks();
  setReducedMotion(true);
  listTopics.mockResolvedValue({ status: "ok", topics: [tcp, dns, pendingTopic] });
  getNogRoom.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.7, clarity: 0, vitality: 1, faint: false },
    cards: [{ ...card, freshness: "fresh" }],
  });
  getTopicNotebook.mockResolvedValue({ status: "ok", topic: tcp, pages: [originalPage], thoughtCards: [card] });
  runQuickCheckAction.mockResolvedValue(initialCheck);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

async function renderPlay(topicId = tcp.id) {
  window.history.replaceState(null, "", `${roomHref}/play?topic=${topicId}`);
  const props = {
    params: Promise.resolve({ id: nog.id }),
    searchParams: Promise.resolve({ topic: topicId }),
  };
  const view = render(await PlayPage(props));
  expect(screen.getByRole("heading", { level: 1, name: "Practice Quiz" })).toBeVisible();
  return view;
}

function startButton() {
  return screen.getByRole("button", { name: "Start Quiz" });
}

async function startWithTimers() {
  await act(async () => { fireEvent.click(startButton()); });
  expect(screen.getByText(firstQuestion.prompt)).toBeVisible();
}

type User = ReturnType<typeof userEvent.setup>;

async function openResults(user: User) {
  await user.click(startButton());
  expect(await screen.findByText(firstQuestion.prompt)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next →" }));
  expect(screen.getByText(secondQuestion.prompt)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "See results →" }));
}

function expectProgress(position: number) {
  expect(screen.getByText(`Question ${position} of 2`)).toBeVisible();
  const progressBar = screen.getByRole("progressbar");
  expect(progressBar).toBeVisible();
  const min = Number(progressBar.getAttribute("aria-valuemin") ?? 0);
  const max = Number(progressBar.getAttribute("aria-valuemax") ?? 100);
  const progress = progressBar instanceof HTMLProgressElement
    ? progressBar.position
    : (Number(progressBar.getAttribute("aria-valuenow")) - min) / (max - min);
  expect(progress).toBeCloseTo(position / 2);
}

function expectResultStat(stat: RegExp) {
  // Stat values and labels can be styled as adjacent elements.
  const item = screen.getByText((_text, element) =>
    element !== null && stat.test(element.textContent) &&
    !Array.from(element.children).some((child) => stat.test(child.textContent)),
  );
  expect(item).toBeVisible();
}

describe("Quick Check in Play", () => {
  it("preselects the URL topic and starts a check for the topic chosen in the quiz", async () => {
    const user = userEvent.setup();
    await renderPlay(dns.id);

    const preselected = screen.getByRole("radio", { name: new RegExp(dns.title, "i") });
    const selected = screen.getByRole("radio", { name: new RegExp(tcp.title, "i") });
    expect(preselected).toBeChecked();
    expect(runQuickCheckAction).not.toHaveBeenCalled();

    await user.click(selected);
    expect(selected).toBeChecked();
    expect(preselected).not.toBeChecked();
    await user.click(startButton());

    expect(runQuickCheckAction).toHaveBeenCalledExactlyOnceWith(checkInput);
  });

  it("disables a pending topic and explains why", async () => {
    const user = userEvent.setup();
    await renderPlay();

    const pending = screen.getByRole("radio", { name: new RegExp(pendingTopic.title, "i") });
    expect(pending.matches(":disabled, [aria-disabled='true']")).toBe(true);
    expect(screen.getByText(/questions (?:are )?(?:still )?being written/i)).toBeVisible();

    await user.click(pending);
    expect(pending).not.toBeChecked();
    expect(runQuickCheckAction).not.toHaveBeenCalled();
    await user.click(startButton());
    expect(runQuickCheckAction).toHaveBeenCalledExactlyOnceWith(checkInput);
  });

  it("shows the Nog thinking while the action is pending, then opens the first question", async () => {
    const user = userEvent.setup();
    const result = Promise.withResolvers<CheckResponse>();
    runQuickCheckAction.mockReturnValueOnce(result.promise);
    await renderPlay();

    await user.click(startButton());
    expect(runQuickCheckAction).toHaveBeenCalledExactlyOnceWith(checkInput);
    expect(screen.getByText(/hmm, let me think/i)).toBeVisible();
    expect(screen.getByTestId("nog-scene-room")).toBeVisible();
    expect(screen.queryByText(firstQuestion.prompt)).not.toBeInTheDocument();

    await act(async () => { result.resolve(initialCheck); });
    expect(screen.queryByText(/hmm, let me think/i)).not.toBeInTheDocument();
    expect(screen.getByText(firstQuestion.prompt)).toBeVisible();
  });

  it("offers to teach an untaught topic without calling the answerer or grader", async () => {
    const user = userEvent.setup();
    const { deps } = createInMemoryPorts({ userId: nog.ownerId, nogs: [nog], topics: [{ ...tcp, ownerId: null }] });
    const answer = vi.spyOn(deps.brain, "answer");
    const grade = vi.spyOn(deps.grader, "grade");
    getTopicNotebook.mockResolvedValueOnce({ status: "ok", topic: tcp, pages: [], thoughtCards: [] });
    runQuickCheckAction.mockImplementation(async (input) => {
      const result = await runQuickCheck(deps, input);
      if (result.status === "ok") throw new Error("An untaught topic produced check attempts");
      return result;
    });
    await renderPlay();

    await user.click(startButton());

    expect(await screen.findByText(/you haven['’]t taught me that yet!/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Teach it" })).toHaveAttribute("href", `${roomHref}?teach=feed&topic=${tcp.id}`);
    expect(screen.queryByText(firstQuestion.prompt)).not.toBeInTheDocument();
    expect(runQuickCheckAction).toHaveBeenCalledExactlyOnceWith(checkInput);
    expect(answer).not.toHaveBeenCalled();
    expect(grade).not.toHaveBeenCalled();
  });

  it.each([
    ["questions_pending", /questions are still being written/i],
    ["tired_for_today", /your nog is tired for today/i],
  ] as const)("shows the %s message from the check action", async (status, message) => {
    const user = userEvent.setup();
    runQuickCheckAction.mockResolvedValueOnce({ status });
    await renderPlay();

    await user.click(startButton());

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText(firstQuestion.prompt)).not.toBeInTheDocument();
    expect(runQuickCheckAction).toHaveBeenCalledExactlyOnceWith(checkInput);
  });

  it("explains a sleepy result and retries the same check", async () => {
    const user = userEvent.setup();
    runQuickCheckAction.mockResolvedValueOnce({ status: "sleepy" });
    await renderPlay();

    await user.click(startButton());
    const sleepyMessage = /your nog is sleepy.*try again in a bit/i;
    expect(await screen.findByText(sleepyMessage)).toBeVisible();
    expect(screen.queryByText(firstQuestion.prompt)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(firstQuestion.prompt)).toBeVisible();
    expect(screen.queryByText(sleepyMessage)).not.toBeInTheDocument();
    expect(runQuickCheckAction.mock.calls).toEqual([[checkInput], [checkInput]]);
  });

  it("types the answer in words before announcing the whole answer and showing the verdict", async () => {
    setReducedMotion(false);
    await renderPlay();
    vi.useFakeTimers();
    await startWithTimers();

    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(screen.getByText((text) => firstQuestion.nogAnswer.startsWith(`${text} `))).toBeVisible();
    expect(screen.queryByText(firstQuestion.nogAnswer)).not.toBeInTheDocument();
    expect(screen.queryByText(/got it/i)).not.toBeInTheDocument();
    expect(screen.queryByText(firstQuestion.concepts[0].concept)).not.toBeInTheDocument();
    expect(screen.queryByText(secondQuestion.prompt)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // Flush React between ticks so this also works with an effect scheduling each word.
    const wordCount = firstQuestion.nogAnswer.split(" ").length;
    for (let index = 0; index < wordCount; index += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    }
    const completedAnswers = screen.getAllByText(firstQuestion.nogAnswer);
    expect(completedAnswers.some((answer) => answer.closest('[aria-live="polite"], [role="status"]'))).toBe(true);
    expect(screen.getByText(/got it/i)).toBeVisible();
    expect(screen.getByText(firstQuestion.concepts[0].concept)).toBeVisible();
  });

  it("reveals the full answer and verdict immediately with reduced motion", async () => {
    await renderPlay();
    vi.useFakeTimers();
    await startWithTimers();

    expect(screen.getAllByText(firstQuestion.nogAnswer).some((answer) =>
      answer.closest('[aria-live="polite"], [role="status"]'),
    )).toBe(true);
    expect(screen.getByText(/got it/i)).toBeVisible();
  });

  it("shows one question at a time and updates quiz progress on Next and Previous", async () => {
    const user = userEvent.setup();
    await renderPlay();
    await user.click(startButton());

    expect(await screen.findByText(firstQuestion.prompt)).toBeVisible();
    expectProgress(1);
    expect(screen.queryByText(secondQuestion.prompt)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByText(secondQuestion.prompt)).toBeVisible();
    expectProgress(2);
    expect(screen.queryByText(firstQuestion.prompt)).not.toBeInTheDocument();
    expect(screen.getByText(/^missed$/i)).toBeVisible();
    expect(screen.getByText(secondQuestion.concepts[0].concept)).toBeVisible();
    expect(screen.getByText(card.label)).toBeVisible();
    expect(screen.getByRole("button", { name: "See results →" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText(firstQuestion.prompt)).toBeVisible();
    expectProgress(1);
    expect(screen.queryByText(secondQuestion.prompt)).not.toBeInTheDocument();
    expect(runQuickCheckAction).toHaveBeenCalledExactlyOnceWith(checkInput);
  });

  it("shows result stats and meter gain, and expands the missed question for review", async () => {
    const user = userEvent.setup();
    await renderPlay();
    await openResults(user);

    expect(screen.getByRole("heading", { level: 2, name: "Keep teaching!" })).toBeVisible();
    expect(screen.getByText(/you got 1 out of 2 correct!/i)).toBeVisible();
    for (const stat of [/\b1\s*correct\b/i, /\b1\s*incorrect\b/i, /\b50%\s*score\b/i, /\+\s*1\s*xp\s*training/i]) {
      expectResultStat(stat);
    }
    expect(screen.getByText(/question review/i)).toBeVisible();
    expect(screen.getByText(firstQuestion.prompt)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Fix in Bath" })).not.toBeInTheDocument();

    const reviewToggle = screen.getByText(secondQuestion.prompt);
    await user.click(reviewToggle);
    expect(screen.getByText(secondQuestion.nogAnswer)).toBeVisible();
    expect(screen.getByText(secondQuestion.concepts[0].concept)).toBeVisible();
    expect(screen.getByText(card.label)).toBeVisible();
    expect(screen.getByRole("link", { name: "Fix in Bath" })).toHaveAttribute("href", `${roomHref}?teach=bath&topic=${tcp.id}`);
    expect(screen.getByRole("link", { name: "Continue Training" })).toHaveAttribute("href", `${roomHref}?teach=feed&topic=${tcp.id}`);

    await user.click(reviewToggle);
    expect(screen.queryByRole("link", { name: "Fix in Bath" })).not.toBeInTheDocument();
  });

  it("shows an improved result on retake after saving the prefilled Feed correction", async () => {
    const user = userEvent.setup();
    let revisedBody = originalPage.body;
    reviseLessonAction.mockImplementation(async (input) => {
      revisedBody = input.body;
      return savedResult({ ...originalPage, body: input.body });
    });
    runQuickCheckAction.mockImplementation(async () => revisedBody === correctedLesson ? improvedCheck : initialCheck);
    const play = await renderPlay();
    await openResults(user);
    expect(screen.getByText(/you got 1 out of 2 correct!/i)).toBeVisible();
    await user.click(screen.getByText(secondQuestion.prompt));
    const bath = screen.getByRole<HTMLAnchorElement>("link", { name: "Fix in Bath" });
    expect(bath.pathname).toBe(roomHref);
    const bathParams = new URLSearchParams(bath.search);
    expect(bathParams.get("teach")).toBe("bath");
    const topic = bathParams.get("topic");
    expect(topic).toBe(tcp.id);
    play.unmount();

    // Bath belongs to the later care loop. Use its planned Feed destination for this missed card.
    window.history.replaceState(null, "", `${roomHref}/feed?topic=${topic}&card=${card.id}`);
    const feed = render(await FeedPage({
      params: Promise.resolve({ id: nog.id }),
      searchParams: Promise.resolve({ topic: topic ?? undefined, card: card.id }),
    }));
    expect(screen.getByRole("heading", { name: `Fixing: ${card.label}` })).toBeVisible();
    const drawer = within(screen.getByRole("region", { name: `${nog.name}'s thought cards` }));
    expect(drawer.getByRole("button", { expanded: true })).toBeVisible();
    const highlightedCard = drawer.getByRole("listitem");
    expect(highlightedCard).toHaveTextContent(card.label);
    expect(highlightedCard.className).not.toMatch(/\bring-2\b/);
    const lesson = screen.getByRole("textbox", { name: "Your lesson" });
    expect(lesson).toHaveValue(card.quote);
    fireEvent.change(lesson, { target: { value: correctedLesson } });
    await user.click(screen.getByRole("button", { name: "Feed" }));
    expect(reviseLessonAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      ...checkInput, lessonId: originalPage.id, body: correctedLesson,
    }));
    expect(await screen.findByRole("heading", { name: "Lesson Saved Successfully" })).toBeVisible();
    feed.unmount();

    await renderPlay(tcp.id);
    await openResults(user);
    expect(screen.getByRole("heading", { level: 2, name: "Great Job!" })).toBeVisible();
    expect(screen.getByText(/you got 2 out of 2 correct!/i)).toBeVisible();
    expectResultStat(/\b100%\s*score\b/i);
    expect(screen.getByRole("link", { name: "Continue Training" })).toHaveAttribute("href", roomHref);
    await user.click(screen.getByText(secondQuestion.prompt));
    expect(screen.getByText(correctedAnswer)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Fix in Bath" })).not.toBeInTheDocument();
    expect(runQuickCheckAction.mock.calls).toEqual([[checkInput], [checkInput]]);
  });

  it("wires question count stepper, format chips, topic generation, and study file upload in setup", async () => {
    const user = userEvent.setup();
    teachLessonAction.mockResolvedValueOnce(savedResult(originalPage));
    addTopicAction.mockResolvedValueOnce({
      status: "ok",
      topic: {
        id: "topic-http",
        subjectId: tcp.subjectId,
        slug: "http-caching",
        title: "HTTP Caching",
        status: "ready",
        questionCount: 6,
      },
    });
    await renderPlay();

    // Adjust question count from default 5 to 7 and narrow formats
    await user.click(screen.getByRole("button", { name: "More questions" }));
    await user.click(screen.getByRole("button", { name: "More questions" }));
    expect(screen.getByText("7 Qs")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /list/i }));
    await user.click(screen.getByRole("button", { name: /short/i }));
    // Cannot disable the final remaining format chip
    await user.click(screen.getByRole("button", { name: /choices/i }));
    expect(screen.getByRole("button", { name: /choices/i })).toHaveAttribute("aria-pressed", "true");

    // Upload a study text file into the selected topic
    await user.click(screen.getByRole("button", { name: /add by file/i }));
    const fileInput = screen.getByLabelText(/upload study notes file/i);
    const notesFile = new File(["TCP establishes a connection with SYN, SYN-ACK, and ACK."], "tcp-notes.txt", {
      type: "text/plain",
    });
    await user.upload(fileInput, notesFile);
    expect(await screen.findByText(/tcp-notes\.txt/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: new RegExp(`teach file to ${nog.name}`, "i") }));
    expect(await screen.findByText(/taught 1 study note/i)).toBeVisible();
    expect(teachLessonAction).toHaveBeenCalledWith(
      expect.objectContaining({
        nogId: nog.id,
        topicId: tcp.id,
        body: "TCP establishes a connection with SYN, SYN-ACK, and ACK.",
      }),
    );

    // Generate a new topic via the inline Generate with AI drawer
    await user.click(screen.getByRole("button", { name: /generate with ai/i }));
    await user.type(screen.getByLabelText(/new quiz topic title/i), "HTTP Caching");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(await screen.findByText(/ready! "http caching" has 6 questions/i)).toBeVisible();
    expect(addTopicAction).toHaveBeenCalledWith(nog.id, "HTTP Caching");

    // Starting the quiz sends the chosen question count & format list
    await user.click(startButton());
    expect(runQuickCheckAction).toHaveBeenCalledWith({
      nogId: nog.id,
      topicId: "topic-http",
      questionCount: 7,
      formats: ["mc"],
    });
  });
});
