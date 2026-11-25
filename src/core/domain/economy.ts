export type RoomBgId = "day" | "minimal" | "greenhouse" | "treehouse" | "night";
export type SkinPackId = "pastel" | "neon" | "dark" | "sunset";
export type BookCoverStyle =
  | "sage"
  | "honey"
  | "gingham"
  | "berry"
  | "denim"
  | "forest";
export type ShopItemKind =
  | "room"
  | "skin_pack"
  | "accessory"
  | "streak_restore";

export interface AudioPrefs {
  music: number;
  sfx: number;
  voice: number;
}

export interface NotebookBookPrefs {
  maxPages?: number;
  cover?: BookCoverStyle;
  title?: string;
}

export interface PlayerEconomyState {
  userId: string;
  coins: number;
  level: number;
  xp: number;
  xpMax: number;
  streakDays: number;
  streakRestores: number;
  streakMissedDays: number;
  lastStudyDate: string | null;
  activeRoomBg: RoomBgId;
  ownedRooms: Record<RoomBgId, boolean>;
  ownedSkinPacks: Record<SkinPackId, boolean>;
  activeSkinPack: SkinPackId;
  ownedAccessories: Record<string, boolean>;
  equippedSlots: (string | null)[];
  claimedTasks: Record<string, boolean>;
  notebookPrefs: Record<string, NotebookBookPrefs>;
  audioPrefs: AudioPrefs;
  updatedAt: string;
}

export interface CoinLedgerEntry {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  itemRef: string | null;
  balanceAfter: number;
  createdAt: string;
}

export const ROOM_PRICES: Record<RoomBgId, number> = {
  day: 0,
  minimal: 0,
  greenhouse: 120,
  treehouse: 200,
  night: 300,
};

export const SKIN_PACK_PRICES: Record<SkinPackId, number> = {
  pastel: 0,
  neon: 180,
  dark: 220,
  sunset: 160,
};

export const ACCESSORY_PRICES: Record<string, number> = {
  glasses: 0,
  beanie: 0,
  bow: 120,
  gradcap: 240,
};

export const STREAK_RESTORE_PRICE = 80;
export const MAX_STREAK_RESTORES = 2;
export const DEFAULT_NOTEBOOK_MAX_PAGES = 20;
export const MAX_NOTEBOOK_PAGES = 60;

export const EXPAND_PAGE_PACKS = [
  { addPages: 10, cost: 50 },
  { addPages: 20, cost: 90 },
] as const;

export const DAILY_TASK_REWARDS: Record<
  string,
  { coins: number; xp: number; label: string }
> = {
  teach_lesson: { coins: 35, xp: 80, label: "Teach a lesson" },
  water_review: { coins: 30, xp: 60, label: "Review memory cards" },
  quiz_play: { coins: 50, xp: 120, label: "Complete a Quiz Check" },
  bath_clean: { coins: 25, xp: 50, label: "Clear shaky cards" },
};

export function createDefaultEconomyState(
  userId: string,
  nowIso: string = "2026-11-25T00:00:00.000Z",
): PlayerEconomyState {
  return {
    userId,
    coins: 240,
    level: 1,
    xp: 0,
    xpMax: 1000,
    streakDays: 0,
    streakRestores: 1,
    streakMissedDays: 0,
    lastStudyDate: null,
    activeRoomBg: "day",
    ownedRooms: {
      day: true,
      minimal: true,
      greenhouse: false,
      treehouse: false,
      night: false,
    },
    ownedSkinPacks: {
      pastel: true,
      neon: false,
      dark: false,
      sunset: false,
    },
    activeSkinPack: "pastel",
    ownedAccessories: {
      glasses: true,
      beanie: true,
      bow: false,
      gradcap: false,
    },
    equippedSlots: ["glasses", null, null, null],
    claimedTasks: {},
    notebookPrefs: {},
    audioPrefs: { music: 70, sfx: 85, voice: 90 },
    updatedAt: nowIso,
  };
}

