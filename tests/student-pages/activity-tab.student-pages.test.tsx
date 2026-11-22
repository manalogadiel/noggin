// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  now,
  packetNog,
  sampleActivityEvents,
  sproutNog,
  type GetRecentActivityResult,
} from "./fixtures";

const { getRecentActivity } = vi.hoisted(() => ({
  getRecentActivity: vi.fn<() => Promise<GetRecentActivityResult>>(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    clock: {
      now: () => new Date(now.getTime()),
    },
    getRecentActivity,
  }),
}));

type ErrorProps = { error: Error; reset: () => void; retry?: () => void };

const routeBase = "../../src/app/(app)/profile/activity";
const pageModules = import.meta.glob<{
  default: () => ReactElement | Promise<ReactElement>;
}>("../../src/app/*/profile/activity/page.tsx");
const loadingModules = import.meta.glob<{ default: ComponentType }>(
  "../../src/app/*/profile/activity/loading.tsx",
);
const errorModules = import.meta.glob<{ default: ComponentType<ErrorProps> }>(
  "../../src/app/*/profile/activity/error.tsx",
);

async function loadActivityPage() {
  const loader = pageModules[`${routeBase}/page.tsx`];
  if (!loader) {
    throw new Error("Missing route: src/app/(app)/profile/activity/page.tsx");
  }
  return (await loader()).default;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  getRecentActivity.mockResolvedValue({
    status: "ok",
    events: sampleActivityEvents,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Recent Activity tab (/profile/activity)", () => {
  it("groups events by day under Today, Yesterday, and earlier date h2 headings inside ordered lists with result labels and Nog links", async () => {
    const ActivityPage = await loadActivityPage();
    const { container } = render(await ActivityPage());

    expect(
      screen.getByRole("heading", { level: 2, name: /^Today$/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: /^Yesterday$/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: /Nov\s+14/i }),
    ).toBeVisible();

    expect(container.querySelector("ol")).not.toBeNull();

    // Titles "{nogName} · {topicName}"
    expect(
      screen.getAllByText(/Packet\s*·\s*TCP handshake/i).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText(/Bramble\s*·\s*HTTP caching/i),
    ).toBeVisible();

    // Result descriptions
    expect(screen.getByText(/3\/8\s+correct/i)).toBeVisible();
    expect(screen.getAllByText(/Lesson saved/i)).toHaveLength(2);
    expect(
      screen.getByText(/Answered (?:Packet['’]s|a) question/i),
    ).toBeVisible();

    // Formatted times (AM/PM or locale time)
    expect(
      screen.getAllByText(/\d{1,2}:\d{2}/).length,
    ).toBeGreaterThanOrEqual(4);

    // Every row links to its Nog room
    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/nogs/${packetNog.id}`);
    expect(hrefs).toContain(`/nogs/${sproutNog.id}`);
  });

  it("shows the empty state and a Go to My Nogs link to /nogs when there is no activity yet", async () => {
    getRecentActivity.mockResolvedValueOnce({
      status: "ok",
      events: [],
    });
    const ActivityPage = await loadActivityPage();
    render(await ActivityPage());

    expect(
      screen.getByText(/Nothing yet\s*[—–-]\s*teach your Nog something!/i),
    ).toBeVisible();
    const nogsLink = screen.getByRole("link", { name: /go to my nogs/i });
    expect(nogsLink).toHaveAttribute("href", "/nogs");
  });

  it("provides loading and error boundaries for /profile/activity", async () => {
    const loadLoading = loadingModules[`${routeBase}/loading.tsx`];
    if (!loadLoading) {
      throw new Error(
        "Missing loading boundary: src/app/(app)/profile/activity/loading.tsx",
      );
    }
    const { default: Loading } = await loadLoading();
    const { container } = render(<Loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
    cleanup();

    const loadError = errorModules[`${routeBase}/error.tsx`];
    if (!loadError) {
      throw new Error(
        "Missing error boundary: src/app/(app)/profile/activity/error.tsx",
      );
    }
    const { default: ErrorBoundary } = await loadError();
    const reset = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary
        error={new Error("Failed to load recent activity")}
        reset={reset}
        retry={reset}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/brain fog/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
