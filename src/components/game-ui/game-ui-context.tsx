"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type RoomBgId = "day" | "minimal" | "greenhouse" | "treehouse" | "night";
export type SkinPackId = "pastel" | "neon" | "dark" | "sunset";
export type BookCoverStyle = "sage" | "honey" | "gingham" | "berry" | "denim" | "forest";

export interface RoomTheme {
  id: RoomBgId;
  name: string;
  src: string;
  price: number;
}

export interface SkinSwatch {
  name: string;
  hex: string;
  filter: string;
}

export interface SkinPack {
  id: SkinPackId;
  name: string;
  price: number;
  swatches: SkinSwatch[];
}

export interface AccessoryItem {
  id: string;
  name: string;
  category: string;
  img: string;
  price: number;
  slot: number;
  defaultStatus: "free" | "owned" | "locked";
}

export interface ConfirmPurchaseRequest {
  title: string;
  itemLabel: string;
  cost: number;
  onConfirm: () => void;
}

export const ROOM_THEMES: RoomTheme[] = [
  { id: "day", name: "Sunlit Study", src: "/game/bg/sanctuary-day.jpg", price: 0 },
  { id: "minimal", name: "Minimal Alcove", src: "/game/bg/sanctuary-minimal.jpg", price: 0 },
  { id: "greenhouse", name: "Botanical Greenhouse", src: "/game/bg/sanctuary-greenhouse.jpg", price: 120 },
  { id: "treehouse", name: "Treehouse Library", src: "/game/bg/sanctuary-treehouse.jpg", price: 200 },
  { id: "night", name: "Lo-Fi Starry Night", src: "/game/bg/sanctuary-night.jpg", price: 300 },
];

export const SKIN_PACKS: SkinPack[] = [
  {
    id: "pastel",
    name: "Pastel",
    price: 0,
    swatches: [
      { name: "Clay", hex: "var(--ng-c-f4efe7)", filter: "none" },
      { name: "Lavender", hex: "var(--ng-c-e7dcf8)", filter: "hue-rotate(235deg) saturate(1.16)" },
      { name: "Blush", hex: "var(--ng-c-ffd2ee)", filter: "hue-rotate(295deg) saturate(1.18)" },
      { name: "Sky", hex: "var(--ng-c-d8f3fc)", filter: "hue-rotate(150deg) saturate(1.12)" },
    ],
  },
  {
    id: "neon",
    name: "Neon",
    price: 180,
    swatches: [
      { name: "Electric Lime", hex: "var(--ng-c-c8ff4d)", filter: "hue-rotate(42deg) saturate(2.1) brightness(1.06)" },
      { name: "Cyber Cyan", hex: "var(--ng-c-5ef2ff)", filter: "hue-rotate(155deg) saturate(2.2) brightness(1.05)" },
      { name: "Hot Magenta", hex: "var(--ng-c-ff66cc)", filter: "hue-rotate(290deg) saturate(2.2) brightness(1.04)" },
      { name: "Laser Lemon", hex: "var(--ng-c-fff04d)", filter: "sepia(0.4) hue-rotate(15deg) saturate(2.4)" },
    ],
  },
  {
    id: "dark",
    name: "Dark",
    price: 220,
    swatches: [
      { name: "Obsidian", hex: "var(--ng-c-3d4252)", filter: "brightness(0.56) contrast(1.18) saturate(0.75)" },
      { name: "Midnight Indigo", hex: "var(--ng-c-444c82)", filter: "hue-rotate(215deg) brightness(0.64) saturate(1.4)" },
      { name: "Plum Shadow", hex: "var(--ng-c-633c6e)", filter: "hue-rotate(275deg) brightness(0.62) saturate(1.35)" },
      { name: "Forest Night", hex: "var(--ng-c-2f5236)", filter: "hue-rotate(85deg) brightness(0.64) saturate(1.25)" },
    ],
  },
  {
    id: "sunset",
    name: "Sunset",
    price: 160,
    swatches: [
      { name: "Peach Coral", hex: "var(--ng-c-ffad8a)", filter: "sepia(0.32) hue-rotate(335deg) saturate(1.55)" },
      { name: "Mango Gold", hex: "var(--ng-c-ffd066)", filter: "sepia(0.42) hue-rotate(8deg) saturate(1.65)" },
      { name: "Berry Dusk", hex: "var(--ng-c-e57a99)", filter: "hue-rotate(312deg) saturate(1.55) brightness(0.95)" },
      { name: "Rose Quartz", hex: "var(--ng-c-ffb8c6)", filter: "hue-rotate(322deg) saturate(1.35)" },
    ],
  },
];

export const ACCESSORIES: AccessoryItem[] = [
  { id: "glasses", name: "Scholar Specs", category: "Eyewear", img: "/game/ui/acc-glasses.svg", price: 0, slot: 0, defaultStatus: "free" },
  { id: "beanie", name: "Sprout Beanie", category: "Hat", img: "/game/ui/acc-beanie.svg", price: 0, slot: 1, defaultStatus: "owned" },
  { id: "bow", name: "Coral Ribbon Bow", category: "Bow", img: "/game/ui/acc-bow.svg", price: 120, slot: 2, defaultStatus: "locked" },
  { id: "gradcap", name: "Scholar Grad Cap", category: "Hat", img: "/game/ui/acc-gradcap.svg", price: 240, slot: 3, defaultStatus: "locked" },
];

