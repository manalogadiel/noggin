// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/(app)/nogs/[id]/feed/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { LessonPage, TopicSummary } from "@/core/application/ports";
import type { AddTopicResult } from "@/core/application/use-cases/add-topic";
import type { AnswerFollowUpInput, AnswerFollowUpResult } from "@/core/application/use-cases/answer-follow-up";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { GetTopicNotebookResult } from "@/core/application/use-cases/get-topic-notebook";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import type { ReviseLessonInput, ReviseLessonResult } from "@/core/application/use-cases/revise-lesson";
import type { TeachLessonInput, TeachLessonResult } from "@/core/application/use-cases/teach-lesson";
import { card, digest, dns, nog, originalPage, savedPage, savedResult, tcp, tls } from "./fixtures";

const {
  addTopicAction,
  answerFollowUpAction,
  reviseLessonAction,
  teachLessonAction,
  getNogRoom,
  getTopicNotebook,
  listTopics,
} = vi.hoisted(() => ({
  addTopicAction: vi.fn<(nogId: string, title: string) => Promise<AddTopicResult>>(),
  answerFollowUpAction: vi.fn<(input: AnswerFollowUpInput) => Promise<AnswerFollowUpResult>>(),
  reviseLessonAction: vi.fn<(input: ReviseLessonInput) => Promise<ReviseLessonResult>>(),
  teachLessonAction: vi.fn<(input: TeachLessonInput) => Promise<TeachLessonResult>>(),
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  getTopicNotebook: vi.fn<(input: { nogId: string; topicId: string }) => Promise<GetTopicNotebookResult>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
}));

vi.mock("@/app/(app)/actions/topic-actions", () => ({ addTopicAction }));
vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  addTopicAction,
  answerFollowUpAction,
  reviseLessonAction,
  teachLessonAction,
}));
vi.mock("@/composition/container", () => ({
  createContainer: async () => ({ getNogRoom, getTopicNotebook, listTopics }),
}));
vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-testid={"nog-scene-" + scene} />,
}));
vi.mock("next/navigation", async (importOriginal) => {
  const router = {
    push: (href: string) => window.history.pushState(null, "", href),
    replace: (href: string) => window.history.replaceState(null, "", href),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    ...await importOriginal<typeof import("next/navigation")>(),
    useRouter: () => router,
    usePathname: () => window.location.pathname,
    useSearchParams: () => new URLSearchParams(window.location.search),
  };
});

const roomHref = "/nogs/" + nog.id;
const feedHref = roomHref + "/feed";
const pendingTls: TopicSummary = { ...tls, status: "pending", questionCount: 0 };
const lessonText = "A client sends SYN to start a connection.";
const answerLabel = /^Answer Pingu(?:…|\.{3})?$/i;
const noQuestions = { ...digest, followUpQuestions: [] };
let topics: TopicSummary[];
let pages: LessonPage[];

// jsdom needs help following Feed links before the test rerenders the route.
function followFeedLink(event: MouseEvent) {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (link?.pathname !== feedHref) return;
  event.preventDefault();
  window.history.pushState(null, "", link.href);
}

beforeEach(() => {
  vi.resetAllMocks();
  topics = [tcp, dns];
  pages = [];
  const cards = () => pages.some((page) => page.id === originalPage.id) ? [card] : [];
  listTopics.mockImplementation(async () => ({ status: "ok", topics: [...topics] }));
  getNogRoom.mockImplementation(async () => ({
    status: "ok",
    nog,
    vitals: { happiness: 0.7, clarity: 0, vitality: 1, faint: false },
    cards: cards().map((card) => ({ ...card, freshness: "fresh" })),
  }));
  getTopicNotebook.mockImplementation(async ({ topicId }) => {
    const topic = topics.find(({ id }) => id === topicId);
    if (!topic) return { status: "not_found" };
    return {
      status: "ok",
      topic,
      pages: pages.filter((page) => page.topicId === topicId),
      thoughtCards: cards().filter((card) => card.topicId === topicId),
    };
  });
  teachLessonAction.mockImplementation(async (input) => savedResult(savedPage(input)));
  answerFollowUpAction.mockImplementation(async (input) => savedResult({
    ...savedPage(input),
    kind: "follow_up_answer",
    parentLessonId: input.lessonId,
  }, { ...noQuestions, reply: "That clears it up!" }));
  reviseLessonAction.mockImplementation(async (input) => savedResult({
    ...savedPage(input),
    parentLessonId: input.lessonId,
  }, noQuestions));
  document.addEventListener("click", followFeedLink);
});

