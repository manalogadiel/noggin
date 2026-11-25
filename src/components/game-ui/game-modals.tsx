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
  })
    .then(async (res) => {
      if (!res.ok) return;
      const payload = (await res.json()) as { checkoutUrl?: string | null };
      if (payload.checkoutUrl && typeof window !== "undefined") {
        window.location.assign(payload.checkoutUrl);
      }
    })
    .catch(() => {
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
          className="streak-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="qs-sc-shell qs-sc-shell--streak"
            role="dialog"
            aria-modal="true"
            aria-label="Study Streak"
          >
            <header className="qs-sc-header">
              <span className="qs-sc-badge tnum">🪙 {state.coins} COINS</span>
              <h2 className="qs-sc-title">STUDY STREAK</h2>
              <button
                type="button"
                className="qs-sc-close"
                aria-label="Close study streak modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="qs-sc-body streak-sc-body">
              <section className="streak-left">
                <div className="streak-hero-row">
                  <div className="streak-flame-disc">
                    <svg width="42" height="42" viewBox="0 0 36 36" aria-hidden="true">
                      <circle cx="18" cy="18" r="16" fill="var(--ng-c-f3827a)" />
                      <path
                        d="M18.5 8.5c2.2 3.8 5.5 5.6 5.5 10.2a6 6 0 1 1-12 0c0-2.6 1.2-4.8 2.8-6.4.2 1.8 1.2 2.8 2.2 3.1-.4-2.8.1-5.1 1.5-6.9z"
                        fill="var(--ng-c-fff3c4)"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="streak-big-num tnum">
                      {blocked2d ? "0" : state.streakDays} <span>DAYS</span>
                    </div>
                    <div className="streak-best">Best Streak: 14 days</div>
                  </div>
                </div>

                <div
                  className={`streak-status ${
                    missed === 0
                      ? "streak-status--ok"
                      : missed === 1
                        ? "streak-status--warn"
                        : "streak-status--lock"
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

                <div className="streak-week" aria-label="This week streak">
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
                        className={`streak-day ${
                          isLit
                            ? "is-lit"
                            : isMissed
                              ? "is-missed"
                              : isToday
                                ? "is-today"
                                : ""
                        }`}
                      >
                        <span className="streak-day__dot" aria-hidden="true">
                          {isLit ? "🔥" : isMissed ? "✕" : "●"}
                        </span>
                        <span>{day}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="streak-milestone">
                  <div className="streak-milestone__head">
                    <span>Next Milestone: 7-Day Flame</span>
                    <strong>+50 Coins</strong>
                  </div>
                  <div className="meter">
                    <i style={{ width: `${streakPct}%` }} />
                  </div>
                </div>
              </section>

              <aside className="streak-right">
                <div className={`streak-restore-card ${blocked2d ? "is-locked" : ""}`}>
                  <div className="streak-restore-head">
                    <span className="text-2xl" aria-hidden="true">
                      🛡️
                    </span>
                    <div>
                      <strong>Streak Restore</strong>
                      <span>Owned: {state.streakRestores} / 2</span>
                    </div>
                  </div>
                  <p className="streak-restore-desc">
                    {blocked2d
                      ? "Unavailable when 2 or more days are missed."
                      : "Saves a 1-day missed streak. Only valid for 1 missed day."}
                  </p>

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
                    className="qs-pop-cta streak-use-btn"
                  >
                    <span>
                      {blocked2d
                        ? "Locked (2+ Days)"
                        : missed === 1
                          ? state.streakRestores > 0
                            ? "Use Streak Restore"
                            : "Buy Restore First"
                          : "Streak Safe ✓"}
                    </span>
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
                    className="streak-buy-btn"
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
                      className="qs-replay-link"
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
          className="streak-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="qs-sc-shell qs-sc-shell--pages"
            role="dialog"
            aria-modal="true"
            aria-label="Top Up Coins"
          >
            <header className="qs-sc-header">
              <span className="qs-sc-badge tnum">🪙 {state.coins} COINS</span>
              <h2 className="qs-sc-title">TOP UP COINS</h2>
              <button
                type="button"
                className="qs-sc-close"
                aria-label="Close top up coins modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="qs-sc-body qs-sc-body--topup">
              <div className="topup-grid">
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
                    className={`topup-card ${pack.badge ? "is-featured" : ""}`}
                  >
                    {pack.badge && <span className="topup-card__tag">{pack.badge}</span>}
                    <span className="topup-card__ico" aria-hidden="true">
                      🪙
                    </span>
                    <span className="topup-card__amt tnum">{pack.coins}</span>
                    <span className="topup-card__sub">{pack.bonus || "Instant Coins"}</span>
                    <span className="topup-card__price">{pack.price}</span>
                  </button>
                ))}
              </div>

              <div className="topup-plus-bar">
                <span>Want unlimited notebooks, pages &amp; 2× streak shields?</span>
                <button
                  type="button"
                  onClick={() => openModal({ type: "plus" })}
                  className="nb-expand-btn nb-expand-btn--sm"
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
          className="streak-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="qs-sc-shell qs-sc-shell--plus"
            role="dialog"
            aria-modal="true"
            aria-label="Noggin Plus"
          >
            <header className="qs-sc-header">
              <span className="qs-sc-badge">👑 PLUS PASS</span>
              <h2 className="qs-sc-title">NOGGIN PLUS</h2>
              <button
                type="button"
                className="qs-sc-close"
                aria-label="Close Noggin Plus modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="qs-sc-body qs-sc-body--topup">
              <div className="plus-perks-grid">
                <div className="plus-perk">
                  <strong>📚 Unlimited Notebooks</strong>
                  <span>No 5-book cap + 60 max pages each</span>
                </div>
                <div className="plus-perk">
                  <strong>🎨 All Skin Packs</strong>
                  <span>Unlock Pastel, Neon, Dark &amp; Sunset</span>
                </div>
                <div className="plus-perk">
                  <strong>🛡️ 2× Streak Shields</strong>
                  <span>Free monthly Streak Restore refills</span>
                </div>
                <div className="plus-perk">
                  <strong>⚡ Higher Nog Context</strong>
                  <span>Longer lessons &amp; bonus Quiz EXP</span>
                </div>
              </div>

              {state.isPlus ? (
                <div className="streak-status streak-status--ok justify-center text-center">
                  👑 Noggin Plus is Active! Thank you for supporting your Nogs.
                </div>
              ) : (
                <div className="plus-plan-row">
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
                    className="streak-btn streak-btn--leaf"
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
                    className="streak-btn streak-btn--gold"
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
            className="streak-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              className="qs-sc-shell qs-sc-shell--pages"
              role="dialog"
              aria-modal="true"
              aria-label="Expand Notebook Pages"
            >
              <header className="qs-sc-header">
                <span className="qs-sc-badge tnum">🪙 {state.coins} COINS</span>
                <h2 className="qs-sc-title">EXPAND PAGES</h2>
                <button
                  type="button"
                  className="qs-sc-close"
                  aria-label="Close expand pages modal"
                  onClick={closeModal}
                >
                  ✕
                </button>
              </header>

              <div className="qs-sc-body streak-sc-body">
                <section className="streak-left">
                  <div className="pages-book-hero">
                    <div className="pages-book-hero__art">
                      <Book3dSvg
                        style={activeNonRoomModal.cover}
                        title={activeNonRoomModal.bookTitle}
                        uid={`exp-${activeNonRoomModal.bookId}`}
                      />
                    </div>
                    <div>
                      <strong className="pages-book-hero__title">
                        {activeNonRoomModal.bookTitle}
                      </strong>
                      <div className="pages-book-hero__sub">
                        {curMax} / {MAX_NOTEBOOK_PAGES} Max Pages
                      </div>
                    </div>
                  </div>

                  <div className="streak-milestone">
                    <div className="streak-milestone__head">
                      <span>Capacity Limit</span>
                      <strong>{isMax ? "MAXED OUT" : `${remaining} pages available`}</strong>
                    </div>
                    <div className="meter">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div
                    className={`streak-status ${
                      isMax ? "streak-status--ok" : "streak-status--warn"
                    }`}
                  >
                    {isMax
                      ? "Max Capacity Reached! This notebook holds up to 60 pages."
                      : "20 pages included free. Expand up to 60 pages for an entire semester."}
                  </div>
                </section>

                <aside className="streak-right">
                  <div className="streak-restore-card">
                    <div className="streak-restore-head">
                      <span className="text-2xl" aria-hidden="true">
                        📄
                      </span>
                      <div>
                        <strong>Extra Page Packs</strong>
                        <span>Max {MAX_NOTEBOOK_PAGES} pages / book</span>
                      </div>
                    </div>

                    <div className="pages-pack-list">
                      <button
                        type="button"
                        disabled={isMax || state.coins < 60}
                        onClick={() => handleExpandPack(10, 60)}
                        className="streak-btn streak-btn--gold"
                      >
                        +10 Pages · 🪙 60
                      </button>
                      <button
                        type="button"
                        disabled={isMax || state.coins < 120}
                        onClick={() => handleExpandPack(25, 120)}
                        className="streak-btn streak-btn--gold"
                      >
                        +25 Pages · 🪙 120
                      </button>
                    </div>

                    <p className="streak-restore-desc">
                      {isMax
                        ? "This notebook is at full 60-page capacity."
                        : state.coins < 60
                          ? "Earn more coins from Quizzes & Streaks to unlock extra pages."
                          : `Instant unlock · applies to ${activeNonRoomModal.bookTitle}.`}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        );
      })()}

      {activeNonRoomModal?.type === "skinShop" && (
        <div
          className="streak-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="qs-sc-shell qs-sc-shell--nap"
            role="dialog"
            aria-modal="true"
            aria-label="Skin Shop"
          >
            <header className="qs-sc-header">
              <span className="qs-sc-badge tnum">🪙 {state.coins}</span>
              <h2 className="qs-sc-title">SKIN SHOP</h2>
              <button
                type="button"
                className="qs-sc-close"
                aria-label="Close skin shop modal"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            <div className="qs-sc-body qs-sc-body--topup">
              <div className="plus-perks-grid">
                {SKIN_PACKS.map((pack) => {
                  const isOwned = Boolean(
                    state.ownedSkinPacks[pack.id] || state.isPlus || pack.price === 0,
                  );
                  const isActive = state.activeSkinPack === pack.id;
                  return (
                    <div key={pack.id} className="skin-shop-card">
                      <strong>{pack.name} Pack</strong>
                      <div className="skin-shop-dots">
                        {pack.swatches.map((sw) => (
                          <span
                            key={sw.name}
                            title={sw.name}
                            style={{ background: sw.hex }}
                          />
                        ))}
                      </div>

                      {isOwned ? (
                        <button
                          type="button"
                          onClick={() => {
                            updateState((prev) => ({ ...prev, activeSkinPack: pack.id }));
                            closeModal();
                          }}
                          className="streak-btn streak-btn--leaf"
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
                          className="streak-btn streak-btn--gold"
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
        </div>
      )}

      {confirmReq && (
        <div
          className="streak-overlay confirm-buy-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            className="qs-sc-shell qs-sc-shell--confirm"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm purchase"
          >
            <header className="qs-sc-header">
              <span className="qs-sc-badge tnum">🪙 {state.coins}</span>
              <h2 className="qs-sc-title">{confirmReq.title || "CONFIRM"}</h2>
              <button
                type="button"
                className="qs-sc-close"
                aria-label="Cancel purchase"
                onClick={closeConfirm}
              >
                ✕
              </button>
            </header>

            <div className="qs-sc-body qs-sc-body--confirm">
              <p className="cb-item-name">{confirmReq.itemLabel}</p>
              <div className="cb-balance-pill">
                <span>🪙 {state.coins}</span>
                <span aria-hidden="true">→</span>
                <strong>🪙 {Math.max(0, state.coins - confirmReq.cost)} left</strong>
              </div>
              <div className="cb-actions">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="cb-btn cb-btn--cancel"
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
                  className="cb-btn cb-btn--ok"
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
