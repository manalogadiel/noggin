// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WaterPage from "@/app/(app)/nogs/[id]/water/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { ThoughtCardRecord } from "@/core/application/ports";
import type { GetNogAnalysisResult } from "@/core/application/use-cases/get-nog-analysis";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import {
  dns,
  dustyCard,
  freshUnderstoodCard,
  nog,
  now,
  shakyCard,
  tcp,
  toRecord,
} from "./fixtures";

type ReviewOutcome = "remembered" | "forgot";
type ListDueCardsResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; cards: ThoughtCardRecord[] };
type ReviewCardResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; card: ThoughtCardRecord };

const {
  getNogRoom,
  getNogAnalysis,
  listTopics,
  listDueCards,
  reviewCard,
} = vi.hoisted(() => ({
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  getNogAnalysis:
    vi.fn<(input: { nogId: string }) => Promise<GetNogAnalysisResult>>(),
  listTopics: vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
  listDueCards:
    vi.fn<(input: { nogId: string }) => Promise<ListDueCardsResult>>(),
  reviewCard:
    vi.fn<
      (input: {
        nogId: string;
        cardId: string;
        outcome: ReviewOutcome;
      }) => Promise<ReviewCardResult>
    >(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogRoom,
    getNogAnalysis,
    listTopics,
    listDueCards,
    reviewCard,
  }),
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
const waterHref = `${roomHref}/water`;

function followAnchorNavigation(event: MouseEvent) {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  event.preventDefault();
  window.history.pushState(null, "", link.href);
}

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", waterHref);
  document.addEventListener("click", followAnchorNavigation);

  const dueCards = [toRecord(dustyCard), toRecord(shakyCard)];
  listTopics.mockResolvedValue({ status: "ok", topics: [tcp, dns] });
  getNogRoom.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.75, clarity: 0.67, vitality: 0.85, faint: false },
    cards: [dustyCard, shakyCard, freshUnderstoodCard],
  });
  getNogAnalysis.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.75, clarity: 0.67, vitality: 0.85, faint: false },
    cards: [dustyCard, shakyCard, freshUnderstoodCard],
    masteredCount: 1,
    stage: "Hatchling",
  });
  listDueCards.mockResolvedValue({
    status: "ok",
    cards: dueCards,
  });
  reviewCard.mockImplementation(async ({ cardId, outcome }) => {
    const target =
      dueCards.find((card) => card.id === cardId) ?? toRecord(dustyCard);
    if (outcome === "forgot") {
      return {
        status: "ok",
        card: {
          ...target,
          status: "shaky",
          intervalDays: 1,
          nextReviewAt: new Date(
            now.getTime() + 1 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };
    }
    const nextInterval = (target.intervalDays ?? 1) === 1 ? 3 : 7;
    return {
      status: "ok",
      card: {
        ...target,
        strength: (target.strength ?? 1) + 1,
        intervalDays: nextInterval,
        nextReviewAt: new Date(
          now.getTime() + nextInterval * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    };
  });
});

afterEach(() => {
  cleanup();
  document.removeEventListener("click", followAnchorNavigation);
  window.history.replaceState(null, "", "/");
});

async function renderWater() {
  return render(
    await WaterPage({
      params: Promise.resolve({ id: nog.id }),
    }),
  );
}

describe("Water review flow (/nogs/[id]/water)", () => {
  it("renders Step 1 with due thought cards (dusty first) checked by default and the room rail", async () => {
    await renderWater();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^Let['’]s test what you know!$/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Revisit what you['’]ve learned to help your Nog grow stronger!/i,
      ),
    ).toBeVisible();

    const dustyLabel = screen.getByText(dustyCard.label);
    const shakyLabel = screen.getByText(shakyCard.label);
    expect(dustyLabel).toBeVisible();
    expect(shakyLabel).toBeVisible();
    expect(
      dustyLabel.compareDocumentPosition(shakyLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByText(freshUnderstoodCard.label),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(tcp.title).length).toBeGreaterThanOrEqual(1);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeChecked();
    }

    expect(
      screen.getByRole("button", { name: "Start Reviewing →" }),
    ).toBeEnabled();

    const rail = within(
      screen.getByRole("navigation", { name: /nog room sections/i }),
    );
    expect(rail.getByRole("link", { name: "Room" })).toHaveAttribute(
      "href",
      roomHref,
    );
    expect(rail.getByRole("link", { name: "Notebook" })).toHaveAttribute(
      "href",
      `${roomHref}/notebook`,
    );
    expect(rail.getByRole("link", { name: "Analysis" })).toHaveAttribute(
      "href",
      `${roomHref}/analysis`,
    );
    expect(rail.getByRole("link", { name: "Check" })).toHaveAttribute(
      "href",
      `${roomHref}/play`,
    );
  });

  it("shows the empty state and a room link when no thought cards are due", async () => {
    listDueCards.mockResolvedValueOnce({ status: "ok", cards: [] });
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
    });

    await renderWater();

    expect(
      screen.getByText(
        /Nothing to water today\s*[—–-]\s*your Nog['’]s memory is fresh!/i,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Start Reviewing →" }),
    ).not.toBeInTheDocument();
    const backLinks = screen.getAllByRole("link", {
      name: /back to (?:the )?room|room/i,
    });
    expect(
      backLinks.some((link) => link.getAttribute("href") === roomHref),
    ).toBe(true);
  });

  it("steps through selected due cards one at a time, reveals the student's quote, shows Next Review, and finishes after 'I still know this'", async () => {
    const user = userEvent.setup();
    await renderWater();

    await user.click(
      screen.getByRole("button", { name: "Start Reviewing →" }),
    );

    expect(screen.getByText(/recall:/i)).toBeVisible();
    expect(screen.getByText(dustyCard.label)).toBeVisible();
    expect(screen.queryByText(shakyCard.label)).not.toBeInTheDocument();
    expect(screen.getByText(/in 3 days/i)).toBeVisible();

    const hiddenQuote = screen.queryByText(dustyCard.quote ?? "");
    if (hiddenQuote) {
      expect(hiddenQuote).not.toBeVisible();
    }

    await user.click(screen.getByRole("button", { name: /show my words/i }));
    expect(screen.getByText(dustyCard.quote ?? "")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /i still know this/i }),
    );
    expect(reviewCard).toHaveBeenCalledWith({
      nogId: nog.id,
      cardId: dustyCard.id,
      outcome: "remembered",
    });

    expect(await screen.findByText(shakyCard.label)).toBeVisible();
    expect(screen.queryByText(dustyCard.label)).not.toBeInTheDocument();
    expect(screen.getByText(/in 7 days/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /show my words/i }));
    expect(screen.getByText(shakyCard.quote ?? "")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /i still know this/i }),
    );
    expect(reviewCard).toHaveBeenCalledWith({
      nogId: nog.id,
      cardId: shakyCard.id,
      outcome: "remembered",
    });

    expect(
      await screen.findByText(/Watered!\s*2 thoughts? refreshed/i),
    ).toBeVisible();
    const backLinks = screen.getAllByRole("link", {
      name: /back to (?:the )?room|room/i,
    });
    expect(
      backLinks.some((link) => link.getAttribute("href") === roomHref),
    ).toBe(true);
  });

  it("reviews only the checked thoughts when the learner unchecks an item in Step 1", async () => {
    const user = userEvent.setup();
    await renderWater();

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    expect(checkboxes[1]).not.toBeChecked();

    await user.click(
      screen.getByRole("button", { name: "Start Reviewing →" }),
    );
    expect(screen.getByText(dustyCard.label)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /i still know this/i }),
    );

    expect(
      await screen.findByText(/Watered!\s*1 thought(?:s)? refreshed/i),
    ).toBeVisible();
    expect(reviewCard).toHaveBeenCalledExactlyOnceWith({
      nogId: nog.id,
      cardId: dustyCard.id,
      outcome: "remembered",
    });
  });

  it("marks the thought as forgot and opens Feed for its topic when 'Teach it again' is chosen", async () => {
    const user = userEvent.setup();
    await renderWater();

    await user.click(
      screen.getByRole("button", { name: "Start Reviewing →" }),
    );
    expect(screen.getByText(dustyCard.label)).toBeVisible();

    const teachAgain =
      screen.queryByRole("button", { name: /teach it again/i }) ??
      screen.getByRole("link", { name: /teach it again/i });
    await user.click(teachAgain);

    expect(reviewCard).toHaveBeenCalledWith({
      nogId: nog.id,
      cardId: dustyCard.id,
      outcome: "forgot",
    });
    expect(window.location.pathname).toBe(`${roomHref}/feed`);
    expect(new URLSearchParams(window.location.search).get("topic")).toBe(
      dustyCard.topicId,
    );
  });
});