afterEach(() => {
  cleanup();
  document.removeEventListener("click", followFeedLink);
  window.history.replaceState(null, "", "/");
});

function currentFeedPage() {
  const route = {
    params: Promise.resolve({ id: nog.id }),
    searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search))),
  };
  return FeedPage(route);
}

async function renderFeed(href = feedHref + "?topic=" + tcp.id) {
  window.history.replaceState(null, "", href);
  const view = render(await currentFeedPage());
  return async (topic: TopicSummary) => {
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("topic")).toBe(topic.id);
    });
    view.rerender(await currentFeedPage());
    expect(screen.getByRole("heading", { level: 1, name: "Feed" })).toBeVisible();
    expect(screen.getByText(topic.title, { exact: true })).toBeVisible();
  };
}

function lessonEditor() {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Your lesson" });
}

function feedButton() {
  return screen.getByRole("button", { name: /^Feed$/i });
}

function savedHeading() {
  return screen.findByRole("heading", { level: 1, name: "Lesson Saved Successfully" });
}

async function submitTopic(user: ReturnType<typeof userEvent.setup>, title: string) {
  const input = screen.getByRole("textbox", { name: "Enter a Topic" });
  await user.type(input, title);
  await user.click(screen.getByRole("button", { name: /^Start Teaching\b/i }));
  return input;
}

async function submitLesson(user: ReturnType<typeof userEvent.setup>, text = lessonText) {
  fireEvent.change(lessonEditor(), { target: { value: text } });
  await user.click(feedButton());
}

describe("Feed topic picker", () => {
  it("lists the Nog's existing topics and opens the one the learner picks", async () => {
    const user = userEvent.setup();
    const showTopic = await renderFeed(feedHref);

    expect(screen.getByRole("heading", { level: 1, name: "What will you teach me?" })).toBeVisible();
    expect(screen.getByText("Or pick one")).toBeVisible();
    expect(screen.getByTestId("nog-scene-peek")).toBeVisible();
    expect(listTopics).toHaveBeenCalledWith({ nogId: nog.id });
    expect(screen.getByText(tcp.title)).toBeVisible();
    await user.click(screen.getByText(dns.title));
    await showTopic(dns);

    expect(lessonEditor()).toHaveAttribute("placeholder", expect.stringContaining(dns.title));
    expect(addTopicAction).not.toHaveBeenCalled();
  });

  it("adds a topic and starts teaching that topic when it is ready", async () => {
    const user = userEvent.setup();
    const showTopic = await renderFeed(feedHref);
    addTopicAction.mockImplementationOnce(async () => {
      topics.push(tls);
      return { status: "ok", topic: tls };
    });

    await submitTopic(user, tls.title);
    expect(addTopicAction).toHaveBeenCalledExactlyOnceWith(nog.id, tls.title);
    await showTopic(tls);
    await submitLesson(user, "A certificate binds a public key to a name.");
    expect(teachLessonAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      nogId: nog.id,
      topicId: tls.id,
      body: "A certificate binds a public key to a name.",
    }));
  });

  it("opens the pending topic for teaching and retries writing its questions", async () => {
    const user = userEvent.setup();
    const showTopic = await renderFeed(feedHref);
    addTopicAction
      .mockImplementationOnce(async () => {
        topics.push(pendingTls);
        return { status: "pending", topic: pendingTls };
      })
      .mockImplementationOnce(async () => {
        topics = [tcp, dns, tls];
        return { status: "ok", topic: tls };
      });

    await submitTopic(user, tls.title);
    await showTopic(pendingTls);
    expect(await screen.findByText(/questions are being written.*you can still teach it/i)).toBeVisible();
    fireEvent.change(lessonEditor(), { target: { value: "A certificate identifies a server." } });
    expect(feedButton()).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /^Retry\b/i }));

    await waitFor(() => expect(addTopicAction.mock.calls).toEqual([[nog.id, tls.title], [nog.id, tls.title]]));
    await showTopic(tls);
    expect(screen.queryByText(/questions are being written/i)).not.toBeInTheDocument();
  });

  it("keeps the picker open when topic generation is tired for today", async () => {
    const user = userEvent.setup();
    await renderFeed(feedHref);
    addTopicAction.mockResolvedValueOnce({ status: "tired_for_today" });

    await submitTopic(user, tls.title);

    expect(await screen.findByText(/your nog is tired for today/i)).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "What will you teach me?" })).toBeVisible();
    expect(window.location.search).toBe("");
  });

  it("associates an invalid title with the topic field and preserves the entry", async () => {
    const user = userEvent.setup();
    await renderFeed(feedHref);
    addTopicAction.mockResolvedValueOnce({ status: "invalid_title" });

    const input = await submitTopic(user, "!!!");

    await waitFor(() => expect(input).toBeInvalid());
    expect(input).toHaveValue("!!!");
    if (input.hasAttribute("aria-errormessage")) {
      expect(input).toHaveAccessibleErrorMessage(/\S/);
    } else {
      expect(input).toHaveAccessibleDescription(/\S/);
    }
    expect(window.location.search).toBe("");
  });

  it("opens the existing topic when the entered name is a duplicate", async () => {
    const user = userEvent.setup();
    const showTopic = await renderFeed(feedHref);
    addTopicAction.mockResolvedValueOnce({ status: "already_exists", topic: dns });

    await submitTopic(user, dns.title);

    await showTopic(dns);
    expect(await screen.findByText(/already exists|already in (?:your|the) notebook|already have/i)).toBeVisible();
  });
});

