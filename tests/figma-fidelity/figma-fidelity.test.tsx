// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hatchNogAction,
  type HatchNogFormState,
} from "@/app/(app)/actions/nog-actions";
import { CustomizeView } from "@/components/customize/customize-view";
import { AdoptFlow } from "@/components/nog/adopt-flow";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import { NogRoomView } from "@/components/room/nog-room-view";
import { RoomRail } from "@/components/room/room-rail";
import { AppShell } from "@/components/shell/app-shell";
import {
  DEFAULT_PROFILE_SETTINGS,
  type NogRecord,
} from "@/core/application/ports";
import type { HatchNogResult } from "@/core/application/use-cases/hatch-nog";
import type { VitalsResult } from "@/core/domain/vitals";

const {
  usePathnameMock,
  routerPushMock,
  redirectMock,
  revalidatePathMock,
  hatchNogMock,
  customizeNogActionMock,
} = vi.hoisted(() => ({
  usePathnameMock: vi.fn<() => string>(() => "/home"),
  routerPushMock: vi.fn<(href: string) => void>(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePathMock: vi.fn(),
  hatchNogMock: vi.fn<
    (input: { subjectName: string; name: string }) => Promise<HatchNogResult>
  >(),
  customizeNogActionMock: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: vi.fn(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    hatchNog: hatchNogMock,
  }),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: vi.fn(),
}));

vi.mock("@/app/(app)/actions/customize-actions", () => ({
  customizeNogAction: customizeNogActionMock,
}));

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({
    scene,
    tint,
    alt,
  }: NogStageProps & { tint?: string | null }) => (
    <div
      data-testid={`nog-scene-${scene}`}
      data-nog-scene={scene}
      data-tint={tint ?? ""}
      aria-label={alt}
    />
  ),
}));

const sampleNog: NogRecord = {
  id: "nog-packet",
  ownerId: "learner-a",
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Packet",
  stage: "sprout",
  happiness: 75,
  colors: { body: null },
};

const sampleVitals: VitalsResult = {
  happiness: 0.75,
  clarity: 0.65,
  vitality: 1,
  faint: false,
};

const shellFrameModules = import.meta.glob<Record<string, unknown>>(
  "../../src/components/shell/shell-frame.tsx",
);

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  usePathnameMock.mockReturnValue("/home");
  setReducedMotion(true);
});

afterEach(() => {
  cleanup();
});

describe("ShellFrame focus-mode routing and ☰ menu", () => {
  it("renders unified green TopBar with drawer menu trigger across primary and room routes via ShellFrame", async () => {
    const loader = shellFrameModules["../../src/components/shell/shell-frame.tsx"];
    expect(
      loader,
      "Expected src/components/shell/shell-frame.tsx to exist",
    ).toBeTypeOf("function");
    const mod = await loader!();
    expect(mod.ShellFrame).toBeTypeOf("function");

    for (const pathname of ["/home", "/nogs", "/arena", "/profile/progress", "/adopt", "/nogs/nog-packet", "/nogs/nog-packet/feed"]) {
      usePathnameMock.mockReturnValue(pathname);
      const { container, unmount } = render(
        <AppShell displayName="Gadiel" showArena={true}>
          <div>Page content</div>
        </AppShell>,
      );

      expect(container.querySelector("aside")).toBeNull();
      const header = container.querySelector("header");
      expect(header).not.toBeNull();
      const menuBtn = within(header!).getByRole("button", { name: "Open menu" });
      expect(menuBtn).toBeVisible();
      expect(menuBtn).toHaveAttribute("aria-expanded", "false");
      expect(menuBtn).toHaveAttribute("aria-controls");
      expect(
        within(header!).getByRole("link", { name: /gadiel/i }),
      ).toBeVisible();

      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
      unmount();
    }
  });

  it("shows Home, Choose Your Nog, Profile & Shop, Hatch a Nog, and respects showArena in the slide-out menu on /adopt", async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue("/adopt");

    const { rerender } = render(
      <AppShell displayName="Gadiel" showArena={false}>
        <div>Adopt content</div>
      </AppShell>,
    );

    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    await user.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");

    const panelId = menuBtn.getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();

    const panelScope = within(panel!);
    expect(panelScope.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(panelScope.getByRole("link", { name: "Choose Your Nog" })).toHaveAttribute(
      "href",
      "/nogs",
    );
    expect(
      panelScope.getByRole("link", { name: "Profile & Shop" }).getAttribute("href"),
    ).toMatch(/^\/profile(?:\/progress)?$/);
    expect(
      panelScope.getByRole("link", { name: "Hatch a Nog" }),
    ).toHaveAttribute("href", "/adopt");
    expect(
      panelScope.queryByRole("link", { name: "Arena" }),
    ).not.toBeInTheDocument();

    rerender(
      <AppShell displayName="Gadiel" showArena={true}>
        <div>Adopt content</div>
      </AppShell>,
    );
    expect(
      within(document.getElementById(panelId)!).getByRole("link", {
        name: "Arena",
      }),
    ).toHaveAttribute("href", "/arena");
  });

  it("points Study & Care links (Play, Nap, Notebooks) to /nogs/<id>/* on room pages, moves focus to first link, and closes on Escape or outside click", async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue("/nogs/nog-packet/feed");

    render(
      <AppShell displayName="Gadiel" showArena={false}>
        <div>Feed content</div>
      </AppShell>,
    );

    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    await user.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");

    const panelId = menuBtn.getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId)!;
    const panelScope = within(panel);

    expect(panelScope.getByText(/study & care/i)).toBeVisible();
    expect(panelScope.getByRole("link", { name: "Play" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/play",
    );
    expect(panelScope.getByRole("link", { name: "Nap" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/rest",
    );
    expect(panelScope.getByRole("link", { name: "Notebooks" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/notebook",
    );

    const firstLink = panelScope.getAllByRole("link")[0];
    await waitFor(() => {
      expect(firstLink).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(menuBtn).toHaveFocus();

    await user.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() => {
      expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    });
  });
});

describe("AdoptFlow and hatchNogAction Figma fidelity", () => {
  it("renders all 4 adopt steps without a white card, 'Step x of 4' chip, or Back button, and shows 'Start Customizing →' on the Name step", async () => {
    const user = userEvent.setup();
    render(<AdoptFlow />);

    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^back$/i }),
    ).not.toBeInTheDocument();

    const step1Heading = screen.getByRole("heading", {
      level: 1,
      name: "What should your Nog learn?",
    });
    expect(
      step1Heading.closest('[class*="bg-[var(--noggin-white)]"]'),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Networking" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Tap to hatch" }),
    ).toBeVisible();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^back$/i }),
    ).not.toBeInTheDocument();

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    await user.click(eggButton);
    await user.click(eggButton);
    await user.click(eggButton);

    expect(
      screen.getByRole("heading", { level: 1, name: "Meet your Nog" }),
    ).toBeVisible();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^back$/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Name your Nog" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "What will you call me?" }),
    ).toBeVisible();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^back$/i }),
    ).not.toBeInTheDocument();

    const nameInput = screen.getByRole("textbox", { name: /^nog name$/i });
    await user.type(nameInput, "Packet");

    const submitBtn = screen.getByRole("button", {
      name: "Start Customizing →",
    });
    expect(submitBtn).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^meet packet$/i }),
    ).not.toBeInTheDocument();
  });

  it("redirects from hatchNogAction to /nogs/<id>/customize after hatching", async () => {
    hatchNogMock.mockResolvedValueOnce({
      status: "ok",
      nog: sampleNog,
    });

    const formData = new FormData();
    formData.set("subjectName", "Networking");
    formData.set("name", "Packet");

    await expect(
      hatchNogAction({} as HatchNogFormState, formData),
    ).rejects.toThrow("NEXT_REDIRECT:/nogs/nog-packet/customize");
  });
});

