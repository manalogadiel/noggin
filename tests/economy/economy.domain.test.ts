import { describe, expect, it } from "vitest";
import {
  ACCESSORY_PRICES,
  applyXpGain,
  createDefaultEconomyState,
  MAX_NOTEBOOK_PAGES,
  MAX_STREAK_RESTORES,
  ROOM_PRICES,
  SKIN_PACK_PRICES,
  STREAK_RESTORE_PRICE,
  validateClaimDailyTask,
  validateExpandPages,
  validateShopPurchase,
  validateUseStreakRestore,
} from "@/core/domain/economy";

describe("economy domain rules", () => {
  it("rolls over levels cleanly when XP crosses xpMax multiple times", () => {
    const res = applyXpGain(1, 900, 1000, 1250);
    expect(res).toEqual({ level: 3, xp: 150, xpMax: 1000 });
  });

  it("validates shop purchases across rooms, skin packs, accessories, and streak restores", () => {
    const state = createDefaultEconomyState("user-1");

    const roomBuy = validateShopPurchase(state, "room", "greenhouse");
    expect(roomBuy.ok).toBe(true);
    if (roomBuy.ok) {
      expect(roomBuy.cost).toBe(ROOM_PRICES.greenhouse);
      expect(roomBuy.patch.ownedRooms?.greenhouse).toBe(true);
      expect(roomBuy.patch.activeRoomBg).toBe("greenhouse");
    }

    const alreadyOwned = validateShopPurchase(state, "skin_pack", "pastel");
    expect(alreadyOwned).toMatchObject({ ok: false, code: "already_owned" });

    const brokeState = { ...state, coins: 100 };
    const insufficient = validateShopPurchase(brokeState, "skin_pack", "neon");
    expect(insufficient).toMatchObject({ ok: false, code: "insufficient_coins" });
    expect(SKIN_PACK_PRICES.neon).toBe(180);
    expect(ACCESSORY_PRICES.gradcap).toBe(240);

    const capped = { ...state, streakRestores: MAX_STREAK_RESTORES };
    expect(
      validateShopPurchase(capped, "streak_restore", "streak_restore"),
    ).toMatchObject({ ok: false, code: "cap_reached" });
    expect(STREAK_RESTORE_PRICE).toBe(80);
  });

  it("enforces notebook page pack choices and MAX_NOTEBOOK_PAGES cap", () => {
    const state = createDefaultEconomyState("user-1");

    expect(validateExpandPages(state, "nb-1", 99)).toMatchObject({
      ok: false,
      code: "invalid_pack",
    });

    const expand = validateExpandPages(state, "nb-1", 20);
    expect(expand).toMatchObject({ ok: true, cost: 90, nextMax: 40 });

    const atCap = {
      ...state,
      notebookPrefs: { "nb-1": { maxPages: MAX_NOTEBOOK_PAGES } },
    };
    expect(validateExpandPages(atCap, "nb-1", 10)).toMatchObject({
      ok: false,
      code: "cap_reached",
    });
  });

  it("prevents claiming the same daily task twice", () => {
    const state = createDefaultEconomyState("user-1");
    const first = validateClaimDailyTask(state, "quiz_play");
    expect(first).toMatchObject({ ok: true, coins: 50, xp: 120 });

    const claimed = { ...state, claimedTasks: { quiz_play: true } };
    expect(validateClaimDailyTask(claimed, "quiz_play")).toMatchObject({
      ok: false,
      code: "already_claimed",
    });
  });

  it("allows restoring 1 missed streak day and blocks 2+ missed days", () => {
    const oneDay = {
      ...createDefaultEconomyState("user-1"),
      streakDays: 6,
      streakMissedDays: 1,
      streakRestores: 1,
    };
    expect(validateUseStreakRestore(oneDay)).toEqual({
      ok: true,
      streakRestores: 0,
      streakMissedDays: 0,
    });

    const twoDays = { ...oneDay, streakMissedDays: 2 };
    expect(validateUseStreakRestore(twoDays)).toMatchObject({
      ok: false,
      code: "restore_locked",
    });
  });
});
