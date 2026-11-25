"use client";

import { useEffect, useState } from "react";
import { ROOM_THEMES, useGameUi } from "@/components/game-ui/game-ui-context";

export function RoomsOverlay() {
  const { state, modal } = useGameUi();
  if (modal?.type !== "rooms") return null;
  const initialIdx = Math.max(
    0,
    ROOM_THEMES.findIndex((r) => r.id === state.roomBgId),
  );
  return <RoomsOverlayInner key={state.roomBgId} initialIdx={initialIdx} />;
}

function RoomsOverlayInner({ initialIdx }: { initialIdx: number }) {
  const { state, closeModal, updateState, requestPurchase, showToast } = useGameUi();
  const [idx, setIdx] = useState(initialIdx);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + ROOM_THEMES.length) % ROOM_THEMES.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % ROOM_THEMES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const n = ROOM_THEMES.length;
  const current = ROOM_THEMES[idx] ?? ROOM_THEMES[0];
  const prev = ROOM_THEMES[(idx - 1 + n) % n];
  const next = ROOM_THEMES[(idx + 1) % n];
  const owned = Boolean(state.ownedRooms[current.id] || current.price === 0);
  const equipped = current.id === state.roomBgId;
  const canAfford = state.coins >= current.price;

  function handleAction() {
    if (equipped) return;
    if (owned) {
      updateState((prevSt) => ({ ...prevSt, roomBgId: current.id }));
      showToast(`Switched Sanctuary to ${current.name}!`);
      return;
    }
    requestPurchase({
      title: "UNLOCK ROOM",
      itemLabel: current.name,
      cost: current.price,
      onConfirm: () => {
        updateState((prevSt) => ({
          ...prevSt,
          coins: prevSt.coins - current.price,
          ownedRooms: { ...prevSt.ownedRooms, [current.id]: true },
          roomBgId: current.id,
        }));
        showToast(`Unlocked & moved into ${current.name}!`);
      },
    });
  }

  return (
    <div
      id="room-stage"
      className="ng-rooms-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sanctuary Rooms"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="flex w-full max-w-[1160px] items-center justify-end px-6">
        <h2
          className="m-0 text-[34px] font-black italic tracking-wide text-white"
          style={{
            fontFamily: "var(--noggin-font-display), sans-serif",
            textShadow: "0 5px 0 var(--ng-c-446e14), 0 12px 24px rgba(16,32,4,0.44)",
          }}
        >
          {current.name.toUpperCase()}
        </h2>
      </div>

      <div className="ng-rooms-carousel" role="group" aria-label="Sanctuary rooms carousel">
        <button
          type="button"
          onClick={() => setIdx((i) => (i - 1 + n) % n)}
          aria-label={`Previous room: ${prev.name}`}
          className="relative z-[2] -mr-20 hidden scale-90 flex-col items-center gap-2.5 border-0 bg-transparent p-0 opacity-90 transition hover:scale-95 hover:opacity-100 md:flex"
        >
          <span className="ng-room-peek-skew--prev" aria-hidden="true" />
          <span className="relative z-[2] block aspect-[16/10] w-full overflow-hidden shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={prev.src} alt={prev.name} className="h-full w-full object-cover" />
          </span>
          <span
            className="relative z-[2] bg-[rgb(255_253_247_/_0.95)] px-3 py-1 text-xs font-extrabold text-[var(--ng-c-2f5406)]"
            style={{ transform: "skewX(-6deg)" }}
          >
            {prev.name}
          </span>
        </button>

        <div className="relative z-[6] w-full">
          <span className="ng-room-main-skew" aria-hidden="true" />
          <figure className="relative z-[2] m-0 aspect-[16/9.4] overflow-hidden bg-[var(--ng-c-233610)] shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={`${current.name} preview`}
              className={`h-full w-full object-cover ${owned ? "" : "brightness-75 saturate-50"}`}
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[rgb(20_34_8_/_0.85)] to-transparent px-6 py-4">
              <div className="flex flex-col text-white">
                <span className="text-xs font-black tracking-wider text-[var(--ng-c-ffe48d)]">
                  {equipped ? "EQUIPPED" : owned ? "OWNED" : `LOCKED · 🪙 ${current.price}`}
                </span>
                <strong
                  className="text-2xl font-black italic"
                  style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
                >
                  {current.name}
                </strong>
              </div>
              <button
                type="button"
                disabled={equipped || (!owned && !canAfford)}
                onClick={handleAction}
                className={`border-0 px-5 py-2.5 text-sm font-black uppercase tracking-wide shadow-md ${
                  equipped
                    ? "bg-[var(--ng-c-dcefc4)] text-[var(--ng-c-366410)]"
                    : owned
                      ? "bg-gradient-to-b from-[var(--ng-c-9ad054)] to-[var(--ng-c-72a538)] text-white"
                      : "bg-gradient-to-b from-[var(--ng-c-ffe47a)] to-[var(--ng-c-f5be22)] text-[var(--ng-c-5b3b00)]"
                }`}
                style={{ transform: "skewX(-8deg)" }}
              >
                {equipped
                  ? "Equipped ✓"
                  : owned
                    ? "Use Room"
                    : canAfford
                      ? `Unlock · 🪙 ${current.price}`
                      : `Need 🪙 ${current.price - state.coins}`}
              </button>
            </figcaption>
          </figure>
        </div>

        <button
          type="button"
          onClick={() => setIdx((i) => (i + 1) % n)}
          aria-label={`Next room: ${next.name}`}
          className="relative z-[2] -ml-20 hidden scale-90 flex-col items-center gap-2.5 border-0 bg-transparent p-0 opacity-90 transition hover:scale-95 hover:opacity-100 md:flex"
        >
          <span className="ng-room-peek-skew--next" aria-hidden="true" />
          <span className="relative z-[2] block aspect-[16/10] w-full overflow-hidden shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={next.src} alt={next.name} className="h-full w-full object-cover" />
          </span>
          <span
            className="relative z-[2] bg-[rgb(255_253_247_/_0.95)] px-3 py-1 text-xs font-extrabold text-[var(--ng-c-2f5406)]"
            style={{ transform: "skewX(-6deg)" }}
          >
            {next.name}
          </span>
        </button>
      </div>

      <div className="relative z-[6] flex items-center gap-2.5">
        {ROOM_THEMES.map((r, i) => (
          <button
            key={r.id}
            type="button"
            aria-label={r.name}
            aria-current={i === idx ? "true" : undefined}
            onClick={() => setIdx(i)}
            className={`h-2.5 border-0 transition-all ${
              i === idx ? "w-7 rounded-full bg-white" : "w-2.5 rounded-full bg-white/45"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
