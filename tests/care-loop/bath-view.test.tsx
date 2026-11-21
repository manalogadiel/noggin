// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BathPage from "@/app/(app)/nogs/[id]/bath/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { CheckAttemptRecord } from "@/core/application/ports";
import type { GetNogAnalysisResult } from "@/core/application/use-cases/get-nog-analysis";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { GetTopicNotebookResult } from "@/core/application/use-cases/get-topic-notebook";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import type {
  ReviseLessonInput,
  ReviseLessonResult,
} from "@/core/application/use-cases/revise-lesson";
import {
  confusedCard,
  dns,
  dnsPage,
  freshUnderstoodCard,
  hiddenReferenceAnswer,
  missedAttempt,
  nog,
  originalPage,
  passedAttempt,
  revisionDigest,
  shakyCard,
  tcp,
  toRecord,
} from "./fixtures";

type AnalysisWithAttempts = GetNogAnalysisResult & {
  attempts?: CheckAttemptRecord[];
};

const {
  getNogRoom,
  getNogAnalysis,
  listTopics,
  getTopicNotebook,
  reviseLesson,
} = vi.hoisted(() => ({
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  getNogAnalysis:
    vi.fn<(input: { nogId: string }) => Promise<AnalysisWithAttempts>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
  getTopicNotebook:
    vi.fn<
      (input: {
        nogId: string;
        topicId: string;
      }) => Promise<GetTopicNotebookResult>
    >(),
  reviseLesson:
    vi.fn<(input: ReviseLessonInput) => Promise<ReviseLessonResult>>(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogRoom,
    getNogAnalysis,
    listTopics,
    getTopicNotebook,
    reviseLesson,
  }),
}));

vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  reviseLessonAction: reviseLesson,
  teachLessonAction: vi.fn(),
  answerFollowUpAction: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => (
    <div data-testid={`nog-scene-${scene}`} />
  ),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const router = {
    push: (href: string) => window.history.pushState(null, "", href),
    replace: (href: string) => window.history.replaceState(null, "", href),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    ...(await importOriginal<typeof import("next/navigation")>()),
    useRouter: () => router,
    usePathname: () => window.location.pathname,
    useSearchParams: () => new URLSearchParams(window.location.search),
  };
});

const roomHref = `/nogs/${nog.id}`;
const bathHref = `${roomHref}/bath`;

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", bathHref);

  listTopics.mockResolvedValue({ status: "ok", topics: [tcp, dns] });
  getNogRoom.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.75, clarity: 0.33, vitality: 0.85, faint: false },
    cards: [freshUnderstoodCard, shakyCard, confusedCard],
  });
  getNogAnalysis.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.75, clarity: 0.33, vitality: 0.85, faint: false },
    cards: [freshUnderstoodCard, shakyCard, confusedCard],
    masteredCount: 1,
    stage: "Hatchling",
    attempts: [passedAttempt, missedAttempt],
  });
  getTopicNotebook.mockImplementation(async ({ topicId }) => {
    if (topicId === tcp.id) {
      return {
        status: "ok",
        topic: tcp,
        pages: [originalPage],
        thoughtCards: [toRecord(freshUnderstoodCard), toRecord(shakyCard)],
      };
    }
    if (topicId === dns.id) {
      return {
        status: "ok",
        topic: dns,
        pages: [dnsPage],
        thoughtCards: [toRecord(confusedCard)],
      };
    }
    return { status: "not_found" };
  });
  reviseLesson.mockImplementation(async (input) => ({
    status: "ok",
    page: {
      ...originalPage,
      id: `revised-${input.lessonId}`,
      topicId: input.topicId,
      body: input.body,
      parentLessonId: input.lessonId,
      idempotencyKey: input.idempotencyKey,
    },
    digest: revisionDigest,
    applied: { applied: true, cardIds: [shakyCard.id] },
  }));
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

type BathRoutePage = (props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ card?: string; topic?: string }>;
}) => Promise<ReactElement>;

