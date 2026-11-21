// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/shell/account-menu";
import { Sidebar } from "@/components/shell/sidebar";
import {
  learnerId,
  packetNog,
  type GetLearningProgressResult,
} from "./fixtures";

const { getDisplayName, getLearningProgress, redirect, usePathname } =
  vi.hoisted(() => ({
    getDisplayName: vi.fn<() => Promise<string | null>>(),
    getLearningProgress: vi.fn<() => Promise<GetLearningProgressResult>>(),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    usePathname: vi.fn<() => string>(),
  }));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    currentUser: {
      get: async () => ({ id: learnerId }),
    },
    getDisplayName,
    getLearningProgress,
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

const profilePageModules = import.meta.glob<{
  default: () => ReactElement | Promise<ReactElement>;
}>("../../src/app/*/profile/page.tsx");

const profileLayoutModules = import.meta.glob<{
  default: (props: { children: ReactNode }) => ReactElement | Promise<ReactElement>;
}>("../../src/app/*/profile/layout.tsx");

async function loadProfileIndexPage() {
  const loader = profilePageModules["../../src/app/(app)/profile/page.tsx"];
  if (!loader) {
    throw new Error("Missing route: src/app/(app)/profile/page.tsx");
  }
  return (await loader()).default;
}

async function loadProfileLayout() {
  const loader =
    profileLayoutModules["../../src/app/(app)/profile/layout.tsx"];
  if (!loader) {
    throw new Error("Missing layout: src/app/(app)/profile/layout.tsx");
  }
  return (await loader()).default;
}

beforeEach(() => {
  vi.clearAllMocks();
  usePathname.mockReturnValue("/profile/progress");
  getDisplayName.mockResolvedValue("Cindy");
  getLearningProgress.mockResolvedValue({
    status: "ok",
    summary: {
      nogs: 1,
      topicsWithProgress: 1,
      mastered: 12,
    },
    nogs: [
      {
        id: packetNog.id,
        name: packetNog.name,
        subjectName: "Networking",
        stage: "Sprout",
        nextStage: "Scholar",
        mastered: 12,
        nextThreshold: 15,
        percent: 80,
        topics: [],
      },
    ],
  });
});

afterEach(() => {
  cleanup();
});

describe("/profile index redirect", () => {
  it("redirects /profile to /profile/progress", async () => {
    const ProfilePage = await loadProfileIndexPage();

    try {
      await ProfilePage();
    } catch {
      // Next.js redirect throws in tests.
    }

    expect(redirect).toHaveBeenCalledWith("/profile/progress");
  });
});

describe("Student Profile layout (src/app/(app)/profile/layout.tsx)", () => {
  it.each([
    [0, 1],
    [4, 1],
    [5, 2],
    [12, 3],
    [25, 6],
  ])(
    "renders the Student Profile heading, avatar card, display name, Student label, and Lvl. %i for %i mastered questions",
    async (totalMastered, expectedLevel) => {
      getLearningProgress.mockResolvedValueOnce({
        status: "ok",
        summary: {
          nogs: 1,
          topicsWithProgress: 1,
          mastered: totalMastered,
        },
        nogs: [],
      });
      const ProfileLayout = await loadProfileLayout();

      const { container } = render(
        await ProfileLayout({
          children: <div data-testid="tab-panel">Tab body</div>,
        }),
      );

      expect(
        screen.getByRole("heading", { level: 1, name: "Student Profile" }),
      ).toBeVisible();
      expect(screen.getByText("Cindy")).toBeVisible();
      expect(screen.getByText("Student")).toBeVisible();
      expect(
        screen.getByText(new RegExp(`^Lvl\\.\\s*${expectedLevel}$`, "i")),
      ).toBeVisible();

      const avatar = container.querySelector('img[src*="head.png"]');
      expect(avatar).not.toBeNull();
      expect(screen.getByTestId("tab-panel")).toBeVisible();
    },
  );

  it.each([
    ["/profile/progress", "Learning Progress"],
    ["/profile/activity", "Recent Activity"],
    ["/profile/account", "Account"],
  ] as const)(
    "renders the Profile sections tab nav and marks %s (%s) with aria-current='page'",
    async (pathname, activeLabel) => {
      usePathname.mockReturnValue(pathname);
      const ProfileLayout = await loadProfileLayout();

      render(await ProfileLayout({ children: <div>Child</div> }));

      const nav = screen.getByRole("navigation", {
        name: /profile sections/i,
      });
      const progressLink = within(nav).getByRole("link", {
        name: /learning progress/i,
      });
      const activityLink = within(nav).getByRole("link", {
        name: /recent activity/i,
      });
      const accountLink = within(nav).getByRole("link", {
        name: /^account$/i,
      });

      expect(progressLink).toHaveAttribute("href", "/profile/progress");
      expect(activityLink).toHaveAttribute("href", "/profile/activity");
      expect(accountLink).toHaveAttribute("href", "/profile/account");

      for (const [label, link] of [
        ["Learning Progress", progressLink],
        ["Recent Activity", activityLink],
        ["Account", accountLink],
      ] as const) {
        if (label === activeLabel) {
          expect(link).toHaveAttribute("aria-current", "page");
        } else {
          expect(link).not.toHaveAttribute("aria-current", "page");
        }
      }
    },
  );
});

describe("AccountMenu entry points & Sidebar nav preservation", () => {
  it("shows Profile (/profile/progress) and Account settings (/profile/account) above Log out in the account menu while keeping Sidebar limited to Home and My Nogs", async () => {
    usePathname.mockReturnValue("/home");
    render(
      <>
        <Sidebar />
        <AccountMenu displayName="Cindy" />
      </>,
    );

    const nav = screen.getByRole("navigation", { name: "App" });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());
    expect(labels).toEqual(["Home", "My Nogs"]);

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /account menu for cindy/i }),
    );

    const profileItem =
      screen.queryByRole("menuitem", { name: /^profile$/i }) ??
      screen.getByRole("link", { name: /^profile$/i });
    const accountSettingsItem =
      screen.queryByRole("menuitem", { name: /account settings/i }) ??
      screen.getByRole("link", { name: /account settings/i });
    const logOutItem =
      screen.queryByRole("menuitem", { name: /log out/i }) ??
      screen.getByRole("button", { name: /log out/i });

    expect(profileItem).toBeVisible();
    expect(profileItem.closest("a") ?? profileItem).toHaveAttribute(
      "href",
      "/profile/progress",
    );

    expect(accountSettingsItem).toBeVisible();
    expect(
      accountSettingsItem.closest("a") ?? accountSettingsItem,
    ).toHaveAttribute("href", "/profile/account");

    expect(logOutItem).toBeVisible();
    expect(
      profileItem.compareDocumentPosition(logOutItem) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      accountSettingsItem.compareDocumentPosition(logOutItem) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
