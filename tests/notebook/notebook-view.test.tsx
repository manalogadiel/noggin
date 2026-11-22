// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { LessonPage, ThoughtCardRecord, TopicSummary } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import type { AddTopicInput, AddTopicResult } from "@/core/application/use-cases/add-topic";
import { getNogRoom } from "@/core/application/use-cases/get-nog-room";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import { dns, firstPage, followUp, nog, synCard, tcp, tls } from "./fixtures";

type Notebook = {
  status: "ok";
  topic: TopicSummary;
  pages: LessonPage[];
  thoughtCards: ThoughtCardRecord[];
};

const { addTopic, listTopics, getTopicNotebook } = vi.hoisted(() => ({
  addTopic: vi.fn<(input: AddTopicInput) => Promise<AddTopicResult>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
  getTopicNotebook: vi.fn<
    (input: { nogId: string; topicId: string }) => Promise<Notebook | { status: "not_found" }>
  >(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    addTopic,
    listTopics,
    getTopicNotebook,
    getNogRoom: (input: { nogId: string }) =>
      getNogRoom(createInMemoryPorts({ userId: nog.ownerId, nogs: [nog] }).deps, input),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-nog-scene={scene} />,
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

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ topic?: string }>;
};
type ErrorProps = { error: Error; reset: () => void; retry: () => void };

const route = "../../src/app/(app)/nogs/[id]/notebook";
const pages = import.meta.glob<{ default: (props: PageProps) => Promise<ReactElement> }>(
  "../../src/app/*/nogs/*/notebook/page.tsx",
);
const loadingFiles = import.meta.glob<{ default: ComponentType }>(
  "../../src/app/*/nogs/*/notebook/loading.tsx",
);
const errorFiles = import.meta.glob<{ default: ComponentType<ErrorProps> }>(
  "../../src/app/*/nogs/*/notebook/error.tsx",
);

const roomHref = `/nogs/${nog.id}`;
const notebookHref = `${roomHref}/notebook`;
const pending = { ...tls, status: "pending", questionCount: 0 } satisfies TopicSummary;
let topics: TopicSummary[];

// Follow the rendered same-page links in jsdom, which does not implement browser navigation.
function followTopicLink(event: MouseEvent) {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (link?.pathname !== notebookHref || !link.search) return;
  event.preventDefault();
  window.history.pushState(null, "", link.href);
}

beforeEach(() => {
  topics = [tcp, dns];
  addTopic.mockReset();
  listTopics.mockReset().mockImplementation(async () => ({ status: "ok", topics: [...topics] }));
  getTopicNotebook.mockReset().mockImplementation(async ({ topicId }) => {
    const topic = topics.find(({ id }) => id === topicId);
    if (!topic) return { status: "not_found" };
    return {
      status: "ok",
      topic,
      pages: topic.id === tcp.id ? [firstPage, followUp] : [],
      thoughtCards: topic.id === tcp.id ? [synCard] : [],
    };
  });
  document.addEventListener("click", followTopicLink);
});

afterEach(() => {
  cleanup();
  document.removeEventListener("click", followTopicLink);
  window.history.replaceState(null, "", "/");
});

async function renderNotebook(href = notebookHref) {
  window.history.replaceState(null, "", href);
  const { default: Page } = await pages[`${route}/page.tsx`]();
  function currentPage() {
    const topic = new URLSearchParams(window.location.search).get("topic");
    return Page({
      params: Promise.resolve({ id: nog.id }),
      searchParams: Promise.resolve(topic ? { topic } : {}),
    });
  }
  const { rerender } = render(await currentPage());
  return {
    async refresh() {
      rerender(await currentPage());
    },
  };
}

async function submitTopic(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: /add topic/i }));
  const field = screen.getByRole("textbox", { name: "New topic" });
  await user.type(field, title);
  await user.click(screen.getByRole("button", { name: "Add" }));
  return field;
}

async function expectSelected(topic: TopicSummary, refresh: () => Promise<void>) {
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("topic")).toBe(topic.id));
  await refresh();
  expect(screen.getByRole("heading", { level: 2, name: topic.title })).toBeVisible();
}

