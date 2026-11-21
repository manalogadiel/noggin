// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dnsTopic,
  dpTopic,
  geniusNog,
  graphsTopic,
  packetNog,
  tcpTopic,
  treesTopic,
  type GetLearningProgressResult,
} from "./fixtures";

const { getLearningProgress } = vi.hoisted(() => ({
  getLearningProgress: vi.fn<() => Promise<GetLearningProgressResult>>(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getLearningProgress,
  }),
}));

type ErrorProps = { error: Error; reset: () => void; retry?: () => void };

const routeBase = "../../src/app/(app)/profile/progress";
const pageModules = import.meta.glob<{
  default: () => ReactElement | Promise<ReactElement>;
}>("../../src/app/*/profile/progress/page.tsx");
const loadingModules = import.meta.glob<{ default: ComponentType }>(
  "../../src/app/*/profile/progress/loading.tsx",
);
const errorModules = import.meta.glob<{ default: ComponentType<ErrorProps> }>(
  "../../src/app/*/profile/progress/error.tsx",
);

async function loadProgressPage() {
  const loader = pageModules[`${routeBase}/page.tsx`];
  if (!loader) {
    throw new Error("Missing route: src/app/(app)/profile/progress/page.tsx");
  }
  return (await loader()).default;
}

beforeEach(() => {
  vi.clearAllMocks();
  getLearningProgress.mockResolvedValue({
    status: "ok",
    summary: {
      nogs: 2,
      topicsWithProgress: 4,
      mastered: 33,
    },
    nogs: [
      {
        id: packetNog.id,
        name: packetNog.name,
        subjectName: "Networking",
        stage: "Hatchling",
        nextStage: "Sprout",
        mastered: 3,
        nextThreshold: 5,
        percent: 60,
        topics: [
          {
            id: tcpTopic.id,
            name: tcpTopic.title,
            mastered: 3,
            total: 8,
          },
          {
            id: dnsTopic.id,
            name: dnsTopic.title,
            mastered: 0,
            total: 0,
          },
        ],
      },
      {
        id: geniusNog.id,
        name: geniusNog.name,
        subjectName: "Algorithms",
        stage: "Genius",
        nextStage: null,
        mastered: 30,
        nextThreshold: null,
        percent: 100,
        topics: [
          {
            id: graphsTopic.id,
            name: graphsTopic.title,
            mastered: 10,
            total: 10,
          },
          {
            id: dpTopic.id,
            name: dpTopic.title,
            mastered: 10,
            total: 10,
          },
          {
            id: treesTopic.id,
            name: treesTopic.title,
            mastered: 10,
            total: 10,
          },
        ],
      },
    ],
  });
});

afterEach(() => {
  cleanup();
});

describe("Learning Progress tab (/profile/progress)", () => {
  it("renders the three summary stat tiles and per-Nog progress cards with accessible progressbars, pending topics, and Open room links", async () => {
    const ProgressPage = await loadProgressPage();
    render(await ProgressPage());

    expect(screen.getByText(/^Nogs$/i)).toBeVisible();
    expect(screen.getByText(/Topics with progress/i)).toBeVisible();
    expect(screen.getByText(/Questions mastered/i)).toBeVisible();
    expect(screen.getByText("33")).toBeVisible();

    // Packet card (Hatchling -> Sprout)
    expect(
      screen.getByRole("heading", { level: 2, name: "Packet" }),
    ).toBeVisible();
    expect(screen.getByText("Networking")).toBeVisible();
    expect(screen.getByText(/^Hatchling$/i)).toBeVisible();

    const packetStageBar = screen.getByRole("progressbar", {
      name: /Packet['’]s progress to Sprout/i,
    });
    expect(packetStageBar).toBeVisible();
    expect(packetStageBar).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText(/3\s*\/\s*5\s+to\s+Sprout/i)).toBeVisible();

    const tcpBar = screen.getByRole("progressbar", {
      name: /TCP handshake:\s*3 of 8 mastered/i,
    });
    expect(tcpBar).toBeVisible();
    expect(screen.getByText(/3\s*\/\s*8/)).toBeVisible();

    // Pending topic with total === 0
    expect(screen.getByText("DNS lookup")).toBeVisible();
    expect(screen.getByText(/questions (?:are )?being written/i)).toBeVisible();

    // Athena card (Genius -> top stage reached)
    expect(
      screen.getByRole("heading", { level: 2, name: "Athena" }),
    ).toBeVisible();
    expect(screen.getByText("Algorithms")).toBeVisible();
    expect(screen.getByText(/^Genius$/i)).toBeVisible();
    expect(screen.getByText(/Top stage reached!/i)).toBeVisible();

    const openRoomLinks = screen.getAllByRole("link", { name: /open room/i });
    expect(openRoomLinks.map((link) => link.getAttribute("href"))).toEqual([
      `/nogs/${packetNog.id}`,
      `/nogs/${geniusNog.id}`,
    ]);
  });

  it("renders the empty state with a Hatch a Nog link to /adopt when the learner has no Nogs", async () => {
    getLearningProgress.mockResolvedValueOnce({
      status: "ok",
      summary: {
        nogs: 0,
        topicsWithProgress: 0,
        mastered: 0,
      },
      nogs: [],
    });
    const ProgressPage = await loadProgressPage();
    render(await ProgressPage());

    expect(screen.getByText(/No Nogs yet/i)).toBeVisible();
    const hatchLink = screen.getByRole("link", { name: /hatch a nog/i });
    expect(hatchLink).toHaveAttribute("href", "/adopt");
  });

  it("provides loading and error boundaries for /profile/progress", async () => {
    const loadLoading = loadingModules[`${routeBase}/loading.tsx`];
    if (!loadLoading) {
      throw new Error(
        "Missing loading boundary: src/app/(app)/profile/progress/loading.tsx",
      );
    }
    const { default: Loading } = await loadLoading();
    const { container } = render(<Loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
    cleanup();

    const loadError = errorModules[`${routeBase}/error.tsx`];
    if (!loadError) {
      throw new Error(
        "Missing error boundary: src/app/(app)/profile/progress/error.tsx",
      );
    }
    const { default: ErrorBoundary } = await loadError();
    const reset = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary
        error={new Error("Failed to load learning progress")}
        reset={reset}
        retry={reset}
      />,
    );

    expect(within(screen.getByRole("alert")).getByText(/brain fog/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
