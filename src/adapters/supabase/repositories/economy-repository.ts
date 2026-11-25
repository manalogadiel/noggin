import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AudioPrefs,
  CoinLedgerEntry,
  EconomyPreferencesPatch,
  EconomyRepository,
  EconomyStatePatch,
  EconomyTransactionInput,
  NotebookBookPrefs,
  PlayerEconomyState,
  RoomBgId,
  SkinPackId,
} from "@/core/application/ports";
import { createDefaultEconomyState } from "@/core/domain/economy";
import {
  mapPostgrestError,
  normalizeTimestamp,
  SupabaseAdapterError,
} from "./errors";

interface PlayerEconomyRow {
  user_id: string;
  coins: number;
  level: number;
  xp: number;
  xp_max: number;
  streak_days: number;
  streak_restores: number;
  streak_missed_days: number;
  last_study_date: string | null;
  active_room_bg: string;
  owned_rooms: unknown;
  owned_skin_packs: unknown;
  active_skin_pack: string;
  owned_accessories: unknown;
  equipped_slots: unknown;
  claimed_tasks: unknown;
  notebook_prefs: unknown;
  audio_prefs: unknown;
  updated_at: string;
}

interface CoinLedgerRow {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  item_ref: string | null;
  balance_after: number;
  created_at: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asBooleanMap<K extends string>(
  raw: unknown,
  defaults: Record<K, boolean>,
): Record<K, boolean> {
  const rec = asRecord(raw);
  const out = { ...defaults };
  for (const key of Object.keys(rec)) {
    const val = rec[key];
    if (typeof val === "boolean") {
      (out as Record<string, boolean>)[key] = val;
    }
  }
  return out;
}

function mapEconomyRow(row: PlayerEconomyRow): PlayerEconomyState {
  const defaults = createDefaultEconomyState(row.user_id);
  const audioRaw = asRecord(row.audio_prefs);
  const audioPrefs: AudioPrefs = {
    music: typeof audioRaw.music === "number" ? audioRaw.music : defaults.audioPrefs.music,
    sfx: typeof audioRaw.sfx === "number" ? audioRaw.sfx : defaults.audioPrefs.sfx,
    voice: typeof audioRaw.voice === "number" ? audioRaw.voice : defaults.audioPrefs.voice,
  };

  return {
    userId: row.user_id,
    coins: typeof row.coins === "number" ? row.coins : defaults.coins,
    level: typeof row.level === "number" ? row.level : defaults.level,
    xp: typeof row.xp === "number" ? row.xp : defaults.xp,
    xpMax: typeof row.xp_max === "number" ? row.xp_max : defaults.xpMax,
    streakDays:
      typeof row.streak_days === "number" ? row.streak_days : defaults.streakDays,
    streakRestores:
      typeof row.streak_restores === "number"
        ? row.streak_restores
        : defaults.streakRestores,
    streakMissedDays:
      typeof row.streak_missed_days === "number"
        ? row.streak_missed_days
        : defaults.streakMissedDays,
    lastStudyDate: row.last_study_date ?? null,
    activeRoomBg:
      row.active_room_bg === "minimal" ||
      row.active_room_bg === "greenhouse" ||
      row.active_room_bg === "treehouse" ||
      row.active_room_bg === "night"
        ? (row.active_room_bg as RoomBgId)
        : "day",
    ownedRooms: asBooleanMap(row.owned_rooms, defaults.ownedRooms),
    ownedSkinPacks: asBooleanMap(row.owned_skin_packs, defaults.ownedSkinPacks),
    activeSkinPack:
      row.active_skin_pack === "neon" ||
      row.active_skin_pack === "dark" ||
      row.active_skin_pack === "sunset"
        ? (row.active_skin_pack as SkinPackId)
        : "pastel",
    ownedAccessories: asBooleanMap(
      row.owned_accessories,
      defaults.ownedAccessories,
    ),
    equippedSlots: Array.isArray(row.equipped_slots)
      ? row.equipped_slots
          .slice(0, 4)
          .map((item) => (typeof item === "string" ? item : null))
      : defaults.equippedSlots,
    claimedTasks: asBooleanMap(row.claimed_tasks, {}),
    notebookPrefs: asRecord(row.notebook_prefs) as Record<
      string,
      NotebookBookPrefs
    >,
    audioPrefs,
    updatedAt: row.updated_at
      ? normalizeTimestamp(row.updated_at)
      : defaults.updatedAt,
  };
}

function serializePatch(
  patch: EconomyStatePatch | EconomyPreferencesPatch | undefined,
): Record<string, unknown> {
  if (!patch) return {};
  const out: Record<string, unknown> = {};
  const full = patch as EconomyStatePatch;

  if (full.level !== undefined) out.level = full.level;
  if (full.xp !== undefined) out.xp = full.xp;
  if (full.xpMax !== undefined) out.xp_max = full.xpMax;
  if (full.streakDays !== undefined) out.streak_days = full.streakDays;
  if (full.streakRestores !== undefined)
    out.streak_restores = full.streakRestores;
  if (full.streakMissedDays !== undefined)
    out.streak_missed_days = full.streakMissedDays;
  if (full.lastStudyDate !== undefined) out.last_study_date = full.lastStudyDate;
  if (full.activeRoomBg !== undefined) out.active_room_bg = full.activeRoomBg;
  if (full.ownedRooms !== undefined) out.owned_rooms = full.ownedRooms;
  if (full.ownedSkinPacks !== undefined)
    out.owned_skin_packs = full.ownedSkinPacks;
  if (full.activeSkinPack !== undefined)
    out.active_skin_pack = full.activeSkinPack;
  if (full.ownedAccessories !== undefined)
    out.owned_accessories = full.ownedAccessories;
  if (full.equippedSlots !== undefined) out.equipped_slots = full.equippedSlots;
  if (full.claimedTasks !== undefined) out.claimed_tasks = full.claimedTasks;
  if (full.notebookPrefs !== undefined) out.notebook_prefs = full.notebookPrefs;
  if (full.audioPrefs !== undefined) out.audio_prefs = full.audioPrefs;

  return out;
}

export function createEconomyRepository(options: {
  session: SupabaseClient;
  userId: string;
}): EconomyRepository {
  const { session, userId } = options;

  function assertOwner(targetUserId: string, operation: string) {
    if (targetUserId !== userId) {
      throw new SupabaseAdapterError(
        "FORBIDDEN",
        `Permission denied during ${operation}.`,
      );
    }
  }

  return {
    async getOrInit(targetUserId: string): Promise<PlayerEconomyState> {
      assertOwner(targetUserId, "economy.getOrInit");

      const { data, error } = await session
        .rpc("get_or_init_player_economy")
        .single<PlayerEconomyRow>();

      if (error) {
        throw mapPostgrestError(error, "economy.getOrInit");
      }

      if (!data) {
        return createDefaultEconomyState(targetUserId);
      }
      return mapEconomyRow(data);
    },

    async applyTransaction(
      targetUserId: string,
      input: EconomyTransactionInput,
    ): Promise<PlayerEconomyState> {
      assertOwner(targetUserId, "economy.applyTransaction");

      const { data, error } = await session
        .rpc("apply_coin_transaction", {
          p_delta: input.delta,
          p_reason: input.reason,
          p_item_ref: input.itemRef ?? null,
          p_patch: serializePatch(input.patch),
        })
        .single<PlayerEconomyRow>();

      if (error) {
        throw mapPostgrestError(error, "economy.applyTransaction");
      }

      return mapEconomyRow(data);
    },

    async savePreferences(
      targetUserId: string,
      patch: EconomyPreferencesPatch,
    ): Promise<PlayerEconomyState> {
      assertOwner(targetUserId, "economy.savePreferences");

      const { data, error } = await session
        .rpc("save_player_economy_prefs", {
          p_patch: serializePatch(patch),
        })
        .single<PlayerEconomyRow>();

      if (error) {
        throw mapPostgrestError(error, "economy.savePreferences");
      }

      return mapEconomyRow(data);
    },

    async listLedger(
      targetUserId: string,
      limit: number = 20,
    ): Promise<CoinLedgerEntry[]> {
      assertOwner(targetUserId, "economy.listLedger");

      const { data, error } = await session
        .from("coin_ledger")
        .select("id, user_id, delta, reason, item_ref, balance_after, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<CoinLedgerRow[]>();

      if (error) {
        throw mapPostgrestError(error, "economy.listLedger");
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        delta: row.delta,
        reason: row.reason,
        itemRef: row.item_ref,
        balanceAfter: row.balance_after,
        createdAt: normalizeTimestamp(row.created_at),
      }));
    },
  };
}
