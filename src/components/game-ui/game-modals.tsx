"use client";

import { useEffect } from "react";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { SKIN_PACKS, useGameUi } from "@/components/game-ui/game-ui-context";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MAX_NOTEBOOK_PAGES = 60;

const COIN_PACKS = [
  { id: "c100", coins: 100, bonus: "", price: "₱49", badge: "" },
  { id: "c300", coins: 300, bonus: "+20 Bonus", price: "₱119", badge: "" },
  { id: "c750", coins: 750, bonus: "+100 Bonus", price: "₱249", badge: "POPULAR" },
  { id: "c1800", coins: 1800, bonus: "+350 Bonus", price: "₱499", badge: "BEST VALUE" },
] as const;

function fireCheckoutRequest(productCode: string) {
  if (
    typeof window === "undefined" ||
    typeof fetch !== "function" ||
    process.env.NODE_ENV === "test" ||
    !window.location.protocol.startsWith("http")
  ) {
    return;
  }

  const key =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${productCode}-${Date.now()}`;

  void fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productCode, idempotencyKey: key }),
  }).catch(() => {
    // Non-blocking fallback keeps UI responsive
  });
}

export function GameModals() {
  const {
    state,
    modal,
    confirmReq,
    openModal,
    closeModal,
    closeConfirm,
    requestPurchase,
    updateState,
    awardRewards,
    showToast,
  } = useGameUi();

  const activeNonRoomModal = modal && modal.type !== "rooms" ? modal : null;

  useEffect(() => {
    if (!confirmReq && !activeNonRoomModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmReq) {
        closeConfirm();
      } else if (activeNonRoomModal) {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReq, activeNonRoomModal, closeConfirm, closeModal]);

  const missed = state.streakMissedDays;
  const blocked2d = missed >= 2;
  const canUseRestore = missed === 1 && state.streakRestores > 0;
  const canBuyRestore = !blocked2d && state.coins >= 80 && state.streakRestores < 2;
  const streakPct = Math.min(100, Math.round((state.streakDays / 7) * 100));

  function handleExpandPack(addPages: number, cost: number) {
    if (activeNonRoomModal?.type !== "expandPages") return;
    const { bookId, bookTitle } = activeNonRoomModal;
    const curMax = state.notebookMaxPages[bookId] ?? 20;
    if (curMax >= MAX_NOTEBOOK_PAGES) return;
    requestPurchase({
      title: "EXPAND NOTEBOOK",
      itemLabel: `+${addPages} Pages for ${bookTitle}`,
      cost,
      onConfirm: () => {
        const nextMax = Math.min(MAX_NOTEBOOK_PAGES, curMax + addPages);
        updateState((prev) => ({
          ...prev,
          coins: Math.max(0, prev.coins - cost),
          notebookMaxPages: { ...prev.notebookMaxPages, [bookId]: nextMax },
        }));
        showToast(`${bookTitle} expanded to ${nextMax} pages!`);
      },
    });
  }

  return (
    <>
      {activeNonRoomModal?.type === "streak" && (
        <div
          className="ng-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="ng-shell ng-shell--coral max-w-[820px]"
            role="dialog"
            aria-modal="true"
            aria-label="Study Streak"
          >
            <header className="ng-shell__head">
              <span className="ng-shell__badge">🪙 {state.coins} COINS</span>
              <h2 className="ng-shell__title">STUDY STREAK</h2>
              <button
                type="button"
                className="ng-shell__close"
                aria-label="Close study streak modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="ng-shell__body grid grid-cols-1 gap-5 md:grid-cols-[1.25fr_0.85fr]">
              <section className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ng-c-fff5d6)] shadow-[0_5px_0_rgb(230_184_122)]">
                    <svg width="40" height="40" viewBox="0 0 36 36" aria-hidden="true">
                      <circle cx="18" cy="18" r="16" fill="var(--ng-c-f3827a)" />
                      <path
                        d="M18.5 8.5c2.2 3.8 5.5 5.6 5.5 10.2a6 6 0 1 1-12 0c0-2.6 1.2-4.8 2.8-6.4.2 1.8 1.2 2.8 2.2 3.1-.4-2.8.1-5.1 1.5-6.9z"
                        fill="var(--ng-c-fff3c4)"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      className="text-4xl leading-none font-black text-[var(--noggin-forest)]"
                      style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
                    >
                      {blocked2d ? "0" : state.streakDays}{" "}
                      <span className="text-base text-[var(--ng-c-bf4a46)]">DAYS</span>
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-[var(--noggin-ink)]">
                      Best Streak: 14 days
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                    missed === 0
                      ? "bg-[var(--ng-c-e8f6d2)] text-[var(--noggin-forest)]"
                      : missed === 1
                        ? "bg-[var(--ng-c-fff0c2)] text-[var(--ng-c-5b3b00)]"
                        : "bg-[rgb(255_224_222)] text-[rgb(143_36_36)]"
                  }`}
                >
                  {missed === 0 ? (
                    <>
                      <strong>Streak Active!</strong> Keep teaching or quizzing daily to grow your flame.
                    </>
                  ) : missed === 1 ? (
                    <>
                      <strong>1 Day Missed!</strong> You can restore your {state.streakDays}-day streak today.
                    </>
                  ) : (
                    <>
                      <strong>2+ Days Missed — Restore Locked.</strong> Streaks can only be restored within 1 missed day.
                    </>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1.5" aria-label="This week streak">
                  {WEEK_DAYS.map((day, idx) => {
                    const isLit =
                      (missed === 0 && idx < 6) ||
                      (missed === 1 && idx < 5) ||
                      (missed >= 2 && idx < 4);
                    const isMissed =
                      (missed === 1 && idx === 5) || (missed >= 2 && (idx === 4 || idx === 5));
                    const isToday = idx === 6;
                    return (
                      <div
                        key={day}
                        className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-extrabold ${
                          isLit
                            ? "bg-[rgb(255_228_194)] text-[rgb(138_52_24)] shadow-[0_3px_0_rgb(226_184_134)]"
                            : isMissed
                              ? "bg-[rgb(255_212_210)] text-[rgb(156_38_38)] shadow-[0_3px_0_rgb(222_156_154)]"
                              : isToday
                                ? "bg-[var(--ng-c-e5f5cc)] text-[var(--noggin-forest)] shadow-[0_3px_0_var(--ng-c-a9d172)]"
                                : "bg-[rgb(239_227_196)] text-[var(--ng-c-5b513a)]"
                        }`}
                      >
                        <span className="text-base leading-none">
                          {isLit ? "🔥" : isMissed ? "✕" : "●"}
                        </span>
                        <span>{day}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5 rounded-xl bg-[rgb(239_227_196)] p-3">
                  <div className="flex justify-between text-xs font-extrabold text-[var(--noggin-forest)]">
                    <span>Next Milestone: 7-Day Flame</span>
                    <strong className="text-[var(--ng-c-c2860a)]">+50 Coins</strong>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--ng-c-e6dcc0)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--ng-c-f3827a)] to-[var(--ng-c-f5be22)] transition-[width] duration-300"
                      style={{ width: `${streakPct}%` }}
                    />
                  </div>
                </div>
              </section>

              <aside className="flex flex-col justify-between gap-3 rounded-2xl bg-[rgb(239_227_196)] p-4 shadow-inner">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl" aria-hidden="true">
                      🛡️
                    </span>
                    <div>
                      <strong className="block text-sm font-black text-[var(--noggin-forest)]">
                        Streak Restore
                      </strong>
                      <span className="text-xs font-bold text-[var(--ng-c-318fd6)]">
                        Owned: {state.streakRestores} / 2
                      </span>
                    </div>
                  </div>
                  <p className="m-0 text-xs leading-relaxed text-[var(--noggin-ink)]">
                    {blocked2d
                      ? "Unavailable when 2 or more days are missed."
                      : "Saves a 1-day missed streak. Only valid for 1 missed day."}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={!canUseRestore}
                    onClick={() => {
                      updateState((prev) => ({
                        ...prev,
                        streakRestores: Math.max(0, prev.streakRestores - 1),
                        streakMissedDays: 0,
                      }));
                      showToast(`Streak restored! Your ${state.streakDays}-day flame is safe`);
                    }}
                    className="ng-btn ng-btn--leaf w-full py-2.5 text-xs"
                  >
                    {blocked2d
                      ? "Locked (2+ Days)"
                      : missed === 1
                        ? state.streakRestores > 0
                          ? "Use Streak Restore"
                          : "Buy Restore First"
                        : "Streak Safe ✓"}
                  </button>

                  <button
                    type="button"
                    disabled={!canBuyRestore}
                    onClick={() => {
                      requestPurchase({
                        title: "BUY STREAK RESTORE",
                        itemLabel: "1x Streak Restore Shield",
                        cost: 80,
                        onConfirm: () => {
                          updateState((prev) => ({
                            ...prev,
                            coins: Math.max(0, prev.coins - 80),
                            streakRestores: prev.streakRestores + 1,
                          }));
                          showToast("Bought 1 Streak Restore! (-80 coins)");
                        },
                      });
                    }}
                    className="ng-btn ng-btn--gold w-full py-2.5 text-xs"
                  >
                    {blocked2d
                      ? "Cannot Buy (2+ Days)"
                      : state.streakRestores >= 2
                        ? "Max Owned (2/2)"
                        : "Buy Streak Restore · 🪙 80"}
                  </button>

                  {blocked2d && (
                    <button
                      type="button"
                      onClick={() => {
                        updateState((prev) => ({
                          ...prev,
                          streakDays: 1,
                          streakMissedDays: 0,
                        }));
                        showToast("Started fresh Day 1 streak!");
                      }}
                      className="text-center text-xs font-extrabold text-[var(--noggin-forest)] underline underline-offset-4"
                    >
                      Start Fresh Day 1 Streak
                    </button>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {activeNonRoomModal?.type === "topup" && (
        <div
          className="ng-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="ng-shell ng-shell--gold max-w-[740px]"
            role="dialog"
            aria-modal="true"
            aria-label="Top Up Coins"
          >
            <header className="ng-shell__head">
              <span className="ng-shell__badge">🪙 {state.coins} COINS</span>
              <h2 className="ng-shell__title">TOP UP COINS</h2>
              <button
                type="button"
                className="ng-shell__close"
                aria-label="Close top up coins modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="ng-shell__body flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {COIN_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    aria-label={`${pack.coins} coins ${pack.bonus ? `${pack.bonus} ` : ""}${pack.price}`}
                    onClick={() => {
                      fireCheckoutRequest(pack.id);
                      awardRewards(pack.coins, 0);
                      showToast(`Topped up +${pack.coins} coins (${pack.price})!`);
                    }}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-center transition hover:-translate-y-0.5 ${
                      pack.badge
                        ? "border-[var(--ng-c-f5be2c)] bg-[var(--ng-c-fffdf5)] shadow-md"
                        : "border-[var(--ng-c-e3d6b4)] bg-white/90 shadow-sm"
                    }`}
                  >
                    {pack.badge && (
                      <span className="rounded-full bg-[var(--ng-c-f5be2c)] px-2 py-0.5 text-[10px] font-black text-[var(--ng-c-4a2e00)]">
                        {pack.badge}
                      </span>
                    )}
                    <span className="text-2xl" aria-hidden="true">
                      🪙
                    </span>
                    <strong className="text-2xl font-black text-[var(--noggin-forest)]">
                      {pack.coins}
                    </strong>
                    <span className="text-[11px] font-bold text-[var(--noggin-ink)]">
                      {pack.bonus || "Instant Coins"}
                    </span>
                    <span className="mt-1 rounded-full bg-[var(--ng-c-e8f6d2)] px-3 py-1 text-xs font-black text-[var(--noggin-forest)]">
                      {pack.price}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--ng-c-efe7cf)] px-4 py-3 text-xs font-bold text-[var(--noggin-forest)]">
                <span>Want unlimited notebooks, pages &amp; 2× streak shields?</span>
                <button
                  type="button"
                  onClick={() => openModal({ type: "plus" })}
                  className="ng-btn ng-btn--leaf px-4 py-1.5 text-xs"
                >
                  View Noggin Plus →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeNonRoomModal?.type === "plus" && (
        <div
          className="ng-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="ng-shell ng-shell--plus max-w-[740px]"
            role="dialog"
            aria-modal="true"
            aria-label="Noggin Plus"
          >
            <header className="ng-shell__head">
              <span className="ng-shell__badge">👑 PLUS PASS</span>
              <h2 className="ng-shell__title">NOGGIN PLUS</h2>
              <button
                type="button"
                className="ng-shell__close"
                aria-label="Close Noggin Plus modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="ng-shell__body flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/90 p-3.5 shadow-sm">
                  <strong className="block text-sm font-black text-[var(--noggin-forest)]">
                    📚 Unlimited Notebooks
                  </strong>
                  <span className="text-xs text-[var(--noggin-ink)]">
                    No 5-book cap + 60 max pages each
                  </span>
                </div>
                <div className="rounded-2xl bg-white/90 p-3.5 shadow-sm">
                  <strong className="block text-sm font-black text-[var(--noggin-forest)]">
                    🎨 All Skin Packs
                  </strong>
                  <span className="text-xs text-[var(--noggin-ink)]">
                    Unlock Pastel, Neon, Dark &amp; Sunset
                  </span>
                </div>
                <div className="rounded-2xl bg-white/90 p-3.5 shadow-sm">
                  <strong className="block text-sm font-black text-[var(--noggin-forest)]">
                    🛡️ 2× Streak Shields
                  </strong>
                  <span className="text-xs text-[var(--noggin-ink)]">
                    Free monthly Streak Restore refills
                  </span>
                </div>
                <div className="rounded-2xl bg-white/90 p-3.5 shadow-sm">
                  <strong className="block text-sm font-black text-[var(--noggin-forest)]">
                    ⚡ Higher Nog Context
                  </strong>
                  <span className="text-xs text-[var(--noggin-ink)]">
                    Longer lessons &amp; bonus Quiz EXP
                  </span>
                </div>
              </div>

              {state.isPlus ? (
                <div className="rounded-2xl bg-[var(--ng-c-e8f6d2)] p-3.5 text-center text-sm font-bold text-[var(--noggin-forest)]">
                  👑 Noggin Plus is Active! Thank you for supporting your Nogs.
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      fireCheckoutRequest("plus_monthly");
                      updateState((prev) => ({
                        ...prev,
                        isPlus: true,
                        ownedSkinPacks: { pastel: true, neon: true, dark: true, sunset: true },
                      }));
                      showToast("Welcome to Noggin Plus (Monthly · ₱249/mo)!");
                    }}
                    className="ng-btn ng-btn--leaf flex-1 py-3 text-sm"
                  >
                    Monthly · ₱249 / mo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fireCheckoutRequest("plus_yearly");
                      updateState((prev) => ({
                        ...prev,
                        isPlus: true,
                        ownedSkinPacks: { pastel: true, neon: true, dark: true, sunset: true },
                      }));
                      showToast("Welcome to Noggin Plus (Yearly · ₱1,990/yr)!");
                    }}
                    className="ng-btn ng-btn--gold flex-1 py-3 text-sm"
                  >
                    Yearly · ₱1,990 / yr (Save 33%)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeNonRoomModal?.type === "expandPages" && (() => {
        const curMax = state.notebookMaxPages[activeNonRoomModal.bookId] ?? 20;
        const isMax = curMax >= MAX_NOTEBOOK_PAGES;
        const remaining = Math.max(0, MAX_NOTEBOOK_PAGES - curMax);
        const pct = Math.min(100, Math.round((curMax / MAX_NOTEBOOK_PAGES) * 100));
        return (
          <div
            className="ng-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              className="ng-shell ng-shell--sage max-w-[740px]"
              role="dialog"
              aria-modal="true"
              aria-label="Expand Notebook Pages"
            >
              <header className="ng-shell__head">
                <span className="ng-shell__badge">🪙 {state.coins} COINS</span>
                <h2 className="ng-shell__title">EXPAND PAGES</h2>
                <button
                  type="button"
                  className="ng-shell__close"
                  aria-label="Close expand pages modal"
                  onClick={closeModal}
                >
                  ✕
                </button>
              </header>

              <div className="ng-shell__body grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_0.8fr]">
                <section className="flex flex-col gap-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-16 shrink-0">
                      <Book3dSvg
                        style={activeNonRoomModal.cover}
                        title={activeNonRoomModal.bookTitle}
                        uid={`exp-${activeNonRoomModal.bookId}`}
                      />
                    </div>
                    <div>
                      <strong className="block text-base font-black text-[var(--noggin-forest)]">
                        {activeNonRoomModal.bookTitle}
                      </strong>
                      <div className="text-xs font-bold text-[var(--noggin-ink)]">
                        {curMax} / {MAX_NOTEBOOK_PAGES} Max Pages
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-xl bg-[var(--ng-c-efe7cf)] p-3">
                    <div className="flex justify-between text-xs font-extrabold text-[var(--noggin-forest)]">
                      <span>Capacity Limit</span>
                      <strong>{isMax ? "MAXED OUT" : `${remaining} pages available`}</strong>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--ng-c-e6dcc0)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--ng-c-f5be22)] to-[var(--ng-c-7eb442)] transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                      isMax
                        ? "bg-[var(--ng-c-e8f6d2)] text-[var(--noggin-forest)]"
                        : "bg-[var(--ng-c-fff0c2)] text-[var(--ng-c-5b3b00)]"
                    }`}
                  >
                    {isMax
                      ? "Max Capacity Reached! This notebook holds up to 60 pages."
                      : "20 pages included free. Expand up to 60 pages for an entire semester."}
                  </div>
                </section>

                <aside className="flex flex-col justify-between gap-3 rounded-2xl bg-[var(--ng-c-efe7cf)] p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl" aria-hidden="true">
                      📄
                    </span>
                    <div>
                      <strong className="block text-sm font-black text-[var(--noggin-forest)]">
                        Extra Page Packs
                      </strong>
                      <span className="text-xs font-bold text-[var(--noggin-ink)]">
                        Max {MAX_NOTEBOOK_PAGES} pages / book
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isMax || state.coins < 60}
                      onClick={() => handleExpandPack(10, 60)}
                      className="ng-btn ng-btn--gold w-full py-2 text-xs"
                    >
                      +10 Pages · 🪙 60
                    </button>
                    <button
                      type="button"
                      disabled={isMax || state.coins < 120}
                      onClick={() => handleExpandPack(25, 120)}
                      className="ng-btn ng-btn--gold w-full py-2 text-xs"
                    >
                      +25 Pages · 🪙 120
                    </button>
                  </div>

                  <p className="m-0 text-[11px] leading-snug text-[var(--noggin-ink)]">
                    {isMax
                      ? "This notebook is at full 60-page capacity."
                      : state.coins < 60
                        ? "Earn more coins from Quizzes & Streaks to unlock extra pages."
                        : `Instant unlock · applies to ${activeNonRoomModal.bookTitle}.`}
                  </p>
                </aside>
              </div>
            </div>
          </div>
        );
      })()}

      {activeNonRoomModal?.type === "skinShop" && (
        <div
          className="ng-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="ng-shell ng-shell--purple max-w-[740px]"
            role="dialog"
            aria-modal="true"
            aria-label="Skin Shop"
          >
            <header className="ng-shell__head">
              <span className="ng-shell__badge">🪙 {state.coins}</span>
              <h2 className="ng-shell__title">SKIN SHOP</h2>
              <button
                type="button"
                className="ng-shell__close"
                aria-label="Close skin shop modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="ng-shell__body grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SKIN_PACKS.map((pack) => {
                const isOwned = Boolean(
                  state.ownedSkinPacks[pack.id] || state.isPlus || pack.price === 0,
                );
                const isActive = state.activeSkinPack === pack.id;
                return (
                  <div
                    key={pack.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl bg-white/95 p-4 shadow-sm"
                  >
                    <div>
                      <strong className="text-sm font-black text-[var(--noggin-forest)]">
                        {pack.name} Pack
                      </strong>
                      <div className="mt-2 flex items-center gap-2">
                        {pack.swatches.map((sw) => (
                          <span
                            key={sw.name}
                            title={sw.name}
                            className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: sw.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    {isOwned ? (
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => ({ ...prev, activeSkinPack: pack.id }));
                          closeModal();
                        }}
                        className="ng-btn ng-btn--leaf w-full py-2 text-xs"
                      >
                        {isActive ? "Active Pack ✓" : "Use Pack ✓"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          requestPurchase({
                            title: "BUY SKIN PACK",
                            itemLabel: `${pack.name} Pack (4 Body Skins)`,
                            cost: pack.price,
                            onConfirm: () => {
                              updateState((prev) => ({
                                ...prev,
                                coins: Math.max(0, prev.coins - pack.price),
                                ownedSkinPacks: { ...prev.ownedSkinPacks, [pack.id]: true },
                                activeSkinPack: pack.id,
                              }));
                              showToast(`Unlocked ${pack.name} Pack!`);
                            },
                          });
                        }}
                        className="ng-btn ng-btn--gold w-full py-2 text-xs"
                      >
                        🪙 {pack.price}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {confirmReq && (
        <div
          className="ng-modal-backdrop ng-overlay--confirm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            className="ng-shell ng-shell--sage max-w-[440px]"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm purchase"
          >
            <header className="ng-shell__head">
              <span className="ng-shell__badge">🪙 {state.coins}</span>
              <h2 className="ng-shell__title">{confirmReq.title || "CONFIRM"}</h2>
              <button
                type="button"
                className="ng-shell__close"
                aria-label="Cancel purchase"
                onClick={closeConfirm}
              >
                ✕
              </button>
            </header>

            <div className="ng-shell__body flex flex-col items-center gap-4 text-center">
              <p className="m-0 text-base font-black text-[var(--noggin-forest)]">
                {confirmReq.itemLabel}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ng-c-efe7cf)] px-4 py-1.5 text-sm font-extrabold text-[var(--noggin-forest)]">
                <span>🪙 {state.coins}</span>
                <span aria-hidden="true">→</span>
                <strong>🪙 {Math.max(0, state.coins - confirmReq.cost)} left</strong>
              </div>
              <div className="flex w-full items-center gap-3">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="ng-btn ng-btn--stone flex-1 py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fn = confirmReq.onConfirm;
                    closeConfirm();
                    fn();
                  }}
                  className="ng-btn ng-btn--leaf flex-1 py-2.5 text-sm"
                >
                  Buy · 🪙 {confirmReq.cost}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
