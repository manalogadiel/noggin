// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CompleteOnboardingInput,
  CompleteOnboardingResult,
} from "@/app/(app)/actions/nog-actions";
import { AdoptFlow } from "../adopt-flow";
import { EmptyNogsCard, HatchNewCard, NogCard } from "../nog-card";
import { NOG_BODY_COLORS } from "@/core/domain/nog-colors";

const LAVENDER_BODY_COLOR = NOG_BODY_COLORS[1].hex;

const { completeOnboardingAction, routerPush } = vi.hoisted(() => ({
  completeOnboardingAction: vi.fn<
    (input: CompleteOnboardingInput) => Promise<CompleteOnboardingResult>
  >(),
  routerPush: vi.fn<(href: string) => void>(),
}));

vi.mock("@/app/(app)/actions/nog-actions", () => ({
  completeOnboardingAction,
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function mockReducedMotion(matches: boolean) {
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
  completeOnboardingAction.mockReset();
  routerPush.mockReset();
  mockReducedMotion(true);
});

afterEach(cleanup);

describe("AdoptFlow", () => {
  it("starts with 3-tap egg hatch, transitions to Meet, shared Customize (name + dress), and First Notebook with 3D book", async () => {
    const user = userEvent.setup();
    completeOnboardingAction.mockResolvedValueOnce({
      status: "ok",
      nogId: "nog-123",
      topicId: "topic-1",
    });

    const { container } = render(<AdoptFlow />);

    // Step 1: Tap to hatch over sunlit room background (no Subject step!)
    expect(
      screen.getByRole("heading", { name: "Tap to hatch", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /what should your nog learn/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();
    expect(container.querySelector('img[src="/game/bg/sanctuary-day.jpg"]')).not.toBeNull();

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    expect(screen.getByLabelText("Taps: 0 of 3")).toBeInTheDocument();

    await user.click(eggButton);
    expect(screen.getByLabelText("Taps: 1 of 3")).toBeInTheDocument();

    await user.click(eggButton);
    expect(screen.getByLabelText("Taps: 2 of 3")).toBeInTheDocument();
    // Cracking egg visual appears on tap 2
    expect(eggButton.querySelector("img")?.getAttribute("src")).toMatch(
      /egg-cracking\.png/,
    );

    await user.click(eggButton);

    // Step 2: Meet your Nog
    const meetHeading = screen.getByRole("heading", { name: "Meet your Nog", level: 1 });
    expect(meetHeading).toHaveFocus();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Customize Your Nog →" }));

    // Step 3: Exact shared Customize stage (select-stage.jpg backdrop + Nog Name + Body Color + Accessories)
    const customizeHeading = screen.getByRole("heading", {
      name: "Make your Nog Yours",
      level: 1,
    });
    expect(customizeHeading).toHaveFocus();
    expect(container.querySelector('img[src="/game/bg/select-stage.jpg"]')).not.toBeNull();

    // Blank name validation
    await user.click(screen.getByRole("button", { name: "Next: Name Your Notebook →" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 24 characters/i);

    const nameInput = screen.getByRole("textbox", { name: /^nog name$/i });
    await user.type(nameInput, "Pingu");

    const colorGroup = screen.getByRole("radiogroup", { name: /body color/i });
    await user.click(within(colorGroup).getByRole("radio", { name: /^lavender$/i }));
    await user.click(screen.getByRole("button", { name: "Next: Name Your Notebook →" }));

    // Step 4: Name your first notebook with 3D book + cover swatches
    const notebookHeading = screen.getByRole("heading", {
      name: "Name your first notebook",
      level: 1,
    });
    expect(notebookHeading).toHaveFocus();
    expect(screen.getByText(/pingu/i)).toBeInTheDocument();

    const titleInput = screen.getByRole("textbox", { name: /^lesson title$/i });
    expect(titleInput).toHaveAttribute("maxlength", "60");
    await user.click(screen.getByRole("button", { name: "Cell Mitosis" }));
    expect(titleInput).toHaveValue("Cell Mitosis");

    const coverGroup = screen.getByRole("radiogroup", {
      name: /notebook cover style/i,
    });
    await user.click(within(coverGroup).getByRole("radio", { name: /berry cover/i }));

    await user.click(
      screen.getByRole("button", { name: "Create Notebook & Enter Room →" }),
    );

    await waitFor(() => {
      expect(completeOnboardingAction).toHaveBeenCalledWith({
        name: "Pingu",
        bodyColor: LAVENDER_BODY_COLOR,
        notebookTitle: "Cell Mitosis",
        coverStyle: "berry",
        equippedSlots: ["glasses", null, null, null],
      });
    });

    expect(routerPush).toHaveBeenCalledWith("/nogs/nog-123");
  });

  it("shows an alert on step 4 when the notebook title is rejected by the server", async () => {
    const user = userEvent.setup();
    completeOnboardingAction.mockResolvedValueOnce({
      status: "invalid_notebook",
      error: "Use 1 to 60 letters or numbers for your notebook title.",
    });

    render(<AdoptFlow />);

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    await user.click(eggButton);
    await user.click(eggButton);
    await user.click(eggButton);

    await user.click(screen.getByRole("button", { name: "Customize Your Nog →" }));
    await user.type(screen.getByRole("textbox", { name: /^nog name$/i }), "Coral");
    await user.click(screen.getByRole("button", { name: "Next: Name Your Notebook →" }));

    await user.type(screen.getByRole("textbox", { name: /^lesson title$/i }), "!!!");
    await user.click(
      screen.getByRole("button", { name: "Create Notebook & Enter Room →" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /1 to 60 letters or numbers/i,
    );
    expect(
      screen.getByRole("heading", { name: "Name your first notebook", level: 1 }),
    ).toBeInTheDocument();
  });

  it("returns to step 3 with an alert when the server rejects the Nog name", async () => {
    const user = userEvent.setup();
    completeOnboardingAction.mockResolvedValueOnce({
      status: "invalid_name",
      error: "Give your Nog a name between 1 and 24 characters.",
    });

    render(<AdoptFlow />);

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    await user.click(eggButton);
    await user.click(eggButton);
    await user.click(eggButton);

    await user.click(screen.getByRole("button", { name: "Customize Your Nog →" }));
    await user.type(screen.getByRole("textbox", { name: /^nog name$/i }), "Coral");
    await user.click(screen.getByRole("button", { name: "Next: Name Your Notebook →" }));

    await user.type(screen.getByRole("textbox", { name: /^lesson title$/i }), "TCP Handshake");
    await user.click(
      screen.getByRole("button", { name: "Create Notebook & Enter Room →" }),
    );

    const step3Heading = await screen.findByRole("heading", {
      name: "Make your Nog Yours",
      level: 1,
    });
    await waitFor(() => expect(step3Heading).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 24 characters/i);
  });
});

describe("Nog collection cards", () => {
  it("renders Hatchling and Sprout NogCards with exact accessible names and stage renders", () => {
    render(
      <>
        <NogCard
          nog={{
            id: "nog-1",
            name: "Coral",
            subjectName: "Marine Biology",
            stage: "hatchling",
          }}
        />
        <NogCard
          nog={{
            id: "nog-2",
            name: "Packet",
            subjectName: "Networking",
            stage: "sprout",
          }}
        />
        <HatchNewCard />
      </>,
    );

    const coralLink = screen.getByRole("link", {
      name: "Coral, Marine Biology, Hatchling",
    });
    expect(coralLink).toHaveAttribute("href", "/nogs/nog-1");
    expect(coralLink.querySelector("img")?.getAttribute("src")).toMatch(
      /blob-closeup\.png/,
    );
    expect(coralLink).toHaveTextContent(/Lvl\.\s*1/);
    expect(coralLink).not.toHaveTextContent("Hatchling");

    const packetLink = screen.getByRole("link", {
      name: "Packet, Networking, Sprout",
    });
    expect(packetLink).toHaveAttribute("href", "/nogs/nog-2");
    expect(packetLink.querySelector("img")?.getAttribute("src")).toMatch(
      /thinking\.png/,
    );
    expect(packetLink).toHaveTextContent(/Lvl\.\s*2/);
    expect(packetLink).not.toHaveTextContent("Sprout");

    expect(screen.getByRole("link", { name: "Hatch New" })).toHaveAttribute(
      "href",
      "/adopt",
    );
  });

  it("renders EmptyNogsCard linking to /adopt", () => {
    render(<EmptyNogsCard />);
    expect(
      screen.getByRole("link", { name: "Hatch your first Nog" }),
    ).toHaveAttribute("href", "/adopt");
  });
});
