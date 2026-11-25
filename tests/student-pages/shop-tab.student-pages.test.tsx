// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { GameModals } from "@/components/game-ui/game-modals";
import { GameUiProvider } from "@/components/game-ui/game-ui-context";
import { ShopView } from "@/components/student/shop-view";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ShopView", () => {
  it("renders Noggin Plus banner and the 3 organized shop sections", () => {
    render(
      <GameUiProvider>
        <GameModals />
        <ShopView />
      </GameUiProvider>,
    );

    expect(screen.getByText("NOGGIN PLUS")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "SKIN PACKS" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "ACCESSORIES" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "ROOMS & UPGRADES" }),
    ).toBeVisible();
  });

  it("opens ConfirmPurchaseModal when buying a locked shop item and unlocks it on confirm", async () => {
    const user = userEvent.setup();
    render(
      <GameUiProvider>
        <GameModals />
        <ShopView />
      </GameUiProvider>,
    );

    const accSection = screen
      .getByRole("heading", { name: "ACCESSORIES" })
      .closest("section")!;
    const buyBow = within(accSection).getByRole("button", {
      name: /Buy 🪙 120/i,
    });
    await user.click(buyBow);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Buy Coral Ribbon Bow?")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: /Buy · 🪙 120/i }));

    expect(within(accSection).getByText("3 / 4 Owned")).toBeVisible();
    expect(
      within(accSection).getAllByRole("button", { name: "Equip Item" }),
    ).toHaveLength(2);
  });
});
