// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoomError from "@/app/(app)/nogs/[id]/error";
import RoomLoading from "@/app/(app)/nogs/[id]/loading";
import NogRoomPage from "@/app/(app)/nogs/[id]/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { AppContainer } from "@/composition/container";
import { ack, analysis, sequenceNumbers, syn, synAck } from "./fixtures";

const { getNogAnalysis, notFound } = vi.hoisted(() => ({
  getNogAnalysis: vi.fn<AppContainer["getNogAnalysis"]>(),
  notFound: vi.fn(() => {
    throw new Error("Not found");
  }),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogAnalysis,
    getNogRoom: async () => analysis,
    getProfileSettings: async () => ({ status: "unauthenticated" }),
  }),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  notFound,
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
vi.mock("@/app/(app)/actions/room-actions", () => ({
  petNogAction: vi.fn(),
  saveProfileSettingsAction: vi.fn(),
}));
vi.mock("@/app/(app)/actions/lesson-actions", () => ({
  teachLessonAction: vi.fn(),
  reviseLessonAction: vi.fn(),
  answerFollowUpAction: vi.fn(),
}));
vi.mock("@/app/(app)/actions/topic-actions", () => ({
  addTopicAction: vi.fn(),
}));
vi.mock("@/app/(app)/nogs/[id]/water/actions", () => ({
  reviewCardAction: vi.fn(),
}));
vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene }: NogStageProps) => <div data-nog-scene={scene} />,
}));

type PageProps = { params: Promise<{ id: string }> };
type ErrorProps = { error: Error; reset: () => void; retry: () => void };

const routePath = "../../src/app/(app)/nogs/[id]/analysis";
// Lazy discovery keeps each requirement runnable during the pre-build test run.
const pages = import.meta.glob<{ default: (props: PageProps) => Promise<ReactElement> }>(
  "../../src/app/*/nogs/*/analysis/page.tsx",
);
const loadingFiles = import.meta.glob<{ default: ComponentType }>(
  "../../src/app/*/nogs/*/analysis/loading.tsx",
);
const errorFiles = import.meta.glob<{ default: ComponentType<ErrorProps> }>(
  "../../src/app/*/nogs/*/analysis/error.tsx",
);

const roomHref = `/nogs/${analysis.nog.id}`;
const analysisHref = `${roomHref}/analysis`;
const vitals = ["Happiness", "Clarity", "Vitality"] as const;