export interface PersistedGameUi {
  coins: number;
  level: number;
  xp: number;
  xpMax: number;
  streakDays: number;
  streakRestores: number;
  streakMissedDays: number;
  isPlus: boolean;
  roomBgId: RoomBgId;
  ownedRooms: Record<RoomBgId, boolean>;
  ownedSkinPacks: Record<SkinPackId, boolean>;
  activeSkinPack: SkinPackId;
  ownedAccessories: Record<string, boolean>;
  equippedSlots: (string | null)[];
  claimedTasks: Record<string, boolean>;
  notebookMaxPages: Record<string, number>;
  notebookCovers: Record<string, BookCoverStyle>;
  notebookTitles: Record<string, string>;
  audio: { music: number; sfx: number; voice: number };
}

const DEFAULT_STATE: PersistedGameUi = {
  coins: 240,
  level: 4,
  xp: 680,
  xpMax: 1000,
  streakDays: 6,
  streakRestores: 1,
  streakMissedDays: 0,
  isPlus: false,
  roomBgId: "day",
  ownedRooms: { day: true, minimal: true, greenhouse: false, treehouse: false, night: false },
  ownedSkinPacks: { pastel: true, neon: false, dark: false, sunset: false },
  activeSkinPack: "pastel",
  ownedAccessories: { glasses: true, beanie: true, bow: false, gradcap: false },
  equippedSlots: ["glasses", null, null, null],
  claimedTasks: {},
  notebookMaxPages: {},
  notebookCovers: {},
  notebookTitles: {},
  audio: { music: 70, sfx: 85, voice: 90 },
};

const STORAGE_KEY = "noggin.gameUi.v1";

export type ActiveModal =
  | null
  | { type: "rooms" }
  | { type: "streak" }
  | { type: "topup" }
  | { type: "plus" }
  | { type: "skinShop" }
  | { type: "expandPages"; bookId: string; bookTitle: string; cover: BookCoverStyle };

export interface SanctuaryContextInfo {
  nogId: string;
  nogName: string;
  teachDone: boolean;
  waterDone: boolean;
  petDone: boolean;
  onRequestPetToast?: () => void;
}

interface GameUiContextValue {
  state: PersistedGameUi;
  modal: ActiveModal;
  confirmReq: ConfirmPurchaseRequest | null;
  toastText: string | null;
  sanctuary: SanctuaryContextInfo | null;
  setSanctuary: (info: SanctuaryContextInfo | null) => void;
  showToast: (msg: string) => void;
  openModal: (m: ActiveModal) => void;
  closeModal: () => void;
  requestPurchase: (req: ConfirmPurchaseRequest) => void;
  closeConfirm: () => void;
  updateState: (updater: (prev: PersistedGameUi) => PersistedGameUi) => void;
  awardRewards: (coins: number, xp: number) => void;
  activeRoom: RoomTheme;
}

const GameUiContext = createContext<GameUiContextValue | null>(null);

