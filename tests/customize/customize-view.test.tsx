// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NogRoomPage from "@/app/(app)/nogs/[id]/page";
import type { NogStageProps } from "@/components/nog-3d/nog-stage";
import {
  DEFAULT_PROFILE_SETTINGS,
  type NogRecord,
} from "@/core/application/ports";
import type { GetNogAnalysisResult } from "@/core/application/use-cases/get-nog-analysis";
import type { GetNogRoomResult } from "@/core/application/use-cases/get-nog-room";
import type { CustomizeNogResult } from "./nog-colors.test";

type CustomizableNog = NogRecord & { colors?: { body?: string | null } };

const baseNog: CustomizableNog = {
  id: "nog-packet",
  ownerId: "learner-a",
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Packet",
  stage: "sprout",
  happiness: 75,
};

const roomHref = `/nogs/${baseNog.id}`;
const customizeHref = `${roomHref}/customize`;

const {
  getNogRoom,
  getNogAnalysis,
  getProfileSettings,
  customizeNog,
  notFound,
  routerPush,
  routerBack,
} = vi.hoisted(() => ({
  getNogRoom: vi.fn<(input: { nogId: string }) => Promise<GetNogRoomResult>>(),
  getNogAnalysis:
    vi.fn<(input: { nogId: string }) => Promise<GetNogAnalysisResult>>(),
  getProfileSettings: vi.fn(),
  customizeNog:
    vi.fn<
      (input: { nogId: string; body: string | null }) => Promise<CustomizeNogResult>
    >(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  routerPush: vi.fn<(href: string) => void>(),
  routerBack: vi.fn<() => void>(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    getNogRoom,
    getNogAnalysis,
    getProfileSettings,
    customizeNog,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/app/(app)/actions/room-actions", () => ({
  petNogAction: vi.fn(),
  saveProfileSettingsAction: vi.fn(),
}));

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({
    scene,
    tint,
  }: NogStageProps & { tint?: string | null }) => (
    <div
      data-testid={`nog-scene-${scene}`}
      data-nog-scene={scene}
      data-tint={tint ?? ""}
    />
  ),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const router = {
    push: (href: string) => {
      routerPush(href);
      window.history.pushState(null, "", href);
    },
    replace: (href: string) => window.history.replaceState(null, "", href),
    back: () => {
      routerBack();
      window.history.pushState(null, "", roomHref);
    },
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    ...(await importOriginal<typeof import("next/navigation")>()),
    notFound,
    useRouter: () => router,
    usePathname: () => window.location.pathname,
    useSearchParams: () => new URLSearchParams(window.location.search),
  };
});

type PageProps = { params: Promise<{ id: string }> };
type ErrorProps = { error: Error; reset: () => void; retry?: () => void };

const routeBase = "../../src/app/(app)/nogs/[id]/customize";
const pages = import.meta.glob<{
  default: (props: PageProps) => Promise<ReactElement>;
}>("../../src/app/*/nogs/*/customize/page.tsx");
const loadingFiles = import.meta.glob<{ default: ComponentType }>(
  "../../src/app/*/nogs/*/customize/loading.tsx",
);
const errorFiles = import.meta.glob<{ default: ComponentType<ErrorProps> }>(
  "../../src/app/*/nogs/*/customize/error.tsx",
);
const customizeComponentFiles = import.meta.glob<Record<string, unknown>>(
  "../../src/components/customize/**/*.{ts,tsx}",
);

let currentNog: CustomizableNog;

