// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HatchNogFormState } from "@/app/(app)/actions/nog-actions";
import { AdoptFlow } from "../adopt-flow";
import { EmptyNogsCard, HatchNewCard, NogCard } from "../nog-card";

const { hatchNogAction } = vi.hoisted(() => ({
  hatchNogAction: vi.fn<
    (prev: HatchNogFormState, formData: FormData) => Promise<HatchNogFormState>
  >(),
}));

vi.mock("@/app/(app)/actions/nog-actions", () => ({
  hatchNogAction,
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
  hatchNogAction.mockReset();
  mockReducedMotion(true);
});

afterEach(cleanup);

describe("AdoptFlow", () => {
  it("walks through subject quick-pick, 3-tap hatch, meet, and naming without a step counter or Back button", async () => {
    const user = userEvent.setup();
    render(<AdoptFlow />);

    expect(
      screen.getByRole("heading", { name: "What should your Nog learn?", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();

    const subjectInput = screen.getByRole("textbox", { name: "Subject" });
    expect(subjectInput).toHaveAttribute("autocomplete", "off");
    expect(subjectInput).toHaveAttribute("maxlength", "40");

    await user.click(screen.getByRole("button", { name: "Networking" }));
    expect(subjectInput).toHaveValue("Networking");

    await user.click(screen.getByRole("button", { name: "Next" }));
    const eggHeading = screen.getByRole("heading", { name: "Tap to hatch", level: 1 });
    expect(eggHeading).toHaveFocus();
    expect(screen.getByLabelText("Taps: 0 of 3")).toBeInTheDocument();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    await user.click(eggButton);
    expect(screen.getByLabelText("Taps: 1 of 3")).toBeInTheDocument();
    await user.click(eggButton);
    expect(screen.getByLabelText("Taps: 2 of 3")).toBeInTheDocument();
    await user.click(eggButton);

    const meetHeading = screen.getByRole("heading", { name: "Meet your Nog", level: 1 });
    expect(meetHeading).toHaveFocus();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Name your Nog" }));
    expect(
      screen.getByRole("heading", { name: "What will you call me?", level: 1 }),
    ).toHaveFocus();
    expect(screen.getByText("Enter the name of your Nog")).toBeInTheDocument();
    expect(screen.queryByText(/step \d+ of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /^nog name$/i }), "Packet");
    expect(screen.getByRole("button", { name: "Start Customizing →" })).toBeEnabled();
  });

  it("returns to step 1 with an alert and focused heading when the subject already has a Nog", async () => {
    const user = userEvent.setup();
    hatchNogAction.mockResolvedValueOnce({
      status: "already_exists",
      error: "You already have a Nog for Networking (Packet). Pick a different subject.",
      subjectName: "Networking",
      name: "Duplicate",
      attempt: 1,
    });

    render(<AdoptFlow />);
    await user.click(screen.getByRole("button", { name: "Networking" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    await user.click(eggButton);
    await user.click(eggButton);
    await user.click(eggButton);

    await user.click(screen.getByRole("button", { name: "Name your Nog" }));
    await user.type(screen.getByRole("textbox", { name: /^nog name$/i }), "Duplicate");
    await user.click(screen.getByRole("button", { name: "Start Customizing →" }));

    const step1Heading = await screen.findByRole("heading", {
      name: "What should your Nog learn?",
      level: 1,
    });
    await waitFor(() => expect(step1Heading).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent(
      /already have a Nog for Networking/i,
    );
  });

  it("stays on step 4 and shows an alert when the Nog name is rejected", async () => {
    const user = userEvent.setup();
    hatchNogAction.mockResolvedValueOnce({
      status: "invalid_name",
      error: "Give your Nog a name between 1 and 24 characters.",
      subjectName: "Marine Biology",
      name: "Coral",
      attempt: 1,
    });

    render(<AdoptFlow />);
    await user.type(screen.getByRole("textbox", { name: "Subject" }), "Marine Biology");
    await user.click(screen.getByRole("button", { name: "Next" }));

    const eggButton = screen.getByRole("button", { name: "Tap the egg" });
    await user.click(eggButton);
    await user.click(eggButton);
    await user.click(eggButton);

    await user.click(screen.getByRole("button", { name: "Name your Nog" }));
    await user.type(screen.getByRole("textbox", { name: /^nog name$/i }), "Coral");
    await user.click(screen.getByRole("button", { name: "Start Customizing →" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /between 1 and 24 characters/i,
    );
    expect(
      screen.getByRole("heading", { name: "What will you call me?", level: 1 }),
    ).toBeInTheDocument();
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

    const packetLink = screen.getByRole("link", {
      name: "Packet, Networking, Sprout",
    });
    expect(packetLink).toHaveAttribute("href", "/nogs/nog-2");
    expect(packetLink.querySelector("img")?.getAttribute("src")).toMatch(
      /thinking\.png/,
    );

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
