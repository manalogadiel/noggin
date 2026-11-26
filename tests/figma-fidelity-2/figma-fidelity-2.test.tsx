// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BathPage from "@/app/(app)/nogs/[id]/bath/page";
import { NogAnalysisView } from "@/components/analysis/nog-analysis-view";
import { WaterView } from "@/components/care/water-view";
import { PlayView } from "@/components/check/play-view";
import { FeedView } from "@/components/feed/feed-view";
import { HatchNewCard, NogCard } from "@/components/nog/nog-card";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import { NotebookView } from "@/components/notebook/notebook-view";
import { RoomRail } from "@/components/room/room-rail";
import type {
  CheckAttemptRecord,
  QuickCheckAttempt,
} from "@/core/application/ports";
import type { GetNogAnalysisResult } from "@/core/application/use-cases/get-nog-analysis";
import type { GetTopicNotebookResult } from "@/core/application/use-cases/get-topic-notebook";
import type { ListTopicsResult } from "@/core/application/use-cases/list-topics";
import {
  confusedCard,
  dns,
  dnsPage,
  dustyCard,
  freshUnderstoodCard,
  nog,
  originalPage,
  passedAttempt,
  shakyCard,
  tcp,
  toRecord,
} from "../care-loop/fixtures";

type AnalysisWithAttempts = GetNogAnalysisResult & {
  attempts?: CheckAttemptRecord[];
};

const {
  usePathnameMock,
  routerPushMock,
  getNogAnalysisMock,
  listTopicsMock,
  getTopicNotebookMock,
  runQuickCheckActionMock,
  reviewCardActionMock,
} = vi.hoisted(() => ({
  usePathnameMock: vi.fn<() => string>(() => "/nogs/aafdc09b-4cf8-4668-b112-d1d65372829a/feed"),
  routerPushMock: vi.fn<(href: string) => void>(),
  getNogAnalysisMock:
    vi.fn<(input: { nogId: string }) => Promise<AnalysisWithAttempts>>(),
  listTopicsMock:
    vi.fn<(input: { nogId: string }) => Promise<ListTopicsResult>>(),
  getTopicNotebookMock:
    vi.fn<
      (input: {
        nogId: string;
        topicId: string;
      }) => Promise<GetTopicNotebookResult>
    >(),
  runQuickCheckActionMock: vi.fn(),
  reviewCardActionMock: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => usePathnameMock(),
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogAnalysis: getNogAnalysisMock,
    listTopics: listTopicsMock,
    getTopicNotebook: getTopicNotebookMock,
  }),
}));

vi.mock("@/app/(app)/actions/check-actions", () => ({
  runQuickCheckAction: runQuickCheckActionMock,
}));

vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  teachLessonAction: vi.fn(),
  answerFollowUpAction: vi.fn(),
  reviseLessonAction: vi.fn(),
}));

vi.mock("@/app/(app)/actions/topic-actions", () => ({
  addTopicAction: vi.fn(),
}));

vi.mock("@/app/(app)/nogs/[id]/water/actions", () => ({
  reviewCardAction: reviewCardActionMock,
}));

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene, alt }: NogStageProps) => (
    <div
      data-testid={`nog-scene-${scene}`}
      data-nog-scene={scene}
      aria-label={alt}
    />
  ),
}));

