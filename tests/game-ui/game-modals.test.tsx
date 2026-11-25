// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { GameModals } from "@/components/game-ui/game-modals";
import { GameUiProvider, useGameUi } from "@/components/game-ui/game-ui-context";

function ModalHarness() {
  const { state, openModal } = useGameUi();
  return (
    <div>
      <span data-testid="coins">{state.coins}</span>
      <span data-testid="is-plus">{String(state.isPlus)}</span>
      <span data-testid="book-max">{state.notebookMaxPages["nb-net"] ?? 20}</span>
      <button type="button" onClick={() => openModal({ type: "streak" })}>Open Streak</button>
      <button type="button" onClick={() => openModal({ type: "topup" })}>Open TopUp</button>
      <button type="button" onClick={() => openModal({ type: "plus" })}>Open Plus</button>
      <button type="button" onClick={() => openModal({ type: "skinShop" })}>Open SkinShop</button>
      <button
        type="button"
        onClick={() => openModal({ type: "expandPages", bookId: "nb-net", bookTitle: "Networking", cover: "sage" })}
      >
        Open Expand
      </button>
      <GameModals />
    </div>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("GameModals", () => {
  it("opens Study Streak and lets the user buy a Streak Restore via ConfirmPurchase", async () => {
    const user = userEvent.setup();
    render(
      <GameUiProvider>
        <ModalHarness />
      </GameUiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open Streak" }));
    expect(screen.getByRole("dialog", { name: "Study Streak" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Buy Streak Restore/i }));
    const confirmDialog = screen.getByRole("dialog", { name: "Confirm purchase" });
    expect(confirmDialog).toHaveTextContent("1x Streak Restore Shield");

    await user.click(screen.getByRole("button", { name: /Buy · 🪙 80/i }));
    expect(screen.getByTestId("coins")).toHaveTextContent("160");
  });

  it("adds coins in Top Up Coins and upgrades to Noggin Plus", async () => {
    const user = userEvent.setup();
    render(
      <GameUiProvider>
        <ModalHarness />
      </GameUiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open TopUp" }));
    await user.click(screen.getByRole("button", { name: /300 coins \+20 Bonus/i }));
    expect(screen.getByTestId("coins")).toHaveTextContent("540");

    await user.click(screen.getByRole("button", { name: /View Noggin Plus/i }));
    expect(screen.getByRole("dialog", { name: "Noggin Plus" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Monthly/i }));
    expect(screen.getByTestId("is-plus")).toHaveTextContent("true");
  });

  it("expands notebook pages and purchases a skin pack", async () => {
    const user = userEvent.setup();
    render(
      <GameUiProvider>
        <ModalHarness />
      </GameUiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open Expand" }));
    await user.click(screen.getByRole("button", { name: /\+10 Pages/i }));
    await user.click(screen.getByRole("button", { name: /Buy · 🪙 60/i }));
    expect(screen.getByTestId("book-max")).toHaveTextContent("30");
    expect(screen.getByTestId("coins")).toHaveTextContent("180");

    await user.click(screen.getByRole("button", { name: /Close expand pages modal/i }));
    await user.click(screen.getByRole("button", { name: "Open SkinShop" }));
    await user.click(screen.getByRole("button", { name: "🪙 180" }));
    await user.click(screen.getByRole("button", { name: /Buy · 🪙 180/i }));
    expect(screen.getByTestId("coins")).toHaveTextContent("0");
  });
});