describe("Feed lesson editor", () => {
  it("updates the word count and accessible capacity meter while the learner types", async () => {
    const user = userEvent.setup();
    await renderFeed();

    expect(screen.getByText("Teach me about TCP handshake!")).toBeVisible();
    expect(screen.getByRole("meter", { name: /brain capacity/i, value: { now: 0, max: 120 } })).toBeVisible();
    await user.type(lessonEditor(), "Kumusta, teach me");
    expect(screen.getByText(/\b3\s*\/\s*120\b/)).toBeVisible();
    expect(screen.getByRole("meter", { name: /brain capacity/i, value: { now: 3, max: 120 } })).toBeVisible();
    expect(screen.getByRole("button", { name: /mic|record|voice/i })).toBeDisabled();
  });

  it("accepts 120 words and keeps the 121-word draft in the overload state", async () => {
    await renderFeed();
    const maxLength = Array(120).fill("SYN").join(" ");
    const overloaded = maxLength + " ACK";

    fireEvent.change(lessonEditor(), { target: { value: maxLength } });
    expect(screen.getByText(/\b120\s*\/\s*120\b/)).toBeVisible();
    expect(feedButton()).toBeEnabled();
    fireEvent.change(lessonEditor(), { target: { value: overloaded } });

    expect(screen.getByText(/\b121\s*\/\s*120\b/)).toBeVisible();
    expect(screen.getByText(/Too much! My brain is full!|Too much, boss! I can't keep up\./i)).toBeVisible();
    expect(screen.getByTestId("nog-scene-dizzy")).toBeVisible();
    expect(lessonEditor()).toHaveValue(overloaded);
    expect(screen.getByRole("button", { name: "Split lesson" })).toBeEnabled();
    const feed = screen.queryByRole("button", { name: /^Feed$/i });
    if (feed) expect(feed).toBeDisabled();
    expect(teachLessonAction).not.toHaveBeenCalled();
  });

  it("splits at the sentence boundary and feeds each part in order", async () => {
    const user = userEvent.setup();
    await renderFeed();
    teachLessonAction.mockImplementation(async (input) => savedResult(savedPage(input), noQuestions));
    const partOne = "The client sends " + "SYN ".repeat(56) + "first.";
    const partTwo = "The server returns " + "a SYN ".repeat(28) + "and ACK.";
    fireEvent.change(lessonEditor(), { target: { value: partOne + " " + partTwo } });

    await user.click(screen.getByRole("button", { name: "Split lesson" }));
    if (teachLessonAction.mock.calls.length === 0) {
      expect(lessonEditor().value.trim()).toBe(partOne);
      await user.click(feedButton());
    }

    await waitFor(() => expect(teachLessonAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(lessonEditor().value.trim()).toBe(partTwo));
    await user.click(feedButton());
    await waitFor(() => expect(teachLessonAction).toHaveBeenCalledTimes(2));

    const sent = teachLessonAction.mock.calls.map(([input]) => input);
    expect(sent.map(({ body }) => body.trim())).toEqual([partOne, partTwo]);
    expect(sent.map(({ topicId }) => topicId)).toEqual([tcp.id, tcp.id]);
    expect(sent[0].idempotencyKey).not.toBe(sent[1].idempotencyKey);
  });

  it("shows handshake-specific first-lesson tips for the official topic", async () => {
    await renderFeed();

    expect(screen.getByText(/\b(?:tips?|first lesson)\b/i)).toBeVisible();
    expect(screen.getByText(/\bSYN[-–]ACK\b/i)).toBeVisible();
  });

  it("shows generic first-lesson tips for a custom topic", async () => {
    topics.push(tls);
    await renderFeed(feedHref + "?topic=" + tls.id);

    expect(screen.getByText(/\b(?:tips?|first lesson)\b/i)).toBeVisible();
    expect(screen.queryByText(/\bSYN[-–]ACK\b/i)).not.toBeInTheDocument();
    expect(lessonEditor()).toBeEnabled();
  });
});

describe("Saving and revising a lesson", () => {
  it("announces saving and shows the reply and follow-ups alongside the saved lesson summary", async () => {
    const user = userEvent.setup();
    await renderFeed(feedHref + "?topic=" + dns.id);
    let respond!: (result: TeachLessonResult) => void;
    teachLessonAction.mockReturnValueOnce(new Promise((resolve) => { respond = resolve; }));
    const body = "A resolver looks up an address for a name.";
    const reply = {
      ...digest,
      reply: "I can find the address from the name now!",
      followUpQuestions: ["What does the resolver cache?", "When does the cached answer expire?"],
    };

    await submitLesson(user, body);
    expect(teachLessonAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      nogId: nog.id, topicId: dns.id, body, idempotencyKey: expect.stringMatching(/\S/),
    }));
    expect(screen.getByText(/chewing on that/i)).toBeVisible();
    await act(async () => respond(savedResult(savedPage(teachLessonAction.mock.calls[0][0]), reply)));

    expect(await savedHeading()).toBeVisible();
    expect(screen.getByText("Lesson Summary")).toBeVisible();
    expect(screen.getByText(dns.title, { exact: true })).toBeVisible();
    expect(screen.getByText("Saved to Notebook")).toBeVisible();
    const speech = screen.getByText(reply.reply);
    expect(speech).toBeVisible();
    expect(speech.closest('[aria-live="polite"], [role="status"], [role="log"]')).not.toBeNull();
    for (const question of reply.followUpQuestions) {
      expect(screen.getByText(question)).toBeVisible();
    }
    expect(screen.getAllByRole("textbox", { name: answerLabel })).toHaveLength(2);
    expect(screen.getByText(/what['’]s next\?/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute("href", roomHref + "/water");
    expect(screen.getByRole("link", { name: /quiz|quick check/i })).toHaveAttribute("href", roomHref + "/play?topic=" + dns.id);
    expect(screen.getByRole("link", { name: /rest/i })).toHaveAttribute("href", roomHref + "/rest");
    expect(screen.getByText("Notebook Updated")).toBeVisible();
    const notebook = screen.getByRole<HTMLAnchorElement>("link", { name: "View Notebook" });
    expect(notebook.pathname).toBe(roomHref + "/notebook");
  });

  it("opens Improve with the saved lesson text", async () => {
    const user = userEvent.setup();
    const showTopic = await renderFeed();
    teachLessonAction.mockImplementationOnce(async (input) => savedResult(savedPage(input), noQuestions));

    await submitLesson(user);
    expect(await savedHeading()).toBeVisible();
    expect(screen.queryByRole("textbox", { name: answerLabel })).not.toBeInTheDocument();
    const beforeImprove = window.location.href;
    await user.click(screen.getByRole("link", { name: /improve/i }));
    if (window.location.href !== beforeImprove) await showTopic(tcp);

    expect(await screen.findByRole("textbox", { name: "Your lesson" })).toHaveValue(lessonText);
    expect(teachLessonAction).toHaveBeenCalledTimes(1);
  });

  it("sends the answer against the saved lesson and leaves the second question available", async () => {
    const user = userEvent.setup();
    await renderFeed();

    await submitLesson(user);
    expect(await savedHeading()).toBeVisible();
    const [firstAnswer] = screen.getAllByRole("textbox", { name: answerLabel });
    const body = "The server sends SYN and ACK.";
    await user.type(firstAnswer, body);
    await user.click(screen.getAllByRole("button", { name: /^(send|submit|answer)\b/i })[0]);

    const taught = teachLessonAction.mock.calls[0][0];
    expect(answerFollowUpAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      nogId: nog.id,
      topicId: tcp.id,
      lessonId: savedPage(taught).id,
      body,
      idempotencyKey: expect.stringMatching(/\S/),
    }));
    expect(await screen.findByText("That clears it up!")).toBeVisible();
    expect(screen.getByText(digest.followUpQuestions[1])).toBeVisible();
    expect(screen.getAllByRole("textbox", { name: answerLabel })).toHaveLength(1);
    expect(teachLessonAction).toHaveBeenCalledTimes(1);
  });

  it("says the lesson is saved on brain fog and retries with the same idempotency key", async () => {
    const user = userEvent.setup();
    await renderFeed();
    teachLessonAction.mockImplementationOnce(async (input) => ({ status: "brain_fog", page: savedPage(input) }));

    await submitLesson(user);
    expect(await screen.findByText(/brain fog.*your lesson is saved/i)).toBeVisible();
    const firstInput = teachLessonAction.mock.calls[0][0];
    expect(firstInput.idempotencyKey).toMatch(/\S/);
    await user.click(screen.getByRole("button", { name: /^Retry$/i }));

    expect(await savedHeading()).toBeVisible();
    expect(teachLessonAction.mock.calls).toEqual([[firstInput], [firstInput]]);
  });

  it("shows the daily teaching limit and keeps the unsaved draft", async () => {
    const user = userEvent.setup();
    await renderFeed();
    teachLessonAction.mockResolvedValueOnce({ status: "tired_for_today" });

    await submitLesson(user);

    expect(await screen.findByText(/your nog is tired for today/i)).toBeVisible();
    expect(lessonEditor()).toHaveValue(lessonText);
    expect(screen.queryByRole("heading", { name: "Lesson Saved Successfully" })).not.toBeInTheDocument();
  });

  it("prefills the card's quote from ?card and revises the linked source lesson", async () => {
    const user = userEvent.setup();
    pages = [originalPage];
    await renderFeed(feedHref + "?card=" + card.id);

    expect(screen.getByRole("heading", { name: "Fixing: " + card.label })).toBeVisible();
    expect(lessonEditor()).toHaveValue(card.quote);
    const body = "The client sends a SYN segment to request a connection.";
    await submitLesson(user, body);

    expect(reviseLessonAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      nogId: nog.id,
      topicId: tcp.id,
      lessonId: card.sourceLessonId,
      body,
      idempotencyKey: expect.stringMatching(/\S/),
    }));
    expect(teachLessonAction).not.toHaveBeenCalled();
    expect(await savedHeading()).toBeVisible();
  });
});