export function applyXpGain(
  level: number,
  xp: number,
  xpMax: number,
  deltaXp: number,
): { level: number; xp: number; xpMax: number } {
  let curLevel = Math.max(1, Math.floor(level));
  let curXp = Math.max(0, Math.floor(xp)) + Math.max(0, Math.floor(deltaXp));
  const cap = Math.max(100, Math.floor(xpMax));

  while (curXp >= cap) {
    curXp -= cap;
    curLevel += 1;
  }

  return { level: curLevel, xp: curXp, xpMax: cap };
}

export type ShopValidationErrorCode =
  | "unknown_item"
  | "already_owned"
  | "cap_reached"
  | "insufficient_coins";

export type ShopPurchaseValidation =
  | {
      ok: true;
      cost: number;
      reason: string;
      itemRef: string;
      patch: Partial<
        Pick<
          PlayerEconomyState,
          | "ownedRooms"
          | "activeRoomBg"
          | "ownedSkinPacks"
          | "activeSkinPack"
          | "ownedAccessories"
          | "streakRestores"
        >
      >;
    }
  | { ok: false; code: ShopValidationErrorCode; error: string };

export function validateShopPurchase(
  state: PlayerEconomyState,
  kind: ShopItemKind,
  itemId: string,
): ShopPurchaseValidation {
  if (kind === "room") {
    if (!(itemId in ROOM_PRICES)) {
      return {
        ok: false,
        code: "unknown_item",
        error: "Unknown room theme.",
      };
    }
    const roomId = itemId as RoomBgId;
    if (state.ownedRooms[roomId]) {
      return {
        ok: false,
        code: "already_owned",
        error: "Room theme is already owned.",
      };
    }
    const cost = ROOM_PRICES[roomId];
    if (state.coins < cost) {
      return {
        ok: false,
        code: "insufficient_coins",
        error: "Not enough coins for this room.",
      };
    }
    return {
      ok: true,
      cost,
      reason: "unlock_room",
      itemRef: roomId,
      patch: {
        ownedRooms: { ...state.ownedRooms, [roomId]: true },
        activeRoomBg: roomId,
      },
    };
  }

  if (kind === "skin_pack") {
    if (!(itemId in SKIN_PACK_PRICES)) {
      return {
        ok: false,
        code: "unknown_item",
        error: "Unknown skin pack.",
      };
    }
    const packId = itemId as SkinPackId;
    if (state.ownedSkinPacks[packId]) {
      return {
        ok: false,
        code: "already_owned",
        error: "Skin pack is already owned.",
      };
    }
    const cost = SKIN_PACK_PRICES[packId];
    if (state.coins < cost) {
      return {
        ok: false,
        code: "insufficient_coins",
        error: "Not enough coins for this skin pack.",
      };
    }
    return {
      ok: true,
      cost,
      reason: "unlock_skin_pack",
      itemRef: packId,
      patch: {
        ownedSkinPacks: { ...state.ownedSkinPacks, [packId]: true },
        activeSkinPack: packId,
      },
    };
  }

  if (kind === "accessory") {
    if (!(itemId in ACCESSORY_PRICES)) {
      return {
        ok: false,
        code: "unknown_item",
        error: "Unknown accessory.",
      };
    }
    if (state.ownedAccessories[itemId]) {
      return {
        ok: false,
        code: "already_owned",
        error: "Accessory is already owned.",
      };
    }
    const cost = ACCESSORY_PRICES[itemId];
    if (state.coins < cost) {
      return {
        ok: false,
        code: "insufficient_coins",
        error: "Not enough coins for this accessory.",
      };
    }
    return {
      ok: true,
      cost,
      reason: "unlock_accessory",
      itemRef: itemId,
      patch: {
        ownedAccessories: { ...state.ownedAccessories, [itemId]: true },
      },
    };
  }

  if (state.streakRestores >= MAX_STREAK_RESTORES) {
    return {
      ok: false,
      code: "cap_reached",
      error: "Streak restore pouch is full.",
    };
  }
  if (state.coins < STREAK_RESTORE_PRICE) {
    return {
      ok: false,
      code: "insufficient_coins",
      error: "Not enough coins for a streak restore.",
    };
  }
  return {
    ok: true,
    cost: STREAK_RESTORE_PRICE,
    reason: "buy_streak_restore",
    itemRef: "streak_restore",
    patch: {
      streakRestores: state.streakRestores + 1,
    },
  };
}