const tokensPath = resolve(process.cwd(), "src/styles/tokens.css");

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const transform = (channel: number) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [transform(r), transform(g), transform(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

beforeEach(() => {
  vi.clearAllMocks();
  usePathnameMock.mockReturnValue(`/nogs/${nog.id}/feed`);
});

afterEach(() => {
  cleanup();
});

describe("figma-fidelity-2 tokens and RoomRail", () => {
  it("defines --noggin-sage (#bfd38b) and --noggin-sage-strong (#a9c46d) in tokens.css with forest text contrast >= 4.5:1", () => {
    const css = readFileSync(tokensPath, "utf8");
    const sageMatch = css.match(/--noggin-sage:\s*(#[0-9a-fA-F]{6})\s*;/);
    const sageStrongMatch = css.match(
      /--noggin-sage-strong:\s*(#[0-9a-fA-F]{6})\s*;/,
    );
    const forestMatch = css.match(/--noggin-forest:\s*(#[0-9a-fA-F]{6})\s*;/);

    expect(sageMatch?.[1]?.toLowerCase()).toBe("#bfd38b");
    expect(sageStrongMatch?.[1]?.toLowerCase()).toBe("#a9c46d");
    expect(forestMatch?.[1]).toBeDefined();

    const ratio = contrastRatio(forestMatch![1], sageMatch![1]);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("styles RoomRail with leaf-strong background, flush right edge, white inactive icons, and a white circle with leaf-strong icon for the active item", () => {
    usePathnameMock.mockReturnValue(`/nogs/${nog.id}/analysis`);
    render(<RoomRail nogId={nog.id} />);

    const rail = screen.getByRole("navigation", { name: "Nog room sections" });
    expect(rail.className).toMatch(/bg-\[var\(--noggin-leaf-strong\)\]/);
    expect(rail.className).toMatch(/right-0/);
    expect(rail.className).toMatch(/rounded-l/);

    const activeLink = within(rail).getByRole("link", { name: "Analysis" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink.className).toMatch(/bg-\[var\(--noggin-white\)\]/);
    expect(activeLink.className).toMatch(
      /text-\[var\(--noggin-leaf-strong\)\]/,
    );

    for (const label of ["Room", "Notebook", "Check"]) {
      const inactiveLink = within(rail).getByRole("link", { name: label });
      expect(inactiveLink).not.toHaveAttribute("aria-current");
      expect(inactiveLink.className).toMatch(/text-\[var\(--noggin-white\)\]/);
    }
  });
});

describe("figma-fidelity-2 Feed, Practice Quiz, Water, Bath, Analysis, Notebook, and My Nogs", () => {
  it("renders Feed (113:395) with sage lesson card, white textarea, sage Brain Capacity card, frameless Nog with sage speech bubble, and collapsed thought drawer below the lesson card", () => {
    render(
      <FeedView
        nog={nog}
        topics={[tcp, dns]}
        selectedTopic={tcp}
        pages={[originalPage]}
        thoughtCards={[toRecord(shakyCard)]}
        fixingCard={null}
        initialDraft=""
        reviseLessonId={null}
      />,
    );

    const lessonCard = screen.getByRole("region", { name: "Lesson editor" });
    expect(lessonCard.className).toMatch(/bg-\[var\(--noggin-sage\)\]/);

    const textarea = within(lessonCard).getByRole("textbox", {
      name: "Your lesson",
    });
    expect(textarea.className).toMatch(/bg-\[var\(--noggin-white\)\]/);

    const brainCard = screen.getByRole("region", { name: "Brain Capacity" });
    expect(brainCard.className).toMatch(/bg-\[var\(--noggin-sage\)\]/);

    const bubble = screen
      .getByText("Teach me about TCP handshake!")
      .closest('[role="status"]');
    expect(bubble).not.toBeNull();
    expect(bubble!.className).toMatch(/bg-\[var\(--noggin-sage\)\]/);

    const nogStage = screen.getByTestId("nog-scene-room");
    expect(
      nogStage.closest('[class*="bg-[var(--noggin-white)]"]'),
    ).toBeNull();

    const drawer = screen.getByRole("region", {
      name: `${nog.name}'s thought cards`,
    });
    expect(
      lessonCard.compareDocumentPosition(drawer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(drawer).getByRole("button", {
        name: new RegExp(`what ${nog.name} remembers`, "i"),
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("renders Practice Quiz (113:499) without a wrapper card or 'Game-show check' card, with 'Topics' h2 on the right and 'Start Quiz' pill on the left", () => {
    render(<PlayView nog={nog} topics={[tcp, dns]} initialTopicId={tcp.id} />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Practice Quiz",
    });
    expect(heading).toBeVisible();
    expect(
      heading.closest(
        '[class*="bg-[var(--noggin-mint)]"], [class*="bg-[var(--noggin-white)]"]',
      ),
    ).toBeNull();

    expect(screen.queryByText(/game-show check/i)).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: "Topics" }),
    ).toBeVisible();

    const startQuizBtn = screen.getByRole("button", { name: "Start Quiz" });
    expect(startQuizBtn).toBeVisible();
    expect(startQuizBtn).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^Start$/i }),
    ).not.toBeInTheDocument();

    const nogStage = screen.getByTestId("nog-scene-room");
    expect(
      nogStage.closest('[class*="bg-[var(--noggin-white)]"]'),
    ).toBeNull();
  });

  it("renders Water (113:467 & 113:681) with h1 \"Let's test what you know!\", hatchling-confused.png, 'Start Reviewing →' pill, no wrapper card, and a sage card on the Recall step", async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(
      <WaterView
        nog={nog}
        topics={[tcp, dns]}
        dueCards={[toRecord(dustyCard), toRecord(shakyCard)]}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: /^Let['’]s test what you know!$/i,
    });
    expect(heading).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /what do you remember\?/i }),
    ).not.toBeInTheDocument();
    expect(
      heading.closest(
        '[class*="bg-[var(--noggin-mint)]"], [class*="bg-[var(--noggin-white)]"]',
      ),
    ).toBeNull();

    const confusedImg = container.querySelector(
      'img[src*="hatchling-confused.png"]',
    );
    expect(confusedImg).not.toBeNull();

    const startBtn = screen.getByRole("button", {
      name: "Start Reviewing →",
    });
    expect(startBtn).toBeVisible();
    expect(startBtn).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^Start Review$/i }),
    ).not.toBeInTheDocument();

    await user.click(startBtn);
    const recallText = screen.getByText(/recall:/i);
    expect(recallText).toBeVisible();
    expect(
      recallText.closest('[class*="bg-[var(--noggin-sage)]"]'),
    ).not.toBeNull();

    unmount();

    render(<WaterView nog={nog} topics={[tcp]} dueCards={[]} />);
    const emptyMsg = screen.getByText(
      /Nothing to water today\s*[—–-]\s*your Nog['’]s memory is fresh!/i,
    );
    expect(
      emptyMsg.closest(
        '[class*="bg-[var(--noggin-mint)]"], [class*="bg-[var(--noggin-white)]"]',
      ),
    ).toBeNull();
  });

  it("renders Bath (113:707) with h1 'Bath', h2 'Missed Concept', thinking Nog, sage panels, 'Start Revising →', and labels Quick Check misses by question prompt (truncated at ~80 chars with full title)", async () => {
    const user = userEvent.setup();
    const shortPrompt =
      "Why does the server reply with SYN-ACK during the TCP three-way handshake?";
    const longPrompt =
      "How do the client and server synchronize initial sequence numbers before exchanging application data over a TCP connection?";

    const shortMiss: QuickCheckAttempt = {
      id: "attempt-short-miss",
      nogId: nog.id,
      topicId: tcp.id,
      questionId: "q-tcp-short",
      prompt: shortPrompt,
      nogAnswer: "The server immediately sends application data.",
      concepts: [
        {
          concept: "SYN-ACK segment",
          inAnswer: false,
          inPages: true,
          consistentWithReference: true,
        },
      ],
      correct: false,
      notebookFingerprint: "fp-1",
      createdAt: "2026-11-21T10:05:00.000Z",
    };

    const longMiss: QuickCheckAttempt = {
      id: "attempt-long-miss",
      nogId: nog.id,
      topicId: tcp.id,
      questionId: "q-tcp-long",
      prompt: longPrompt,
      nogAnswer: "Sequence numbers start at zero without negotiation.",
      concepts: [
        {
          concept: "initial sequence number synchronization",
          inAnswer: false,
          inPages: false,
          consistentWithReference: true,
        },
      ],
      correct: false,
      notebookFingerprint: "fp-1",
      createdAt: "2026-11-21T10:06:00.000Z",
    };

    listTopicsMock.mockResolvedValue({ status: "ok", topics: [tcp, dns] });
    getNogAnalysisMock.mockResolvedValue({
      status: "ok",
      nog,
      vitals: { happiness: 0.75, clarity: 0.5, vitality: 0.85, faint: false },
      cards: [freshUnderstoodCard, confusedCard],
      masteredCount: 1,
      stage: "Hatchling",
      attempts: [passedAttempt, shortMiss, longMiss],
    });
    getTopicNotebookMock.mockImplementation(async ({ topicId }) => {
      if (topicId === tcp.id) {
        return {
          status: "ok",
          topic: tcp,
          pages: [originalPage],
          thoughtCards: [toRecord(freshUnderstoodCard)],
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

    type BathRoutePage = (props: {
      params: Promise<{ id: string }>;
      searchParams?: Promise<{ card?: string; topic?: string }>;
    }) => Promise<ReactElement>;

    const Page = BathPage as unknown as BathRoutePage;
    render(
      await Page({
        params: Promise.resolve({ id: nog.id }),
        searchParams: Promise.resolve({}),
      }),
    );

    const bathH1 = screen.getByRole("heading", { level: 1, name: "Bath" });
    expect(bathH1).toBeVisible();

    const missedConceptH2 = screen.getByRole("heading", {
      level: 2,
      name: "Missed Concept",
    });
    expect(missedConceptH2).toBeVisible();
    expect(
      missedConceptH2.closest(
        '[class*="bg-[var(--noggin-mint)]"], [class*="bg-[var(--noggin-white)]"]',
      ),
    ).toBeNull();

    expect(screen.getByTestId("nog-scene-thinking")).toBeVisible();

    const nogAnswerHeading = screen.getByRole("heading", {
      name: /nog answer/i,
    });
    const whatItMissedHeading = screen.getByRole("heading", {
      name: /what it missed/i,
    });
    expect(
      nogAnswerHeading.closest('[class*="bg-[var(--noggin-sage)]"]'),
    ).not.toBeNull();
    expect(
      whatItMissedHeading.closest('[class*="bg-[var(--noggin-sage)]"]'),
    ).not.toBeNull();

    const startRevisingBtn = screen.getByRole("button", {
      name: "Start Revising →",
    });
    expect(startRevisingBtn).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Revise$/i }),
    ).not.toBeInTheDocument();

    // Bug fix assertions: no "{topic} miss" labels
    expect(
      screen.queryByText(/tcp handshake miss/i),
    ).not.toBeInTheDocument();

    const listRegion = screen.getByRole("complementary", {
      name: /thoughts to fix/i,
    });
    expect(within(listRegion).getByText(confusedCard.label)).toBeVisible();
    expect(within(listRegion).getByText(shortPrompt)).toBeVisible();

    // Long prompt (> 80 chars) is truncated with an ellipsis in visible text and keeps full prompt in title or accessible name
    const truncatedMatch = within(listRegion).getByText((content) => {
      const trimmed = content.trim();
      return (
        trimmed.startsWith(longPrompt.slice(0, 60)) &&
        trimmed.length < longPrompt.length &&
        /(?:…|\.{3})$/.test(trimmed)
      );
    });
    expect(truncatedMatch).toBeVisible();
    const longItemBtn = truncatedMatch.closest("button");
    expect(longItemBtn).not.toBeNull();
    const fullTextExposed =
      longItemBtn?.getAttribute("title") === longPrompt ||
      longItemBtn?.getAttribute("aria-label")?.includes(longPrompt) ||
      truncatedMatch.getAttribute("title") === longPrompt;
    expect(fullTextExposed).toBe(true);

    // Selecting the short-prompt miss updates the selected item heading/title
    await user.click(within(listRegion).getByText(shortPrompt));
    expect(screen.getAllByText(shortPrompt).length).toBeGreaterThanOrEqual(2);
  });

  it("renders Nog Analysis (211:127) with top-left h1 'Nog Analysis' and one borderless elevated vitals panel", () => {
    render(
      <NogAnalysisView
        nog={nog}
        vitals={{
          happiness: 0.92,
          clarity: 0.67,
          vitality: 0.42,
          faint: false,
        }}
        cards={[shakyCard]}
        stage="Hatchling"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Nog Analysis" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: nog.name })).toBeVisible();
    expect(screen.getByText(/Hatchling\s*·\s*Level\s*1/)).toBeVisible();

    const vitalsPanel = screen.getByRole("region", {
      name: `${nog.name} vitals`,
    });
    expect(vitalsPanel.className).not.toMatch(/\bborder\b/);
    expect(vitalsPanel.className).toMatch(/rounded-\[28px\]/);

    const happinessMeter = within(vitalsPanel).getByRole("meter", {
      name: "Happiness",
    });
    expect(
      happinessMeter.closest('[class*="bg-[var(--noggin-white)]"]'),
    ).toBeNull();
  });

  it("renders Notebook as a borderless 3D bookshelf by default and opens a borderless 2-page spread for an explicit topic", () => {
    const { unmount } = render(
      <NotebookView
        nog={nog}
        topics={[tcp, dns]}
        selectedTopic={tcp}
        pages={[originalPage]}
        thoughtCards={[toRecord(shakyCard)]}
      />,
    );

    expect(screen.getByRole("region", { name: "3D notebooks shelf" })).toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Topics" })).not.toBeInTheDocument();
    unmount();

    render(
      <NotebookView
        nog={nog}
        topics={[tcp, dns]}
        selectedTopic={tcp}
        pages={[originalPage]}
        thoughtCards={[toRecord(shakyCard)]}
        initialTopicExplicit={true}
      />,
    );

    const notesPanel = screen.getByRole("region", { name: tcp.title });
    expect(notesPanel.className).not.toMatch(/\bborder\b/);
  });

  it("renders My Nogs (63:116) cards as sage panels with 'Lvl. N' instead of a visible stage chip, while keeping stage in the accessible name, and a sage 'Hatch New' card", () => {
    render(
      <>
        <NogCard
          nog={{
            id: "nog-1",
            name: "Coral",
            subjectName: "Marine Biology",
            stage: "hatchling",
          }}
        />
        <NogCard
          nog={{
            id: "nog-2",
            name: "Packet",
            subjectName: "Networking",
            stage: "sprout",
          }}
        />
        <NogCard
          nog={{
            id: "nog-3",
            name: "Cipher",
            subjectName: "Cryptography",
            stage: "scholar",
          }}
        />
        <NogCard
          nog={{
            id: "nog-4",
            name: "Euler",
            subjectName: "Calculus",
            stage: "genius",
          }}
        />
        <HatchNewCard />
      </>,
    );

    const expected = [
      {
        label: "Coral, Marine Biology, Hatchling",
        stageText: "Hatchling",
        levelText: /^Lvl\.\s*1$/,
      },
      {
        label: "Packet, Networking, Sprout",
        stageText: "Sprout",
        levelText: /^Lvl\.\s*2$/,
      },
      {
        label: "Cipher, Cryptography, Scholar",
        stageText: "Scholar",
        levelText: /^Lvl\.\s*3$/,
      },
      {
        label: "Euler, Calculus, Genius",
        stageText: "Genius",
        levelText: /^Lvl\.\s*4$/,
      },
    ];

    for (const item of expected) {
      const card = screen.getByRole("link", { name: item.label });
      expect(card.className).toMatch(/bg-\[var\(--noggin-mint-light\)\]/);
      expect(within(card).getByText(item.levelText)).toBeVisible();
      expect(within(card).queryByText(item.stageText)).not.toBeInTheDocument();
    }

    const hatchNew = screen.getByRole("link", { name: "Hatch New" });
    expect(hatchNew).toHaveAttribute("href", "/adopt");
    expect(hatchNew.className).toMatch(/bg-\[var\(--noggin-mint-light\)\]/);
  });
});
