// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import type { NogRecord, NogStageSlug } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { petNog } from "@/core/application/use-cases/pet-nog";
import type { VitalsResult } from "@/core/domain/vitals";
import { savedSettings, type ProfileSettings, type SaveProfileSettings } from "./fixtures";

const nog: NogRecord = {
  id: "nog-packet",
  ownerId: "learner-a",
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Packet",
  stage: "sprout",
  happiness: 70,
};
const roomHref = "/nogs/nog-packet";
const vitals: VitalsResult = { happiness: 0.7, clarity: 0.6, vitality: 1, faint: false };
const cannedLines = [
  "Hehe, that tickles!",
  "Again! Again!",
  "Teach me something?",
  "I'm all ears… sort of.",
  "Boop!",
  "Feed me knowledge!",
];
const observeIntersection = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  usePathname: () => "/nogs/nog-packet",
}));
vi.mock("@/app/(auth)/actions", () => ({ signOutAction: vi.fn() }));

interface RoomViewProps {
  nog: NogRecord;
  vitals: VitalsResult;
  progress: number;
  initialSettings: ProfileSettings;
  onSaveSettings: SaveProfileSettings;
  onPet: () => Promise<void>;
}

const viewPath = "../../src/components/room/nog-room-view.tsx";
const viewModules = import.meta.glob<{ NogRoomView: ComponentType<RoomViewProps> }>(
  "../../src/components/room/nog-room-view.tsx",
);
const comingNextPath = "../../src/components/room/room-coming-next.tsx";
const comingNextModules = import.meta.glob<{
  RoomComingNext: ComponentType<{ nogId: string }>;
}>("../../src/components/room/room-coming-next.tsx");

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

