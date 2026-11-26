import {
  type ShopItemKind,
  type ShopValidationErrorCode,
  validateClaimDailyTask,
  validateExpandPages,
  validateShopPurchase,
  validateUseStreakRestore,
} from "../../domain/economy";
import type {
  CoinLedgerEntry,
  CurrentUser,
  EconomyPreferencesPatch,
  EconomyRepository,
  PlayerEconomyState,
} from "../ports";

export interface EconomyDeps {
  currentUser: CurrentUser;
  economy: EconomyRepository;
}

export type GetPlayerEconomyResult =
  | { status: "unauthenticated" }
  | {
      status: "ok";
      state: PlayerEconomyState;
      ledger: CoinLedgerEntry[];
    };

export async function getPlayerEconomy(
  deps: EconomyDeps,
  input?: { ledgerLimit?: number },
): Promise<GetPlayerEconomyResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const limit = Math.max(1, Math.min(50, input?.ledgerLimit ?? 20));
  const [state, ledger] = await Promise.all([
    deps.economy.getOrInit(user.id),
    deps.economy.listLedger(user.id, limit),
  ]);

  return { status: "ok", state, ledger };
}

export interface PurchaseShopItemInput {
  kind: ShopItemKind;
  itemId: string;
}

export type PurchaseShopItemResult =
  | { status: "unauthenticated" }
  | { status: "rejected"; code: ShopValidationErrorCode; error: string }
  | { status: "ok"; state: PlayerEconomyState };

export async function purchaseShopItem(
  deps: EconomyDeps,
  input: PurchaseShopItemInput,
): Promise<PurchaseShopItemResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const current = await deps.economy.getOrInit(user.id);
  const check = validateShopPurchase(current, input.kind, input.itemId);
  if (!check.ok) {
    return { status: "rejected", code: check.code, error: check.error };
  }

  if (check.cost === 0) {
    const next = await deps.economy.savePreferences(user.id, {
      ...(check.patch.activeRoomBg !== undefined
        ? { activeRoomBg: check.patch.activeRoomBg }
        : {}),
      ...(check.patch.activeSkinPack !== undefined
        ? { activeSkinPack: check.patch.activeSkinPack }
        : {}),
    });
    return { status: "ok", state: next };
  }

  const next = await deps.economy.applyTransaction(user.id, {
    delta: -check.cost,
    reason: check.reason,
    itemRef: check.itemRef,
    patch: check.patch,
  });

  return { status: "ok", state: next };
}

export interface ExpandNotebookPagesInput {
  bookId: string;
  addPages: number;
}

export type ExpandNotebookPagesResult =
  | { status: "unauthenticated" }
  | {
      status: "rejected";
      code: "invalid_pack" | "cap_reached" | "insufficient_coins";
      error: string;
    }
  | { status: "ok"; state: PlayerEconomyState };

export async function expandNotebookPages(
  deps: EconomyDeps,
  input: ExpandNotebookPagesInput,
): Promise<ExpandNotebookPagesResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const current = await deps.economy.getOrInit(user.id);
  const check = validateExpandPages(current, input.bookId, input.addPages);
  if (!check.ok) {
    return { status: "rejected", code: check.code, error: check.error };
  }

  const next = await deps.economy.applyTransaction(user.id, {
    delta: -check.cost,
    reason: "expand_notebook_pages",
    itemRef: input.bookId,
    patch: { notebookPrefs: check.notebookPrefs },
  });

  return { status: "ok", state: next };
}

export interface ClaimDailyTaskInput {
  taskId: string;
}

export type ClaimDailyTaskResult =
  | { status: "unauthenticated" }
  | { status: "rejected"; code: "unknown_task" | "already_claimed"; error: string }
  | {
      status: "ok";
      state: PlayerEconomyState;
      rewardCoins: number;
      rewardXp: number;
    };

export async function claimDailyTask(
  deps: EconomyDeps,
  input: ClaimDailyTaskInput,
): Promise<ClaimDailyTaskResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const current = await deps.economy.getOrInit(user.id);
  const check = validateClaimDailyTask(current, input.taskId);
  if (!check.ok) {
    return { status: "rejected", code: check.code, error: check.error };
  }

  const next = await deps.economy.applyTransaction(user.id, {
    delta: check.coins,
    reason: "claim_daily_task",
    itemRef: input.taskId,
    patch: {
      claimedTasks: check.claimedTasks,
      level: check.levelState.level,
      xp: check.levelState.xp,
      xpMax: check.levelState.xpMax,
    },
  });

  return {
    status: "ok",
    state: next,
    rewardCoins: check.coins,
    rewardXp: check.xp,
  };
}

export type UseStreakRestoreResult =
  | { status: "unauthenticated" }
  | {
      status: "rejected";
      code: "not_missed" | "restore_locked" | "none_owned";
      error: string;
    }
  | { status: "ok"; state: PlayerEconomyState };

export async function useStreakRestore(
  deps: EconomyDeps,
): Promise<UseStreakRestoreResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const current = await deps.economy.getOrInit(user.id);
  const check = validateUseStreakRestore(current);
  if (!check.ok) {
    return { status: "rejected", code: check.code, error: check.error };
  }

  const next = await deps.economy.savePreferences(user.id, {
    streakRestores: check.streakRestores,
    streakMissedDays: check.streakMissedDays,
  });

  return { status: "ok", state: next };
}

export type UpdatePlayerPreferencesResult =
  | { status: "unauthenticated" }
  | { status: "ok"; state: PlayerEconomyState };

export async function updatePlayerPreferences(
  deps: EconomyDeps,
  patch: EconomyPreferencesPatch,
): Promise<UpdatePlayerPreferencesResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const safePatch: EconomyPreferencesPatch = {};
  if (patch.activeRoomBg !== undefined) {
    safePatch.activeRoomBg = patch.activeRoomBg;
  }
  if (patch.activeSkinPack !== undefined) {
    safePatch.activeSkinPack = patch.activeSkinPack;
  }
  if (patch.equippedSlots !== undefined) {
    safePatch.equippedSlots = patch.equippedSlots.slice(0, 4);
  }
  if (patch.notebookPrefs !== undefined) {
    safePatch.notebookPrefs = patch.notebookPrefs;
  }
  if (patch.audioPrefs !== undefined) {
    safePatch.audioPrefs = {
      music: Math.max(0, Math.min(100, Math.round(patch.audioPrefs.music))),
      sfx: Math.max(0, Math.min(100, Math.round(patch.audioPrefs.sfx))),
      voice: Math.max(0, Math.min(100, Math.round(patch.audioPrefs.voice))),
    };
  }

  const state = await deps.economy.savePreferences(user.id, safePatch);
  return { status: "ok", state };
}