beforeEach(() => {
  getNogAnalysis.mockReset().mockResolvedValue(analysis);
  notFound.mockClear();
  window.history.replaceState(null, "", analysisHref);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

async function loadAnalysisPage() {
  const page = pages[`${routePath}/page.tsx`];
  if (!page) throw new Error("Missing route: src/app/(app)/nogs/[id]/analysis/page.tsx");
  return (await page()).default;
}

async function renderAnalysis() {
  const Page = await loadAnalysisPage();
  // Resolve the server entry point before mounting its returned UI in jsdom.
  return render(await Page({ params: Promise.resolve({ id: analysis.nog.id }) }));
}

describe("Nog analysis", () => {
  it("loads the Nog by route ID and shows its room rig, name, and growth stage", async () => {
    const { container } = await renderAnalysis();

    expect(getNogAnalysis).toHaveBeenCalledExactlyOnceWith({ nogId: analysis.nog.id });
    expect(screen.getByRole("heading", { level: 1, name: "Nog Analysis" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Packet" })).toBeVisible();
    expect(screen.getByText(/Hatchling\s*·\s*Level\s*1/)).toBeVisible();
    expect(container.querySelector('[data-nog-scene="room"]')).toBeVisible();
  });

  it("uses notFound when the analysis is unavailable to the owner", async () => {
    getNogAnalysis.mockResolvedValue({ status: "not_found" });
    const Page = await loadAnalysisPage();

    await expect(Page({ params: Promise.resolve({ id: "another-nog" }) })).rejects.toThrow("Not found");
    expect(getNogAnalysis).toHaveBeenCalledExactlyOnceWith({ nogId: "another-nog" });
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders three labelled meters with scores from getNogAnalysis on a 0–100 scale", async () => {
    await renderAnalysis();

    expect(screen.getAllByRole("meter")).toHaveLength(3);
    for (const [index, value] of [92, 67, 42].entries()) {
      const meter = screen.getByRole("meter", {
        name: vitals[index],
        value: { min: 0, max: 100, now: value },
      });
      expect(meter).toBeVisible();
      expect(screen.getByText(new RegExp(`^${value}\\s*/\\s*100$`))).toBeVisible();
    }
  });

  it("uses the low, mid, and high zone tokens on all three meters", async () => {
    await renderAnalysis();

    for (const label of vitals) {
      const meter = screen.getByRole("meter", { name: label });
      for (const zone of ["low", "mid", "high"]) {
        expect(meter.outerHTML).toContain(`var(--noggin-meter-${zone})`);
      }
    }
  });

  it.each([
    { scenario: "60-point boundary", scores: [60, 60, 60], statuses: ["Happy", "Clear", "Healthy"] },
    { scenario: "just below 60", scores: [59, 59, 59], statuses: ["Okay", "Needs Bath", "Low"] },
    { scenario: "30 Happiness and 1 Vitality", scores: [30, 30, 1], statuses: ["Okay", "Needs Bath", "Low"] },
    { scenario: "29 Happiness and zero Vitality", scores: [29, 29, 0], statuses: ["Sad", "Needs Bath", "Fainted"] },
  ])("shows the correct status chips at $scenario", async ({ scores, statuses }) => {
    const [happiness, clarity, vitality] = scores.map((score) => score / 100);
    getNogAnalysis.mockResolvedValue({
      ...analysis,
      vitals: { happiness, clarity, vitality, faint: scores.includes(0) },
    });
    await renderAnalysis();

    for (const status of statuses) {
      expect(screen.getByText(status, { exact: true })).toBeVisible();
    }
    if (vitality === 0) {
      expect(screen.getByRole("meter", { name: "Vitality", value: { now: 0 } })).toBeVisible();
    }
    expect(screen.getByText(/Your Nog faints if any vital reaches 0/i)).toBeVisible();
  });

  it.each([
    ["Happiness", /(?=.*\bcare(?:d)?\b)(?=.*\b(?:recent(?:ly)?|days?|lately)\b)/i],
    ["Clarity", /(?=.*\bthought cards\b)(?=.*\bunderst(?:ands?|ood)\b)/i],
    ["Vitality", /(?=.*\breviews?\b)(?=.*\bon time\b)/i],
  ] as const)("opens the %s explanation from its info button", async (label, explanation) => {
    const user = userEvent.setup();
    await renderAnalysis();

    const hiddenExplanation = screen.queryByText(explanation);
    if (hiddenExplanation) expect(hiddenExplanation).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: new RegExp(label, "i") }));

    expect(await screen.findByText(explanation)).toBeVisible();
  });

  it("groups shuffled thought cards by status and shows their freshness, paraphrases, and quotes", async () => {
    await renderAnalysis();

    expect(screen.getByRole("heading", { name: "What Packet thinks" })).toBeVisible();
    const groups = [
      { name: "Understood", cards: [syn, ack] },
      { name: "Shaky", cards: [synAck] },
      { name: "Confused", cards: [sequenceNumbers] },
    ];
    const headings = groups.map(({ name }) => screen.getByRole("heading", {
      name: new RegExp(`^${name}\\b`, "i"),
    }));
    for (const [index, group] of groups.entries()) {
      const heading = headings[index];
      const nextHeading = headings[index + 1];
      for (const card of group.cards) {
        const label = screen.getByText(card.label);
        expect(heading.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        if (nextHeading) {
          expect(label.compareDocumentPosition(nextHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }
        expect(screen.getByText(card.paraphrase)).toBeVisible();
        expect(screen.getByText((content) => content.replace(/^[“"]|[”"]$/g, "") === card.quote)).toBeVisible();
      }
    }
    expect(screen.getAllByText(/^Fresh$/i)).toHaveLength(2);
    expect(screen.getByText(/^Dusty$/i)).toBeVisible();
    expect(screen.getByText(/^Forgotten$/i)).toBeVisible();
  });

  it("links only the shaky and confused cards to in-room Bath with their own card IDs", async () => {
    await renderAnalysis();

    const fixes = screen.getAllByRole("link", { name: "Fix in Bath" });
    expect(fixes.map((link) => link.getAttribute("href")).sort()).toEqual([
      `${roomHref}?teach=bath&card=${sequenceNumbers.id}`,
      `${roomHref}?teach=bath&card=${synAck.id}`,
    ]);
  });

  it("invites the learner to in-room Feed when the Nog has no thought cards", async () => {
    getNogAnalysis.mockResolvedValue({ ...analysis, cards: [] });
    await renderAnalysis();

    expect(screen.getByText(/Packet hasn['’]t learned anything yet/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /Feed it a lesson/i })).toHaveAttribute("href", `${roomHref}?teach=feed`);
    expect(screen.queryByRole("link", { name: "Fix in Bath" })).not.toBeInTheDocument();
  });

  it("omits RoomRail on the Analysis page in favor of the unified TopBar navigation", async () => {
    await renderAnalysis();

    expect(screen.queryByRole("navigation", { name: /nog room sections/i })).not.toBeInTheDocument();
  });

  it("shows a busy loading skeleton without presenting placeholder meter values", async () => {
    await loadAnalysisPage();
    const load = loadingFiles[`${routePath}/loading.tsx`];
    const Loading = load ? (await load()).default : RoomLoading;
    const { container } = render(<Loading />);

    expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("shows the Brain fog error and lets the learner retry", async () => {
    await loadAnalysisPage();
    const load = errorFiles[`${routePath}/error.tsx`];
    const ErrorFallback = load ? (await load()).default : RoomError;
    const retry = vi.fn();
    const errorProps = { error: new Error("Analysis read failed"), reset: retry, retry };
    const user = userEvent.setup();
    render(<ErrorFallback {...errorProps} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Brain fog 😵");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

it("omits the RoomRail and in-room See analysis link on the Nog Room page", async () => {
  window.history.replaceState(null, "", roomHref);
  render(await NogRoomPage({ params: Promise.resolve({ id: analysis.nog.id }) }));

  expect(screen.queryByRole("navigation", { name: /nog room sections/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "See analysis" })).not.toBeInTheDocument();
});