beforeEach(() => {
  setReducedMotion(false);
  // Let the stage pass its capability probe without mounting a WebGL canvas.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    { getExtension: () => null } as unknown as WebGL2RenderingContext,
  );
  observeIntersection.mockClear();
  vi.stubGlobal("IntersectionObserver", class {
    observe = observeIntersection;
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderRoom(overrides: Partial<RoomViewProps> = {}) {
  const load = viewModules[viewPath];
  if (!load) throw new Error("Missing component: src/components/room/nog-room-view.tsx");
  const { NogRoomView } = await load();
  return render(
    <AppShell displayName="Learner">
      <NogRoomView
        nog={nog}
        vitals={vitals}
        progress={42}
        initialSettings={savedSettings}
        onSaveSettings={async () => ({ status: "ok" })}
        onPet={async () => {}}
        {...overrides}
      />
    </AppShell>,
  );
}

function petButton() {
  return screen.getByRole("button", { name: /pet (?:your nog|packet)/i });
}

function useTapClock() {
  // Keep DOM and React timers real while controlling the reaction windows.
  vi.useFakeTimers({ toFake: ["Date"] });
  const start = Date.parse("2026-11-21T03:00:00Z");
  return (button: HTMLElement, elapsedMs: number) => {
    vi.setSystemTime(start + elapsedMs);
    fireEvent.click(button);
  };
}

describe("Nog Room view", () => {
  it.each<[NogStageSlug, number, string]>([
    ["hatchling", 1, "Hatchling"],
    ["sprout", 2, "Sprout"],
    ["scholar", 3, "Scholar"],
    ["genius", 4, "Genius"],
  ])("renders the %s at level %i with progress and Living Sanctuary stats card", async (stage, level, label) => {
    await renderRoom({ nog: { ...nog, stage } });

    const main = within(screen.getByRole("main"));
    expect(main.getByText("Packet")).toBeVisible();
    expect(main.getByText(new RegExp(`Lvl\\.\\s*${level}\\s*·\\s*${label}`))).toBeVisible();
    expect(main.getByRole("progressbar", { value: { now: 42 } })).toBeVisible();
    expect(main.getByText("BRAIN CAPACITY")).toBeVisible();
    expect(main.getByText("HAPPINESS")).toBeVisible();
    expect(main.getByText("CLARITY")).toBeVisible();
    expect(main.getByText("VITALITY")).toBeVisible();
    expect(main.queryByRole("navigation", { name: /nog room sections/i })).not.toBeInTheDocument();
  });

  it("links Teach actions (Feed, Water, Bath) and Sanctuary radial hub links to this Nog's pages", async () => {
    const user = userEvent.setup();
    await renderRoom();

    const main = within(screen.getByRole("main"));
    await user.click(main.getByRole("button", { name: /teach packet/i }));

    for (const [label, path] of [
      ["Feed", "feed"],
      ["Water", "water"],
      ["Bath", "bath"],
      ["Play Quiz", "play"],
      ["Rest", "rest"],
      ["Notebook", "notebook"],
      ["Brain Map", "analysis"],
      ["Customize", "customize"],
    ]) {
      expect(main.getByRole("link", { name: label }))
        .toHaveAttribute("href", `${roomHref}/${path}`);
    }
    expect(main.getByRole("link", { name: "Party Arena" })).toHaveAttribute("href", "/arena");
  });

  it("opens the unified AppShell slide-out navigation from the top bar menu button with Study & Care links", async () => {
    const user = userEvent.setup();
    await renderRoom();

    const main = within(screen.getByRole("main"));
    expect(main.queryByRole("button", { name: /open menu/i })).not.toBeInTheDocument();

    const menu = screen.getByRole("button", { name: "Open menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");

    const panelId = menu.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) throw new Error("The top bar menu button must control the navigation panel");
    expect(within(panel).getByRole("link", { name: "Home" }))
      .toHaveAttribute("href", "/home");
    expect(within(panel).getByRole("link", { name: "Choose Your Nog" }))
      .toHaveAttribute("href", "/nogs");
    expect(within(panel).getByRole("link", { name: "Profile & Shop" }))
      .toHaveAttribute("href", "/profile/progress");
    expect(within(panel).getByRole("link", { name: "Play" }))
      .toHaveAttribute("href", `${roomHref}/play`);
    expect(within(panel).getByRole("link", { name: "Nap" }))
      .toHaveAttribute("href", `${roomHref}/rest`);
    expect(within(panel).getByRole("link", { name: "Notebooks" }))
      .toHaveAttribute("href", `${roomHref}/notebook`);
  });

  it("cycles all six canned lines in a polite live region and starts over", async () => {
    await renderRoom();
    const tapAt = useTapClock();
    const button = petButton();
    const lines = [...cannedLines, cannedLines[0]];

    for (const [index, line] of lines.entries()) {
      tapAt(button, index * 1200);
      const speech = screen.getByText(line, { exact: true });
      expect(speech).toBeVisible();
      expect(speech.closest('[aria-live="polite"], [role="status"]')).not.toBeNull();
      if (index > 0) {
        expect(screen.queryByText(lines[index - 1], { exact: true })).not.toBeInTheDocument();
      }
    }
  });

  it("giggles on a tap, tickles on five taps in two seconds, and hints at Feed on fifteen in five seconds", async () => {
    await renderRoom();
    const tapAt = useTapClock();
    const button = petButton();

    tapAt(button, 0);
    expect(button).toHaveAttribute("data-reaction", "giggle");

    for (const elapsedMs of [500, 1000, 1500]) tapAt(button, elapsedMs);
    expect(button).not.toHaveAttribute("data-reaction", "tickle");
    tapAt(button, 1999);
    expect(button).toHaveAttribute("data-reaction", "tickle");

    for (let elapsedMs = 2200; elapsedMs <= 4600; elapsedMs += 300) {
      tapAt(button, elapsedMs);
    }
    expect(button).not.toHaveAttribute("data-reaction", "annoyed");
    tapAt(button, 4999);
    expect(button).toHaveAttribute("data-reaction", "annoyed");
    expect(screen.getByText(/^(?!feed$).*\bfeed\b/i)).toBeVisible();
  });

  it("keeps spaced taps outside the tickle and annoyed windows", async () => {
    await renderRoom();
    const tapAt = useTapClock();
    const button = petButton();

    for (const elapsedMs of [0, 500, 1000, 1500, 2001]) tapAt(button, elapsedMs);
    expect(button).toHaveAttribute("data-reaction", "giggle");

    for (let index = 0; index < 15; index++) {
      tapAt(button, 10000 + Math.round(index * (5001 / 14)));
    }
    expect(button).not.toHaveAttribute("data-reaction", "annoyed");
  });

  it("shows text feedback and the room poster without starting the live rig under reduced motion", async () => {
    setReducedMotion(true);
    const user = userEvent.setup();
    await renderRoom();

    const button = petButton();
    await user.click(button);

    expect(screen.getByText(cannedLines[0], { exact: true })).toBeVisible();
    const stage = button.querySelector('[data-nog-3d="poster"]');
    const poster = stage?.querySelector("img");
    expect(poster).toBeVisible();
    expect(poster).toHaveAttribute("src", expect.stringContaining("blob-closeup.png"));
    expect(button.querySelector("canvas")).not.toBeInTheDocument();
    expect(observeIntersection).not.toHaveBeenCalledWith(stage);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it("sends taps to the petting use case, which awards at most five happiness points in a day", async () => {
    const { deps } = createInMemoryPorts({ userId: nog.ownerId, nogs: [{ ...nog }] });
    const onPet = vi.fn(async () => {
      await petNog(deps, { nogId: nog.id });
    });
    await renderRoom({ onPet });

    const tapAt = useTapClock();
    const button = petButton();
    for (let index = 0; index < 6; index++) {
      tapAt(button, index * 1200);
      expect(onPet).toHaveBeenCalledTimes(index + 1);
      await act(async () => {
        await onPet.mock.results[index].value;
      });
    }

    await expect(deps.nogs.findOwned(nog.ownerId, nog.id)).resolves.toMatchObject({
      happiness: 75,
      happinessToday: 5,
    });
  });
});

describe("unbuilt room pages", () => {
  it("explains that the activity is coming next and links back to the same room", async () => {
    const load = comingNextModules[comingNextPath];
    if (!load) throw new Error("Missing component: src/components/room/room-coming-next.tsx");
    const { RoomComingNext } = await load();
    render(<RoomComingNext nogId={nog.id} />);

    expect(screen.getByText("This part of the room is being built")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the room" })).toHaveAttribute("href", roomHref);
  });
});