beforeEach(() => {
  vi.resetAllMocks();
  currentNog = { ...baseNog, colors: { body: null } };
  window.history.replaceState(null, "", customizeHref);

  getNogRoom.mockImplementation(async () => ({
    status: "ok",
    nog: currentNog,
    vitals: { happiness: 0.75, clarity: 0.8, vitality: 1, faint: false },
    cards: [],
  }));
  getNogAnalysis.mockImplementation(async () => ({
    status: "ok",
    nog: currentNog,
    vitals: { happiness: 0.75, clarity: 0.8, vitality: 1, faint: false },
    cards: [],
    masteredCount: 6,
    stage: "Sprout",
  }));
  getProfileSettings.mockResolvedValue({
    status: "ok",
    settings: DEFAULT_PROFILE_SETTINGS,
  });
  customizeNog.mockImplementation(async ({ body }) => {
    currentNog = { ...currentNog, colors: { body } };
    return { status: "ok", nog: currentNog };
  });
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

async function loadCustomizePage() {
  const loader = pages[`${routeBase}/page.tsx`];
  if (!loader) {
    throw new Error(
      "Missing route: src/app/(app)/nogs/[id]/customize/page.tsx",
    );
  }
  if (Object.keys(customizeComponentFiles).length === 0) {
    throw new Error(
      "Missing CustomizeView component under src/components/customize/",
    );
  }
  return (await loader()).default;
}

async function renderCustomize(nogOverride?: Partial<CustomizableNog>) {
  if (nogOverride) {
    currentNog = { ...currentNog, ...nogOverride };
  }
  const Page = await loadCustomizePage();
  return render(
    await Page({
      params: Promise.resolve({ id: currentNog.id }),
    }),
  );
}

describe("CustomizeView (/nogs/[id]/customize)", () => {
  it("renders the heading, subtitle, room rig preview, no back link, and four preset swatches as radios in a Body color radiogroup", async () => {
    await renderCustomize();

    expect(
      screen.getByRole("heading", { level: 1, name: /make your nog yours/i }),
    ).toBeVisible();
    expect(screen.getByText(/customize your nog/i)).toBeVisible();

    expect(
      screen.queryByRole("link", { name: /room|back/i }),
    ).not.toBeInTheDocument();

    const preview = screen.getByTestId("nog-scene-room");
    expect(preview).toBeVisible();
    expect(preview).toHaveAttribute("data-tint", "");

    expect(
      screen.getByRole("heading", { level: 2, name: /body color/i }),
    ).toBeVisible();
    const group = screen.getByRole("radiogroup", { name: /body color/i });
    expect(group).toBeVisible();

    const cream = within(group).getByRole("radio", { name: /^cream$/i });
    const lavender = within(group).getByRole("radio", { name: /^lavender$/i });
    const pink = within(group).getByRole("radio", { name: /^pink$/i });
    const sky = within(group).getByRole("radio", { name: /^sky$/i });

    expect(cream).toBeChecked();
    expect(lavender).not.toBeChecked();
    expect(pink).not.toBeChecked();
    expect(sky).not.toBeChecked();
  });

  it("updates the NogStage preview tint immediately when preset swatches are selected", async () => {
    const user = userEvent.setup();
    await renderCustomize();

    const group = screen.getByRole("radiogroup", { name: /body color/i });
    const cream = within(group).getByRole("radio", { name: /^cream$/i });
    const lavender = within(group).getByRole("radio", { name: /^lavender$/i });
    const pink = within(group).getByRole("radio", { name: /^pink$/i });
    const sky = within(group).getByRole("radio", { name: /^sky$/i });
    const preview = screen.getByTestId("nog-scene-room");

    await user.click(lavender);
    expect(lavender).toBeChecked();
    expect(cream).not.toBeChecked();
    expect(preview).toHaveAttribute("data-tint", "#d9c8f5");

    await user.click(pink);
    expect(pink).toBeChecked();
    expect(lavender).not.toBeChecked();
    expect(preview).toHaveAttribute("data-tint", "#ffc2e6");

    await user.click(sky);
    expect(sky).toBeChecked();
    expect(preview).toHaveAttribute("data-tint", "#c4eef5");

    await user.click(cream);
    expect(cream).toBeChecked();
    expect(preview).toHaveAttribute("data-tint", "");
    expect(customizeNog).not.toHaveBeenCalled();
  });

  it("picks a custom color from the Custom color input, selects a 5th Custom radio swatch, and updates the preview tint", async () => {
    await renderCustomize();

    const colorInput = screen.getByLabelText(/custom color/i);
    expect(colorInput).toHaveAttribute("type", "color");

    fireEvent.change(colorInput, { target: { value: "#34a853" } });

    const group = screen.getByRole("radiogroup", { name: /body color/i });
    const customRadio = within(group).getByRole("radio", { name: /custom/i });
    expect(customRadio).toBeChecked();
    expect(
      within(group).getByRole("radio", { name: /^cream$/i }),
    ).not.toBeChecked();
    expect(screen.getByTestId("nog-scene-room")).toHaveAttribute(
      "data-tint",
      "#34a853",
    );
  });

  it("renders the Accessories section with disabled tiles, a Soon chip, and helper text", async () => {
    await renderCustomize();

    const accessoriesHeading = screen.getByRole("heading", {
      level: 2,
      name: /accessories/i,
    });
    expect(accessoriesHeading).toBeVisible();
    expect(screen.getAllByText(/^soon$/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/hats and bows are coming soon\./i),
    ).toBeVisible();

    const accessoriesSection =
      accessoriesHeading.closest("section, div") ?? document.body;
    const disabledControls = accessoriesSection.querySelectorAll(
      "button:disabled, [aria-disabled='true']",
    );
    expect(disabledControls.length).toBeGreaterThanOrEqual(4);
  });

  it("navigates back to the room without calling customizeNog when Done is clicked with no color change", async () => {
    const user = userEvent.setup();
    await renderCustomize({ colors: { body: "#d9c8f5" } });

    const group = screen.getByRole("radiogroup", { name: /body color/i });
    expect(
      within(group).getByRole("radio", { name: /^lavender$/i }),
    ).toBeChecked();
    expect(screen.getByTestId("nog-scene-room")).toHaveAttribute(
      "data-tint",
      "#d9c8f5",
    );

    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(customizeNog).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(roomHref);
  });

  it("shows Saving… while persisting a changed color on Done, then navigates back to the room", async () => {
    const user = userEvent.setup();
    let resolveSave!: (result: CustomizeNogResult) => void;
    customizeNog.mockReturnValueOnce(
      new Promise<CustomizeNogResult>((resolve) => {
        resolveSave = resolve;
      }),
    );
    await renderCustomize();

    const group = screen.getByRole("radiogroup", { name: /body color/i });
    await user.click(within(group).getByRole("radio", { name: /^pink$/i }));
    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(customizeNog).toHaveBeenCalledExactlyOnceWith({
      nogId: baseNog.id,
      body: "#ffc2e6",
    });

    const savingButton = screen.getByRole("button", { name: /saving/i });
    expect(savingButton).toBeDisabled();

    await act(async () => {
      resolveSave({
        status: "ok",
        nog: { ...baseNog, colors: { body: "#ffc2e6" } },
      });
    });

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(roomHref);
      expect(window.location.pathname).toBe(roomHref);
    });
  });

  it("shows the invalid-color and generic save error messages without leaving the page", async () => {
    const user = userEvent.setup();
    customizeNog
      .mockResolvedValueOnce({ status: "invalid" })
      .mockResolvedValueOnce({ status: "not_found" });
    await renderCustomize();

    const group = screen.getByRole("radiogroup", { name: /body color/i });
    await user.click(within(group).getByRole("radio", { name: /^sky$/i }));
    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(
      await screen.findByText(/that color didn['’]t stick\s*[—–-]\s*pick another/i),
    ).toBeVisible();
    expect(window.location.pathname).toBe(customizeHref);

    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(
      await screen.findByText(/couldn['’]t save\s*[—–-]\s*try again/i),
    ).toBeVisible();
    expect(window.location.pathname).toBe(customizeHref);
  });

  it("calls notFound when the Nog does not belong to the signed-in learner", async () => {
    getNogRoom.mockResolvedValueOnce({ status: "not_found" });
    const Page = await loadCustomizePage();

    await expect(
      Page({ params: Promise.resolve({ id: "unknown-nog" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("provides loading and error boundaries for /nogs/[id]/customize", async () => {
    const loadLoading = loadingFiles[`${routeBase}/loading.tsx`];
    if (!loadLoading) {
      throw new Error(
        "Missing loading boundary: src/app/(app)/nogs/[id]/customize/loading.tsx",
      );
    }
    const { default: Loading } = await loadLoading();
    const { container } = render(<Loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
    cleanup();

    const loadError = errorFiles[`${routeBase}/error.tsx`];
    if (!loadError) {
      throw new Error(
        "Missing error boundary: src/app/(app)/nogs/[id]/customize/error.tsx",
      );
    }
    const { default: ErrorBoundary } = await loadError();
    const reset = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary
        error={new Error("Failed to load customize")}
        reset={reset}
        retry={reset}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/brain fog/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

describe("Nog Room tint without in-room Customize pill", () => {
  it("passes nog.colors.body as the room NogStage tint and links Customize from the Sanctuary radial wheel", async () => {
    currentNog = { ...baseNog, colors: { body: "#d9c8f5" } };
    window.history.replaceState(null, "", roomHref);

    render(
      await NogRoomPage({
        params: Promise.resolve({ id: baseNog.id }),
      }),
    );

    expect(
      screen.getByRole("link", { name: /customize/i }),
    ).toHaveAttribute("href", `${roomHref}/customize`);

    const stage = screen.getByTestId("nog-scene-room");
    expect(stage).toHaveAttribute("data-tint", "#d9c8f5");
  });
});
