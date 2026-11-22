// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "@/app/(app)/layout";
import { BottomBar } from "@/components/shell/bottom-bar";
import * as navItemsModule from "@/components/shell/nav-items";
import { Sidebar } from "@/components/shell/sidebar";

const { getFeatures, getDisplayName, redirect, usePathname } = vi.hoisted(() => ({
  getFeatures: vi.fn<() => Promise<Record<string, boolean>>>(),
  getDisplayName: vi.fn<() => Promise<string | null>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  usePathname: vi.fn<() => string>(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getFeatures,
    getDisplayName,
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
  usePathname,
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: vi.fn(),
}));

type NavItemShape = {
  href: string;
  label: string;
  icon: string;
};

type NavItemsModuleExtended = typeof navItemsModule & {
  ARENA_ITEM?: NavItemShape;
  navItemsFor?: (options?: { showArena?: boolean }) => ReadonlyArray<NavItemShape>;
};

const arenaComponentModules = import.meta.glob<{
  ArenaPreview?: ComponentType;
  default?: ComponentType;
}>("../../src/components/arena/*.tsx");

const arenaDataModules = import.meta.glob<Record<string, unknown>>(
  "../../src/components/arena/preview-data.ts",
);

const arenaPageModules = import.meta.glob<{
  default: () => ReactElement | Promise<ReactElement>;
}>("../../src/app/*/arena/page.tsx");

async function loadArenaPreview(): Promise<ComponentType> {
  const preferred = arenaComponentModules["../../src/components/arena/arena-preview.tsx"];
  if (preferred) {
    const mod = await preferred();
    const Component = mod.ArenaPreview ?? mod.default;
    if (Component) return Component;
  }

  for (const loader of Object.values(arenaComponentModules)) {
    const mod = await loader();
    if (mod.ArenaPreview) return mod.ArenaPreview;
  }

  throw new Error(
    "Missing ArenaPreview component in src/components/arena/arena-preview.tsx",
  );
}

async function loadArenaPage(): Promise<() => ReactElement | Promise<ReactElement>> {
  const loader = arenaPageModules["../../src/app/(app)/arena/page.tsx"];
  if (!loader) {
    throw new Error("Missing route: src/app/(app)/arena/page.tsx");
  }
  const mod = await loader();
  return mod.default;
}

function expectButtonDisabled(button: HTMLElement) {
  const isDisabled =
    button.hasAttribute("disabled") ||
    button.getAttribute("aria-disabled") === "true";
  expect(isDisabled).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  usePathname.mockReturnValue("/home");
  getDisplayName.mockResolvedValue("Gadiel");
  getFeatures.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe("navItemsFor and ARENA_ITEM", () => {
  it("returns Home and My Nogs when showArena is false or omitted, and appends Arena last when showArena is true", () => {
    const mod = navItemsModule as NavItemsModuleExtended;

    expect(mod.ARENA_ITEM).toEqual({
      href: "/arena",
      label: "Arena",
      icon: "swords",
    });
    expect(mod.navItemsFor).toBeTypeOf("function");

    const withoutArenaDefault = mod.navItemsFor!();
    const withoutArenaExplicit = mod.navItemsFor!({ showArena: false });
    expect(withoutArenaDefault).toEqual([
      { href: "/home", label: "Home", icon: "home" },
      { href: "/nogs", label: "My Nogs", icon: "egg" },
    ]);
    expect(withoutArenaExplicit).toEqual(withoutArenaDefault);

    const withArena = mod.navItemsFor!({ showArena: true });
    expect(withArena).toEqual([
      { href: "/home", label: "Home", icon: "home" },
      { href: "/nogs", label: "My Nogs", icon: "egg" },
      { href: "/arena", label: "Arena", icon: "swords" },
    ]);
  });
});

describe("Sidebar and BottomBar with showArena", () => {
  it("renders Arena in Sidebar only when showArena is true and places it after Home and My Nogs", () => {
    usePathname.mockReturnValue("/arena");
    const SidebarWithProps = Sidebar as ComponentType<{ showArena?: boolean }>;

    const { rerender } = render(<SidebarWithProps showArena={false} />);
    const nav = screen.getByRole("navigation", { name: "App" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Home", "My Nogs"]);
    expect(within(nav).queryByRole("link", { name: "Arena" })).not.toBeInTheDocument();

    rerender(<SidebarWithProps showArena={true} />);
    const linksWithArena = within(nav).getAllByRole("link");
    expect(linksWithArena.map((link) => link.textContent?.trim())).toEqual([
      "Home",
      "My Nogs",
      "Arena",
    ]);
    const arenaLink = within(nav).getByRole("link", { name: "Arena" });
    expect(arenaLink).toHaveAttribute("href", "/arena");
    expect(arenaLink).toHaveAttribute("aria-current", "page");
  });

  it("renders Arena in BottomBar only when showArena is true", () => {
    usePathname.mockReturnValue("/arena");
    const BottomBarWithProps = BottomBar as ComponentType<{ showArena?: boolean }>;

    const { rerender } = render(<BottomBarWithProps showArena={false} />);
    const nav = screen.getByRole("navigation", { name: "App" });
    expect(within(nav).queryByRole("link", { name: "Arena" })).not.toBeInTheDocument();

    rerender(<BottomBarWithProps showArena={true} />);
    const arenaLink = within(nav).getByRole("link", { name: "Arena" });
    expect(arenaLink).toHaveAttribute("href", "/arena");
    expect(arenaLink).toHaveAttribute("aria-current", "page");

    const allLabels = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));
    expect(allLabels).toEqual(["Home", "My Nogs", "Arena", "Hatch a Nog"]);
  });

  it("wires container.getFeatures().arena through AppLayout to AppShell navigation", async () => {
    getFeatures.mockResolvedValueOnce({ arena: false });
    const { unmount } = render(
      await AppLayout({ children: <div>Child content</div> }),
    );
    expect(screen.queryByRole("link", { name: "Arena" })).not.toBeInTheDocument();
    unmount();

    getFeatures.mockResolvedValueOnce({ arena: true });
    render(await AppLayout({ children: <div>Child content</div> }));
    const arenaLinks = screen.getAllByRole("link", { name: "Arena" });
    expect(arenaLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of arenaLinks) {
      expect(link).toHaveAttribute("href", "/arena");
    }
  });
});

describe("ArenaPreview component", () => {
  it("renders the Arena heading, Preview chip, hero VS card with facing-off Nogs, and 3-step battle guide", async () => {
    const ArenaPreview = await loadArenaPreview();
    const { container } = render(<ArenaPreview />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Arena" }),
    ).toBeVisible();
    expect(screen.getByText("Preview")).toBeVisible();
    expect(
      screen.getByText(
        /Battle Nogs with friends\.\s*Every Nog answers only from what you taught it\./i,
      ),
    ).toBeVisible();

    expect(screen.getByText("VS")).toBeVisible();
    expect(screen.getByText(/Live battles open soon/i)).toBeVisible();

    const happyImg = container.querySelector('img[src*="hatchling-happy.png"]');
    const surprisedImg = container.querySelector(
      'img[src*="hatchling-surprised.png"]',
    );
    expect(happyImg).not.toBeNull();
    expect(surprisedImg).not.toBeNull();
    expect(happyImg?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(surprisedImg?.closest('[aria-hidden="true"]')).not.toBeNull();

    expect(
      screen.getByRole("heading", { name: /How battles work/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/Pick a topic you['’]ve taught/i),
    ).toBeVisible();
    expect(
      screen.getByText(/Your Nogs answer the same hidden questions/i),
    ).toBeVisible();
    expect(
      screen.getByText(/Best explained notebook wins XP/i),
    ).toBeVisible();
  });

  it("renders disabled Join a lobby and Quick Match controls that never submit", async () => {
    const ArenaPreview = await loadArenaPreview();
    render(<ArenaPreview />);

    expect(
      screen.getByRole("heading", { name: /Join a lobby/i }),
    ).toBeVisible();

    const joinCodeInput = screen.getByLabelText(/Join code/i) as HTMLInputElement;
    expect(joinCodeInput).toBeVisible();
    expect(joinCodeInput).toHaveAttribute("maxLength", "6");

    const describedById = joinCodeInput.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const hintElement = describedById
      ? document.getElementById(describedById)
      : null;
    expect(hintElement).not.toBeNull();
    expect(hintElement).toHaveTextContent(/Ask your host for the code/i);

    const joinButton = screen.getByRole("button", { name: /\bJoin\b/i });
    expectButtonDisabled(joinButton);

    const form = joinCodeInput.closest("form");
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    if (form) {
      form.addEventListener("submit", onSubmit);
    }
    fireEvent.click(joinButton);
    expect(onSubmit).not.toHaveBeenCalled();

    expect(
      screen.getByRole("heading", { name: /Quick Match/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/Face a Nog at your level in the same subject\./i),
    ).toBeVisible();

    const quickMatchButton = screen.getByRole("button", {
      name: /Find a match/i,
    });
    expectButtonDisabled(quickMatchButton);
    expect(screen.getAllByText(/Opens soon/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders the Weekly League leaderboard with 8 sample players from preview-data, promotion zone divider after rank 7, and highlighted You row", async () => {
    const dataLoader =
      arenaDataModules["../../src/components/arena/preview-data.ts"];
    expect(
      dataLoader,
      "Expected sample data module at src/components/arena/preview-data.ts",
    ).toBeTypeOf("function");

    const ArenaPreview = await loadArenaPreview();
    render(<ArenaPreview />);

    expect(
      screen.getByRole("heading", { name: /Weekly League/i }),
    ).toBeVisible();
    expect(screen.getByText(/Doodle league/i)).toBeVisible();
    expect(
      screen.getByText(/Sample data\s*[—–-]\s*leagues start with the Arena/i),
    ).toBeVisible();

    for (const sampleName of ["Mochi", "Bao", "Kiko"]) {
      expect(screen.getByText(new RegExp(`\\b${sampleName}\\b`))).toBeVisible();
    }

    const mochiNode = screen.getByText(/\bMochi\b/);
    const leagueList = mochiNode.closest("ol");
    expect(leagueList).not.toBeNull();

    const playerRows = Array.from(leagueList!.querySelectorAll("li")).filter(
      (item) => /\bXP\b/i.test(item.textContent ?? ""),
    );
    expect(playerRows).toHaveLength(8);

    const promotionDivider = screen.getByText(/Promotion zone/i);
    expect(promotionDivider).toBeVisible();
    expect(
      playerRows[6].compareDocumentPosition(promotionDivider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      promotionDivider.compareDocumentPosition(playerRows[7]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const highlightedYou = leagueList!.querySelector('[aria-current="true"]');
    expect(highlightedYou).not.toBeNull();
    expect(highlightedYou).toHaveTextContent(/\bYou\b/);
  });
});

describe("/arena page feature flag guard", () => {
  it("redirects to /home when app_config.features.arena is off or missing", async () => {
    const ArenaPage = await loadArenaPage();

    getFeatures.mockResolvedValueOnce({});
    try {
      await ArenaPage();
    } catch {
      // Next.js redirect throws to interrupt rendering.
    }
    expect(redirect).toHaveBeenCalledWith("/home");

    redirect.mockClear();
    getFeatures.mockResolvedValueOnce({ arena: false });
    try {
      await ArenaPage();
    } catch {
      // Next.js redirect throws to interrupt rendering.
    }
    expect(redirect).toHaveBeenCalledWith("/home");
  });

  it("renders the Arena preview when app_config.features.arena is true", async () => {
    const ArenaPage = await loadArenaPage();
    getFeatures.mockResolvedValueOnce({ arena: true });

    render(await ArenaPage());

    expect(redirect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: "Arena" }),
    ).toBeVisible();
    expect(screen.getByText("Preview")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /Weekly League/i }),
    ).toBeVisible();
  });
});
