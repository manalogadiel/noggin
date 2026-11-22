// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RestPage from "@/app/(app)/nogs/[id]/rest/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import { freshUnderstoodCard, nog } from "./fixtures";

const {
  getNogRoom,
  teachLesson,
  reviseLesson,
  runQuickCheck,
  reviewCard,
} = vi.hoisted(() => ({
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  teachLesson: vi.fn(),
  reviseLesson: vi.fn(),
  runQuickCheck: vi.fn(),
  reviewCard: vi.fn(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogRoom,
    teachLesson,
    reviseLesson,
    runQuickCheck,
    reviewCard,
  }),
}));

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene, poster, alt }: NogStageProps) => (
    <img data-testid={`nog-scene-${scene}`} src={poster} alt={alt} />
  ),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => window.location.pathname,
}));

const roomHref = `/nogs/${nog.id}`;
const restHref = `${roomHref}/rest`;

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", restHref);
  getNogRoom.mockResolvedValue({
    status: "ok",
    nog,
    vitals: { happiness: 0.75, clarity: 1, vitality: 0.85, faint: false },
    cards: [freshUnderstoodCard],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

async function renderRest() {
  return render(
    await RestPage({
      params: Promise.resolve({ id: nog.id }),
    }),
  );
}

describe("Rest screen (/nogs/[id]/rest)", () => {
  it("shows the sleepy Nog, Nap time heading, resting copy, Wake up link, and room rail without making AI or mutation calls", async () => {
    const { container } = await renderRest();

    expect(
      screen.getByRole("heading", { level: 1, name: "Nap time" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        new RegExp(
          `${nog.name} is resting\\.\\s*Lessons stick better after a break\\.`,
          "i",
        ),
      ),
    ).toBeVisible();

    const sleepyImg = container.querySelector(
      'img[src*="hatchling-sleepy.png"]',
    );
    expect(sleepyImg).not.toBeNull();
    expect(sleepyImg).toBeVisible();

    expect(screen.getByRole("link", { name: /wake up/i })).toHaveAttribute(
      "href",
      roomHref,
    );

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

    expect(teachLesson).not.toHaveBeenCalled();
    expect(reviseLesson).not.toHaveBeenCalled();
    expect(runQuickCheck).not.toHaveBeenCalled();
    expect(reviewCard).not.toHaveBeenCalled();
  });

  it("counts down a 10-minute client-side timer ring", async () => {
    vi.useFakeTimers();
    await renderRest();

    expect(screen.getByText(/\b10:00\b/)).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(/\b09:59\b/)).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.getByText(/\b09:00\b/)).toBeVisible();
  });
});