export function GameUiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedGameUi>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_STATE;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedGameUi>;
        return {
          ...DEFAULT_STATE,
          ...parsed,
          ownedRooms: { ...DEFAULT_STATE.ownedRooms, ...(parsed.ownedRooms ?? {}) },
          ownedSkinPacks: { ...DEFAULT_STATE.ownedSkinPacks, ...(parsed.ownedSkinPacks ?? {}) },
          ownedAccessories: { ...DEFAULT_STATE.ownedAccessories, ...(parsed.ownedAccessories ?? {}) },
          audio: { ...DEFAULT_STATE.audio, ...(parsed.audio ?? {}) },
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_STATE;
  });
  const [modal, setModal] = useState<ActiveModal>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmPurchaseRequest | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [sanctuary, setSanctuary] = useState<SanctuaryContextInfo | null>(null);

  const updateState = useCallback(
    (updater: (prev: PersistedGameUi) => PersistedGameUi) => {
      setState((prev) => {
        const next = updater(prev);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota
        }
        return next;
      });
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 2800);
    return () => window.clearTimeout(t);
  }, [toastText]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof fetch !== "function" ||
      process.env.NODE_ENV === "test" ||
      !window.location.protocol.startsWith("http")
    ) {
      return;
    }

    const controller = new AbortController();
    void fetch("/api/economy", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json()) as {
          state?: {
            coins?: number;
            level?: number;
            xp?: number;
            xpMax?: number;
            streakDays?: number;
            streakRestores?: number;
            streakMissedDays?: number;
            activeRoomBg?: RoomBgId;
            ownedRooms?: Record<RoomBgId, boolean>;
            ownedSkinPacks?: Record<SkinPackId, boolean>;
            activeSkinPack?: SkinPackId;
            ownedAccessories?: Record<string, boolean>;
            equippedSlots?: (string | null)[];
            claimedTasks?: Record<string, boolean>;
            notebookPrefs?: Record<
              string,
              { maxPages?: number; cover?: BookCoverStyle; title?: string }
            >;
            audioPrefs?: { music: number; sfx: number; voice: number };
          };
        };
        const s = payload.state;
        if (!s) return;
        updateState((prev) => {
          const maxPages = { ...prev.notebookMaxPages };
          const covers = { ...prev.notebookCovers };
          const titles = { ...prev.notebookTitles };
          if (s.notebookPrefs) {
            for (const [id, pref] of Object.entries(s.notebookPrefs)) {
              if (typeof pref.maxPages === "number") maxPages[id] = pref.maxPages;
              if (pref.cover) covers[id] = pref.cover;
              if (pref.title) titles[id] = pref.title;
            }
          }
          return {
            ...prev,
            ...(typeof s.coins === "number" ? { coins: s.coins } : {}),
            ...(typeof s.level === "number" ? { level: s.level } : {}),
            ...(typeof s.xp === "number" ? { xp: s.xp } : {}),
            ...(typeof s.xpMax === "number" ? { xpMax: s.xpMax } : {}),
            ...(typeof s.streakDays === "number" ? { streakDays: s.streakDays } : {}),
            ...(typeof s.streakRestores === "number" ? { streakRestores: s.streakRestores } : {}),
            ...(typeof s.streakMissedDays === "number" ? { streakMissedDays: s.streakMissedDays } : {}),
            ...(s.activeRoomBg ? { roomBgId: s.activeRoomBg } : {}),
            ...(s.ownedRooms ? { ownedRooms: { ...prev.ownedRooms, ...s.ownedRooms } } : {}),
            ...(s.ownedSkinPacks ? { ownedSkinPacks: { ...prev.ownedSkinPacks, ...s.ownedSkinPacks } } : {}),
            ...(s.activeSkinPack ? { activeSkinPack: s.activeSkinPack } : {}),
            ...(s.ownedAccessories ? { ownedAccessories: { ...prev.ownedAccessories, ...s.ownedAccessories } } : {}),
            ...(Array.isArray(s.equippedSlots) ? { equippedSlots: s.equippedSlots } : {}),
            ...(s.claimedTasks ? { claimedTasks: { ...prev.claimedTasks, ...s.claimedTasks } } : {}),
            notebookMaxPages: maxPages,
            notebookCovers: covers,
            notebookTitles: titles,
            ...(s.audioPrefs ? { audio: { ...prev.audio, ...s.audioPrefs } } : {}),
          };
        });
      })
      .catch(() => {
        // Offline or unauthenticated fallback uses local state
      });

    return () => controller.abort();
  }, [updateState]);

  const awardRewards = useCallback(
    (coins: number, xp: number) => {
      updateState((prev) => {
        let nextXp = prev.xp + xp;
        let nextLevel = prev.level;
        while (nextXp >= prev.xpMax) {
          nextXp -= prev.xpMax;
          nextLevel += 1;
        }
        return {
          ...prev,
          coins: prev.coins + coins,
          xp: nextXp,
          level: nextLevel,
        };
      });
    },
    [updateState],
  );

  const requestPurchase = useCallback(
    (req: ConfirmPurchaseRequest) => {
      if (state.coins < req.cost) {
        showToast(`Need ${req.cost - state.coins} more coins!`);
        return;
      }
      setConfirmReq(req);
    },
    [state.coins, showToast],
  );

  const closeModal = useCallback(() => setModal(null), []);
  const closeConfirm = useCallback(() => setConfirmReq(null), []);

  const activeRoom = useMemo(
    () => ROOM_THEMES.find((r) => r.id === state.roomBgId) ?? ROOM_THEMES[0],
    [state.roomBgId],
  );

  const value = useMemo<GameUiContextValue>(
    () => ({
      state,
      modal,
      confirmReq,
      toastText,
      sanctuary,
      setSanctuary,
      showToast,
      openModal: setModal,
      closeModal,
      requestPurchase,
      closeConfirm,
      updateState,
      awardRewards,
      activeRoom,
    }),
    [state, modal, confirmReq, toastText, sanctuary, showToast, closeModal, requestPurchase, closeConfirm, updateState, awardRewards, activeRoom],
  );

  return (
    <GameUiContext.Provider value={value}>
      {children}
      {toastText && (
        <div className="toast-region" role="status" aria-live="polite">
          <div className="toast">{toastText}</div>
        </div>
      )}
    </GameUiContext.Provider>
  );
}

const NOOP = () => {};

export function useGameUi(): GameUiContextValue {
  const ctx = useContext(GameUiContext);
  if (!ctx) {
    return {
      state: DEFAULT_STATE,
      modal: null,
      confirmReq: null,
      toastText: null,
      sanctuary: null,
      setSanctuary: NOOP,
      showToast: NOOP,
      openModal: NOOP,
      closeModal: NOOP,
      requestPurchase: NOOP,
      closeConfirm: NOOP,
      updateState: NOOP,
      awardRewards: NOOP,
      activeRoom: ROOM_THEMES[0],
    };
  }
  return ctx;
}
