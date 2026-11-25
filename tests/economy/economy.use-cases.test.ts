import { describe, expect, it } from "vitest";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import {
  claimDailyTask,
  expandNotebookPages,
  getPlayerEconomy,
  purchaseShopItem,
  updatePlayerPreferences,
  useStreakRestore,
} from "@/core/application/use-cases/economy";

describe("economy use cases", () => {
  it("returns unauthenticated when no user is signed in", async () => {
    const { deps, setUser } = createInMemoryPorts();
    setUser(null);

    await expect(
      getPlayerEconomy({ currentUser: deps.currentUser, economy: deps.economy }),
    ).resolves.toEqual({ status: "unauthenticated" });
    await expect(
      purchaseShopItem(
        { currentUser: deps.currentUser, economy: deps.economy },
        { kind: "room", itemId: "greenhouse" },
      ),
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("persists purchases, notebook expansions, task claims, streak restores, and ledger history", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "student-42" });
    const ctx = { currentUser: deps.currentUser, economy: deps.economy };

    const init = await getPlayerEconomy(ctx);
    expect(init.status).toBe("ok");
    if (init.status !== "ok") return;
    expect(init.state.coins).toBe(240);

    const buyAcc = await purchaseShopItem(ctx, {
      kind: "accessory",
      itemId: "bow",
    });
    expect(buyAcc.status).toBe("ok");
    if (buyAcc.status === "ok") {
      expect(buyAcc.state.coins).toBe(120);
      expect(buyAcc.state.ownedAccessories.bow).toBe(true);
    }

    const expand = await expandNotebookPages(ctx, {
      bookId: "nog-1",
      addPages: 10,
    });
    expect(expand.status).toBe("ok");
    if (expand.status === "ok") {
      expect(expand.state.coins).toBe(70);
      expect(expand.state.notebookPrefs["nog-1"]?.maxPages).toBe(30);
    }

    const claim = await claimDailyTask(ctx, { taskId: "quiz_play" });
    expect(claim).toMatchObject({ status: "ok", rewardCoins: 50, rewardXp: 120 });

    const prefs = await updatePlayerPreferences(ctx, {
      audioPrefs: { music: 40, sfx: 75, voice: 95 },
      equippedSlots: ["glasses", null, "bow", null],
    });
    expect(prefs.status).toBe("ok");

    const row = stores.economy.get("student-42");
    if (row) {
      row.streakMissedDays = 1;
      row.streakRestores = 1;
    }
    const restored = await useStreakRestore(ctx);
    expect(restored.status).toBe("ok");
    if (restored.status === "ok") {
      expect(restored.state.streakMissedDays).toBe(0);
      expect(restored.state.streakRestores).toBe(0);
    }

    const after = await getPlayerEconomy(ctx);
    expect(after.status).toBe("ok");
    if (after.status === "ok") {
      expect(after.state.coins).toBe(120);
      expect(after.ledger).toHaveLength(3);
      expect(after.ledger.map((l) => l.reason)).toEqual([
        "claim_daily_task",
        "expand_notebook_pages",
        "unlock_accessory",
      ]);
    }
  });
});