function lessonTitle(lesson: LessonPage) {
  const preview = lesson.body.slice(0, 80).trimEnd();
  return screen.getByText((text) => text.replace(/\s*(?:\.{3}|…)$/, "") === preview);
}

describe("Notebook", () => {
  it("lists topics, opens the first topic, and displays its pages and thought cards", async () => {
    const user = userEvent.setup();
    await renderNotebook();

    expect(screen.getByRole("heading", { level: 1, name: "Notebook" })).toBeVisible();
    expect(listTopics).toHaveBeenCalledWith({ nogId: nog.id });
    expect(getTopicNotebook).toHaveBeenCalledWith({ nogId: nog.id, topicId: tcp.id });
    expect(screen.getByRole("heading", { level: 2, name: tcp.title })).toBeVisible();
    expect(screen.getByText(dns.title)).toBeVisible();
    const firstTitle = lessonTitle(firstPage);
    const secondTitle = lessonTitle(followUp);
    expect(firstTitle.compareDocumentPosition(secondTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(/^Taught\s+\S/i)).toHaveLength(2);

    const fullText = screen.queryByText(firstPage.body);
    if (fullText) expect(fullText).not.toBeVisible();
    await user.click(firstTitle);
    expect(screen.getByText(firstPage.body)).toBeVisible();

    expect(screen.getByRole("heading", { name: `What ${nog.name} thinks` })).toBeVisible();
    expect(screen.getByText(synCard.label)).toBeVisible();
    expect(screen.getByText(synCard.paraphrase)).toBeVisible();
    expect(screen.getByText(/^shaky$/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Teach this topic" })).toHaveAttribute("href", `${roomHref}/feed?topic=${tcp.id}`);
    expect(screen.getByRole("link", { name: "Quick check" })).toHaveAttribute("href", `${roomHref}/play?topic=${tcp.id}`);

    const rail = within(screen.getByRole("navigation"));
    expect(rail.getByRole("link", { name: "Notebook" })).toHaveAttribute("href", notebookHref);
    expect(rail.getByRole("link", { name: "Analysis" })).toHaveAttribute("href", `${roomHref}/analysis`);
  });

  it("filters topics case-insensitively without fetching a new list", async () => {
    const user = userEvent.setup();
    await renderNotebook(`${notebookHref}?topic=${dns.id}`);
    const search = screen.getByRole("searchbox", { name: "Find a topic" });
    const initialReads = listTopics.mock.calls.length;

    expect(screen.getByText(tcp.title)).toBeVisible();
    await user.type(search, "dNs");
    expect(screen.queryByText(tcp.title)).not.toBeInTheDocument();
    expect(screen.getAllByText(dns.title)).toHaveLength(2);
    expect(listTopics).toHaveBeenCalledTimes(initialReads);

    await user.clear(search);
    expect(screen.getByText(tcp.title)).toBeVisible();
  });

  it("restores the selected topic from the URL and writes a newly selected topic to it", async () => {
    const user = userEvent.setup();
    const { refresh } = await renderNotebook(`${notebookHref}?topic=${dns.id}`);

    expect(screen.getByRole("heading", { level: 2, name: dns.title })).toBeVisible();
    expect(getTopicNotebook).toHaveBeenCalledWith({ nogId: nog.id, topicId: dns.id });
    await user.click(screen.getByText(tcp.title));
    await expectSelected(tcp, refresh);
    expect(screen.getByText(synCard.label)).toBeVisible();
  });

  it("links an untaught topic to Feed for that topic", async () => {
    await renderNotebook(`${notebookHref}?topic=${dns.id}`);

    expect(screen.getByText("Nothing taught yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Teach this topic" })).toHaveAttribute("href", `${roomHref}/feed?topic=${dns.id}`);
    expect(screen.queryByText(synCard.label)).not.toBeInTheDocument();
  });

  it("opens and focuses the add form from an empty notebook", async () => {
    const user = userEvent.setup();
    topics = [];
    await renderNotebook();

    expect(screen.getByText("Nothing taught yet")).toBeVisible();
    expect(getTopicNotebook).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Add your first topic" }));
    expect(screen.getByRole("textbox", { name: "New topic" })).toHaveFocus();
  });

  it("labels a pending topic and disables Quick check with a reason", async () => {
    topics.push(pending);
    await renderNotebook(`${notebookHref}?topic=${pending.id}`);

    expect(screen.getByText(/^writing\s*(?:…|\.{3})$/i)).toBeVisible();
    expect(screen.getByText(/questions are being written/i)).toBeVisible();
    const check = screen.queryByRole("button", { name: "Quick check" }) ??
      screen.getByRole("link", { name: "Quick check" });
    if (check.hasAttribute("aria-disabled")) {
      expect(check).toHaveAttribute("aria-disabled", "true");
      if (check.hasAttribute("href")) {
        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        expect(check.dispatchEvent(click)).toBe(false);
      }
    } else {
      expect(check).toBeDisabled();
    }
  });

  it("submits a new topic and selects it when its questions are ready", async () => {
    const user = userEvent.setup();
    addTopic.mockImplementation(async () => {
      topics.push(tls);
      return { status: "ok", topic: tls };
    });
    const { refresh } = await renderNotebook();

    await submitTopic(user, tls.title);
    expect(addTopic).toHaveBeenCalledExactlyOnceWith({ nogId: nog.id, title: tls.title });
    await expectSelected(tls, refresh);
  });

  it("explains that questions are pending and retries the same topic", async () => {
    const user = userEvent.setup();
    addTopic.mockImplementationOnce(async () => {
      topics.push(pending);
      return { status: "pending", topic: pending };
    }).mockImplementationOnce(async () => {
      topics = [tcp, dns, tls];
      return { status: "ok", topic: tls };
    });
    const { refresh } = await renderNotebook();

    await submitTopic(user, tls.title);
    const messages = await screen.findAllByText(/your nog['’]s questions are being written/i);
    expect(messages[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(addTopic.mock.calls).toEqual([
      [{ nogId: nog.id, title: tls.title }],
      [{ nogId: nog.id, title: tls.title }],
    ]);
    await expectSelected(tls, refresh);
  });

  it("shows the daily quota message when adding a topic is deferred", async () => {
    const user = userEvent.setup();
    addTopic.mockResolvedValue({ status: "tired_for_today" });
    await renderNotebook();

    await submitTopic(user, tls.title);
    expect(await screen.findByText(/your nog is tired for today.*try again tomorrow/i)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: tcp.title })).toBeVisible();
  });

  it("associates an invalid-title response with the New topic field", async () => {
    const user = userEvent.setup();
    addTopic.mockResolvedValue({ status: "invalid_title" });
    await renderNotebook();

    const field = await submitTopic(user, "!!!");
    await waitFor(() => {
      expect(field).toBeInvalid();
      if (field.hasAttribute("aria-errormessage")) {
        expect(field).toHaveAccessibleErrorMessage(/\S/);
      } else {
        expect(field).toHaveAccessibleDescription(/\S/);
      }
    });
    expect(field).toHaveValue("!!!");
  });

  it("selects the existing topic and explains the duplicate", async () => {
    const user = userEvent.setup();
    addTopic.mockResolvedValue({ status: "already_exists", topic: dns });
    const { refresh } = await renderNotebook();

    await submitTopic(user, dns.title);
    await expectSelected(dns, refresh);
    expect(screen.getByText(/already exists|already in (?:your|the) notebook|already have/i)).toBeVisible();
  });

  it("exposes the loading skeleton as busy", async () => {
    const load = loadingFiles[`${route}/loading.tsx`];
    if (!load) throw new Error("Missing Notebook route loading.tsx");
    const { default: Loading } = await load();

    const { container } = render(<Loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
    expect(screen.queryByText("Nothing taught yet")).not.toBeInTheDocument();
  });

  it("shows Brain fog and retries the route from its error boundary", async () => {
    const load = errorFiles[`${route}/error.tsx`];
    if (!load) throw new Error("Missing Notebook route error.tsx");
    const { default: ErrorFallback } = await load();
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorFallback error={new Error("Could not load notebook")} reset={retry} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Brain fog 😵");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