describe("CustomizeView Figma fidelity", () => {
  it("renders without a back link ('← Room') and without a mint card wrapper around the controls", () => {
    render(<CustomizeView nog={sampleNog} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Make your Nog Yours" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /room|back/i }),
    ).not.toBeInTheDocument();

    const bodyColorHeading = screen.getByRole("heading", {
      level: 2,
      name: "Body Color",
    });
    expect(
      bodyColorHeading.closest('[class*="bg-[var(--noggin-mint)]"]'),
    ).toBeNull();
  });
});

describe("NogRoomView and RoomRail Figma fidelity", () => {
  it("renders the Living Sanctuary stats card, solo Teach bar toggle, and bottom-right radial wheel links without RoomRail", async () => {
    const user = userEvent.setup();
    render(
      <NogRoomView
        nog={sampleNog}
        vitals={sampleVitals}
        progress={42}
        initialSettings={DEFAULT_PROFILE_SETTINGS}
        onSaveSettings={async () => ({ status: "ok" })}
        onPet={async () => {}}
      />,
    );

    expect(screen.getByText(/Lvl\.\s*2\s*·\s*Sprout/i)).toBeVisible();
    expect(screen.getByText("Packet")).toBeVisible();
    expect(screen.getByText("BRAIN CAPACITY")).toBeVisible();
    expect(screen.getByRole("progressbar")).toBeVisible();
    expect(screen.getByText("HAPPINESS")).toBeVisible();
    expect(screen.getByText("CLARITY")).toBeVisible();
    expect(screen.getByText("VITALITY")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /teach packet/i }));
    for (const action of ["Feed", "Water", "Bath"]) {
      expect(screen.getByRole("link", { name: action })).toHaveAttribute(
        "href",
        `/nogs/nog-packet/${action.toLowerCase()}`,
      );
    }

    expect(screen.getByRole("link", { name: "Notebook" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/notebook",
    );
    expect(screen.getByRole("link", { name: "Brain Map" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/analysis",
    );
    expect(screen.getByRole("link", { name: "Customize" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/customize",
    );
    expect(screen.getByRole("link", { name: "Rest" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/rest",
    );
    expect(screen.getByRole("link", { name: "Play Quiz" })).toHaveAttribute(
      "href",
      "/nogs/nog-packet/play",
    );
    expect(screen.getByRole("link", { name: "Party Arena" })).toHaveAttribute(
      "href",
      "/arena",
    );

    expect(
      screen.queryByRole("button", { name: /open menu/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /nog room sections/i }),
    ).not.toBeInTheDocument();
  });

  it("positions RoomRail fixed flush against the right screen edge with left-only rounding on sub-pages", () => {
    usePathnameMock.mockReturnValue("/nogs/nog-packet/feed");
    render(<RoomRail nogId="nog-packet" />);

    const rail = screen.getByRole("navigation", { name: "Nog room sections" });
    expect(rail.className).toMatch(/fixed/);
    expect(rail.className).toMatch(/right-0/);
    expect(rail.className).toMatch(/rounded-l/);
  });
});
