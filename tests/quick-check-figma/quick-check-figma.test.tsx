// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayView } from "@/components/check/play-view";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { RunQuickCheckInput } from "@/core/application/use-cases/run-quick-check";
import { card, dns, nog } from "../feed-lesson/fixtures";
import {
  type CheckResponse,
  firstQuestion,
  improvedCheck,
  initialCheck,
  secondQuestion,
  tcp,
} from "../quick-check/fixtures";

const { runQuickCheckAction } = vi.hoisted(() => ({
  runQuickCheckAction:
    vi.fn<(input: RunQuickCheckInput) => Promise<CheckResponse>>(),
}));

vi.mock("@/app/(app)/actions/check-actions", () => ({
  runQuickCheckAction,
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

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => `/nogs/${nog.id}/play`,
  useSearchParams: () => new URLSearchParams(`topic=${tcp.id}`),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const roomHref = `/nogs/${nog.id}`;

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

function getStatPill(stat: RegExp): HTMLElement {
  return screen.getByText(
    (_text, element) =>
      element !== null &&
      stat.test(element.textContent ?? "") &&
      !Array.from(element.children).some((child) =>
        stat.test(child.textContent ?? ""),
      ),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setReducedMotion(true);
  runQuickCheckAction.mockResolvedValue(initialCheck);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Quick Check Figma restyle — Question step (113:733)", () => {
  it("renders h1 'Play', topic chip, 'Question n of N', and the question prompt inside a borderless sage region labelled 'Question n'", async () => {
    const user = userEvent.setup();
    render(<PlayView nog={nog} topics={[tcp, dns]} initialTopicId={tcp.id} />);

    await user.click(screen.getByRole("button", { name: "Start Quiz" }));

    const playH1 = await screen.findByRole("heading", {
      level: 1,
      name: "Play",
    });
    expect(playH1).toBeVisible();
    expect(
      playH1.closest(
        '[class*="bg-[var(--noggin-mint)]"], [class*="bg-[var(--noggin-white)]"]',
      ),
    ).toBeNull();

    expect(
      screen.queryByRole("link", {
        name: new RegExp(`back to ${nog.name}['’]s room`, "i"),
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByText(tcp.title)).toBeVisible();
    expect(screen.getByText("Question 1 of 2")).toBeVisible();

    const questionRegion = screen.getByRole("region", {
      name: /^Question 1$/i,
    });
    expect(questionRegion).toBeVisible();
    expect(questionRegion.className).toMatch(/bg-\[var\(--noggin-sage\)\]/);
    expect(
      within(questionRegion).getByText(firstQuestion.prompt),
    ).toBeVisible();

    const answerNode = screen.getByText(firstQuestion.nogAnswer);
    expect(answerNode).toBeVisible();
    const answerBox = answerNode.closest("[data-attempt-id]");
    expect(answerBox).not.toBeNull();
    expect(answerBox!.className).not.toMatch(/\bborder-2\b/);
  });

  it("labels the navigation pills 'Previous' and 'Next →' (and 'See results →' on the last question), with a sage 'Quiz Progress' card and frameless Nog on the right", async () => {
    const user = userEvent.setup();
    render(<PlayView nog={nog} topics={[tcp, dns]} initialTopicId={tcp.id} />);

    await user.click(screen.getByRole("button", { name: "Start Quiz" }));
    expect(await screen.findByText(firstQuestion.prompt)).toBeVisible();

    const previousBtn = screen.getByRole("button", { name: "Previous" });
    expect(previousBtn).toBeVisible();
    expect(previousBtn).toBeDisabled();

    const nextBtn = screen.getByRole("button", { name: "Next →" });
    expect(nextBtn).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Next$/ }),
    ).not.toBeInTheDocument();

    const quizProgressHeading = screen.getByRole("heading", {
      name: "Quiz Progress",
    });
    expect(quizProgressHeading).toBeVisible();
    const quizProgressCard = quizProgressHeading.closest(
      '[class*="bg-[var(--noggin-sage)]"]',
    );
    expect(quizProgressCard).not.toBeNull();
    expect(
      within(quizProgressCard as HTMLElement).getByRole("progressbar"),
    ).toBeVisible();

    const nogStage = screen.getByTestId("nog-scene-room");
    expect(nogStage).toBeVisible();
    expect(
      nogStage.closest('[class*="bg-[var(--noggin-white)]"]'),
    ).toBeNull();

    await user.click(nextBtn);

    expect(screen.getByText("Question 2 of 2")).toBeVisible();
    const q2Region = screen.getByRole("region", { name: /^Question 2$/i });
    expect(q2Region).toBeVisible();
    expect(q2Region.className).toMatch(/bg-\[var\(--noggin-sage\)\]/);
    expect(within(q2Region).getByText(secondQuestion.prompt)).toBeVisible();

    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "See results →" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^See results$/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the thinking state with a sage thinking bubble and frameless Nog while the check runs", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<CheckResponse>();
    runQuickCheckAction.mockReturnValueOnce(pending.promise);

    render(<PlayView nog={nog} topics={[tcp, dns]} initialTopicId={tcp.id} />);
    await user.click(screen.getByRole("button", { name: "Start Quiz" }));

    const thinkingText = screen.getByText(/hmm, let me think/i);
    expect(thinkingText).toBeVisible();
    expect(
      thinkingText.closest('[class*="bg-[var(--noggin-sage)]"]'),
    ).not.toBeNull();

    const nogStage = screen.getByTestId("nog-scene-room");
    expect(nogStage).toBeVisible();
    expect(
      nogStage.closest('[class*="bg-[var(--noggin-white)]"]'),
    ).toBeNull();

    await act(async () => {
      pending.resolve(initialCheck);
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Play" }),
    ).toBeVisible();
  });
});

describe("Quick Check Figma restyle — Results step (113:746)", () => {
  async function runToResults(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Start Quiz" }));
    expect(await screen.findByText(firstQuestion.prompt)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByText(secondQuestion.prompt)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "See results →" }));
  }

  it("renders h1 'Play' with back link, h2 'Keep teaching!' + score summary, sage 'Question Review' accordion with aria-expanded buttons, stacked sage stat pills, and 'Continue Training' link", async () => {
    const user = userEvent.setup();
    render(<PlayView nog={nog} topics={[tcp, dns]} initialTopicId={tcp.id} />);

    await runToResults(user);

    const playH1 = screen.getByRole("heading", { level: 1, name: "Play" });
    expect(playH1).toBeVisible();
    expect(
      playH1.closest(
        '[class*="bg-[var(--noggin-mint)]"], [class*="bg-[var(--noggin-white)]"]',
      ),
    ).toBeNull();

    expect(
      screen.queryByRole("link", {
        name: new RegExp(`back to ${nog.name}['’]s room`, "i"),
      }),
    ).not.toBeInTheDocument();

    const bannerH2 = screen.getByRole("heading", {
      level: 2,
      name: "Keep teaching!",
    });
    expect(bannerH2).toBeVisible();
    expect(screen.getByText("You got 1 out of 2 correct!")).toBeVisible();

    const reviewHeading = screen.getByRole("heading", {
      name: "Question Review",
    });
    expect(reviewHeading).toBeVisible();
    const reviewPanel = reviewHeading.closest(
      '[class*="bg-[var(--noggin-sage)]"]',
    );
    expect(reviewPanel).not.toBeNull();

    const reviewButtons = within(reviewPanel as HTMLElement).getAllByRole(
      "button",
    );
    expect(reviewButtons).toHaveLength(2);
    expect(reviewButtons[0]).toHaveAttribute("aria-expanded", "false");
    expect(reviewButtons[0]).toHaveTextContent(firstQuestion.prompt);
    expect(reviewButtons[1]).toHaveAttribute("aria-expanded", "false");
    expect(reviewButtons[1]).toHaveTextContent(secondQuestion.prompt);

    await user.click(reviewButtons[1]);
    expect(reviewButtons[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(secondQuestion.nogAnswer)).toBeVisible();
    expect(screen.getByText(card.label)).toBeVisible();
    expect(screen.getByRole("link", { name: "Fix in Bath" })).toHaveAttribute(
      "href",
      `${roomHref}?teach=bath&topic=${tcp.id}`,
    );

    for (const pattern of [
      /\b1\s*Correct\b/i,
      /\b1\s*Incorrect\b/i,
      /\b50%\s*Score\b/i,
      /\+\s*1\s*XP\s*Training\b/i,
    ]) {
      const pill = getStatPill(pattern);
      expect(pill).toBeVisible();
      expect(
        pill.closest('[class*="bg-[var(--noggin-sage)]"]'),
      ).not.toBeNull();
    }

    const continueLink = screen.getByRole("link", {
      name: "Continue Training",
    });
    expect(continueLink).toBeVisible();
    expect(continueLink).toHaveAttribute(
      "href",
      `${roomHref}?teach=feed&topic=${tcp.id}`,
    );
    expect(
      screen.getByRole("button", { name: /choose another topic/i }),
    ).toBeVisible();
  });

  it("renders h2 'Great Job!' when score >= 70% and omits the XP Training pill when there is no meter delta", async () => {
    const user = userEvent.setup();
    runQuickCheckAction.mockResolvedValueOnce({
      ...improvedCheck,
      meterBefore: 5,
      meterAfter: 5,
    });

    render(<PlayView nog={nog} topics={[tcp, dns]} initialTopicId={tcp.id} />);
    await runToResults(user);

    expect(
      screen.getByRole("heading", { level: 1, name: "Play" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "Great Job!" }),
    ).toBeVisible();
    expect(screen.getByText("You got 2 out of 2 correct!")).toBeVisible();

    for (const pattern of [
      /\b2\s*Correct\b/i,
      /\b0\s*Incorrect\b/i,
      /\b100%\s*Score\b/i,
    ]) {
      const pill = getStatPill(pattern);
      expect(pill).toBeVisible();
      expect(
        pill.closest('[class*="bg-[var(--noggin-sage)]"]'),
      ).not.toBeNull();
    }

    expect(screen.queryByText(/xp\s*training/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue Training" }),
    ).toHaveAttribute("href", roomHref);
  });
});
