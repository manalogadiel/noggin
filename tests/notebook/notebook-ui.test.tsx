// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameModals } from "@/components/game-ui/game-modals";
import { GameUiProvider } from "@/components/game-ui/game-ui-context";
import { NotebookView } from "@/components/notebook/notebook-view";
import { firstPage, nog, synCard, tcp } from "./fixtures";

vi.mock("@/app/(app)/actions/topic-actions", () => ({
  addTopicAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/nogs/nog-packet/notebook",
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Botanical 3D Notebooks & Expand Pages", () => {
  it("opens 3D bookshelf view, edits notebook title (30-char limit), purchases an extra slot, and opens Expand Pages", async () => {
    const user = userEvent.setup();
    render(
      <GameUiProvider>
        <NotebookView
          nog={nog}
          topics={[tcp]}
          selectedTopic={tcp}
          pages={[firstPage]}
          thoughtCards={[synCard]}
        />
        <GameModals />
      </GameUiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "All Notebooks (3D)" }));
    expect(screen.getByRole("region", { name: "3D notebooks shelf" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Unlock extra notebook slot/i }));
    await user.click(screen.getByRole("button", { name: /Buy · 🪙 150/i }));
    expect(screen.getByText("Unlocked Slot")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const rename = screen.getByLabelText("Title:");
    expect(rename).toHaveAttribute("maxLength", "30");

    await user.click(screen.getByRole("button", { name: "Expand pages" }));
    expect(screen.getByRole("dialog", { name: "Expand Notebook Pages" })).toBeVisible();
  });
});