async function renderBath(searchParams: { card?: string; topic?: string } = {}) {
  const query = new URLSearchParams();
  if (searchParams.card) query.set("card", searchParams.card);
  if (searchParams.topic) query.set("topic", searchParams.topic);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  window.history.replaceState(null, "", `${bathHref}${suffix}`);

  const Page = BathPage as unknown as BathRoutePage;
  return render(
    await Page({
      params: Promise.resolve({ id: nog.id }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

describe("Bath repair flow (/nogs/[id]/bath)", () => {
  it("lists shaky and confused cards and recent Quick Check misses alongside the room rail, without showing understood cards or hidden reference answers", async () => {
    await renderBath({ card: shakyCard.id });

    expect(
      screen.getByRole("heading", { level: 1, name: "Missed Concept" }),
    ).toBeVisible();
    expect(screen.getAllByText(shakyCard.label).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText(confusedCard.label).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(freshUnderstoodCard.label),
    ).not.toBeInTheDocument();

    expect(screen.getByText(/Nog Answer/i)).toBeVisible();
    expect(screen.getByText(shakyCard.paraphrase)).toBeVisible();
    expect(screen.getByText(/What it missed/i)).toBeVisible();
    expect(
      screen.getByText(/Explain these in your own words/i),
    ).toBeVisible();
    expect(screen.getByText("SYN-ACK segment")).toBeVisible();
    expect(
      screen.getByText("sequence number acknowledgment"),
    ).toBeVisible();
    expect(
      screen.queryByText(hiddenReferenceAnswer),
    ).not.toBeInTheDocument();

    const fixInFeed = screen.getByRole<HTMLAnchorElement>("link", {
      name: /fix this thought/i,
    });
    expect(fixInFeed.pathname).toBe(`${roomHref}/feed`);
    expect(new URLSearchParams(fixInFeed.search).get("card")).toBe(
      shakyCard.id,
    );

    const rail = within(
      screen.getByRole("navigation", { name: /nog room sections/i }),
    );
    expect(rail.getByRole("link", { name: "Room" })).toHaveAttribute(
      "href",
      roomHref,
    );
    expect(rail.getByRole("link", { name: "Check" })).toHaveAttribute(
      "href",
      `${roomHref}/play`,
    );
  });

  it("preselects the item matching ?card= or ?topic= from the URL", async () => {
    const first = await renderBath({ card: confusedCard.id });

    expect(screen.getByText(confusedCard.paraphrase)).toBeVisible();
    const fixConfused = screen.getByRole<HTMLAnchorElement>("link", {
      name: /fix this thought/i,
    });
    expect(new URLSearchParams(fixConfused.search).get("card")).toBe(
      confusedCard.id,
    );
    first.unmount();

    await renderBath({ topic: tcp.id });
    expect(screen.getByText(shakyCard.paraphrase)).toBeVisible();
  });

  it("opens the Revise view prefilled with the card's original lesson, saves the revision via reviseLesson, and links Rerun Check to play?topic", async () => {
    const user = userEvent.setup();
    await renderBath({ card: shakyCard.id });

    await user.click(screen.getByRole("button", { name: /^Revise$/i }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Revise" }),
    ).toBeVisible();

    const editor = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect([originalPage.body, shakyCard.quote]).toContain(editor.value);

    const updatedLesson =
      "The client sends SYN with its initial sequence number, and the server replies with SYN-ACK acknowledging that sequence number.";
    fireEvent.change(editor, { target: { value: updatedLesson } });

    await user.click(screen.getByRole("button", { name: /save revision/i }));

    expect(reviseLesson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        nogId: nog.id,
        topicId: tcp.id,
        lessonId: originalPage.id,
        body: updatedLesson,
        idempotencyKey: expect.stringMatching(/\S/),
      }),
    );

    const rerunLink = screen.getByRole("link", { name: /rerun check/i });
    expect(rerunLink).toHaveAttribute("href", `${roomHref}/play?topic=${tcp.id}`);
  });

  it("shows the Squeaky clean empty state when there are no shaky or confused cards and no failed Quick Check attempts", async () => {
    getNogRoom.mockResolvedValueOnce({
      status: "ok",
      nog,
      vitals: { happiness: 0.9, clarity: 1, vitality: 1, faint: false },
      cards: [freshUnderstoodCard],
    });
    getNogAnalysis.mockResolvedValueOnce({
      status: "ok",
      nog,
      vitals: { happiness: 0.9, clarity: 1, vitality: 1, faint: false },
      cards: [freshUnderstoodCard],
      masteredCount: 2,
      stage: "Hatchling",
      attempts: [passedAttempt],
    });

    await renderBath();

    expect(
      screen.getByText(/Squeaky clean!\s*Nothing to fix\.?/i),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Revise$/i }),
    ).not.toBeInTheDocument();
  });
});