export function validateExpandPages(
  state: PlayerEconomyState,
  bookId: string,
  addPages: number,
):
  | {
      ok: true;
      cost: number;
      nextMax: number;
      notebookPrefs: Record<string, NotebookBookPrefs>;
    }
  | { ok: false; code: "invalid_pack" | "cap_reached" | "insufficient_coins"; error: string } {
  const pack = EXPAND_PAGE_PACKS.find((p) => p.addPages === addPages);
  if (!pack || !bookId.trim()) {
    return {
      ok: false,
      code: "invalid_pack",
      error: "Invalid page expansion pack.",
    };
  }

  const existing = state.notebookPrefs[bookId] ?? {};
  const currentMax = existing.maxPages ?? DEFAULT_NOTEBOOK_MAX_PAGES;
  if (currentMax >= MAX_NOTEBOOK_PAGES) {
    return {
      ok: false,
      code: "cap_reached",
      error: "Notebook is already at max page capacity.",
    };
  }

  if (state.coins < pack.cost) {
    return {
      ok: false,
      code: "insufficient_coins",
      error: "Not enough coins to expand pages.",
    };
  }

  const nextMax = Math.min(MAX_NOTEBOOK_PAGES, currentMax + pack.addPages);
  return {
    ok: true,
    cost: pack.cost,
    nextMax,
    notebookPrefs: {
      ...state.notebookPrefs,
      [bookId]: { ...existing, maxPages: nextMax },
    },
  };
}

export function validateClaimDailyTask(
  state: PlayerEconomyState,
  taskId: string,
):
  | {
      ok: true;
      coins: number;
      xp: number;
      claimedTasks: Record<string, boolean>;
      levelState: { level: number; xp: number; xpMax: number };
    }
  | { ok: false; code: "unknown_task" | "already_claimed"; error: string } {
  const task = DAILY_TASK_REWARDS[taskId];
  if (!task) {
    return {
      ok: false,
      code: "unknown_task",
      error: "Unknown daily task.",
    };
  }
  if (state.claimedTasks[taskId]) {
    return {
      ok: false,
      code: "already_claimed",
      error: "Daily task reward already claimed.",
    };
  }

  return {
    ok: true,
    coins: task.coins,
    xp: task.xp,
    claimedTasks: { ...state.claimedTasks, [taskId]: true },
    levelState: applyXpGain(state.level, state.xp, state.xpMax, task.xp),
  };
}

export function validateUseStreakRestore(
  state: PlayerEconomyState,
):
  | { ok: true; streakRestores: number; streakMissedDays: number }
  | { ok: false; code: "not_missed" | "restore_locked" | "none_owned"; error: string } {
  if (state.streakMissedDays <= 0) {
    return {
      ok: false,
      code: "not_missed",
      error: "Your streak is already safe.",
    };
  }
  if (state.streakMissedDays >= 2) {
    return {
      ok: false,
      code: "restore_locked",
      error: "Streaks cannot be restored after 2 or more missed days.",
    };
  }
  if (state.streakRestores <= 0) {
    return {
      ok: false,
      code: "none_owned",
      error: "You have no streak restores left.",
    };
  }
  return {
    ok: true,
    streakRestores: state.streakRestores - 1,
    streakMissedDays: 0,
  };
}
