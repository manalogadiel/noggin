"use client";

import { Lock } from "lucide-react";
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
      className="room-stage"
      role="dialog"
      aria-modal="true"
      aria-label="Sanctuary Rooms"
    >
      <div
        className="room-stage__backdrop"
        onClick={closeModal}
        aria-hidden="true"
      />

      <div className="room-stage__topbar">
        <span aria-hidden="true" />
        <div className="room-stage__right-head">
          <h2 className="room-stage__big-title">{current.name.toUpperCase()}</h2>
        </div>
      </div>

      <div className="room-stage__carousel" role="group" aria-label="Sanctuary rooms">
        <button
          type="button"
          className="room-peek room-peek--prev"
          onClick={() => setIdx((i) => (i - 1 + n) % n)}
          aria-label={`Previous room: ${prev.name}`}
        >
          <span className="room-peek__skew" aria-hidden="true" />
          <span className="room-peek__clip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={prev.src} alt={prev.name} />
          </span>
          <span className="room-peek__label">{prev.name}</span>
        </button>

        <div className="room-main-wrap">
          <span className="room-main-skew" aria-hidden="true" />
          <figure className="room-main-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={`room-main-img ${owned ? "" : "is-locked"}`}
              src={current.src}
              alt={`${current.name} room preview`}
            />
            <figcaption className="room-main-bar">
              <div className="room-main-meta">
                <span className="room-main-status">
                  {equipped ? (
                    "EQUIPPED"
                  ) : owned ? (
                    "OWNED"
                  ) : (
                    <>
                      <Lock className="h-[13px] w-[13px]" aria-hidden="true" />
                      <span>{current.price} COINS</span>
                    </>
                  )}
                </span>
                <strong>{current.name}</strong>
              </div>

              <div className="room-stage__action">
                {equipped ? (
                  <button
                    type="button"
                    className="room-skew-btn room-skew-btn--equipped"
                    disabled
                  >
                    Equipped ✓
                  </button>
                ) : owned ? (
                  <button
                    type="button"
                    className="room-skew-btn room-skew-btn--leaf"
                    onClick={handleAction}
                  >
                    Use Room
                  </button>
                ) : canAfford ? (
                  <button
                    type="button"
                    className="room-skew-btn room-skew-btn--gold tnum"
                    onClick={handleAction}
                  >
                    Unlock · 🪙 {current.price}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="room-skew-btn room-skew-btn--gold tnum"
                    disabled
                  >
                    Need 🪙 {current.price - state.coins}
                  </button>
                )}
              </div>
            </figcaption>
          </figure>
        </div>

        <button
          type="button"
          className="room-peek room-peek--next"
          onClick={() => setIdx((i) => (i + 1) % n)}
          aria-label={`Next room: ${next.name}`}
        >
          <span className="room-peek__skew" aria-hidden="true" />
          <span className="room-peek__clip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={next.src} alt={next.name} />
          </span>
          <span className="room-peek__label">{next.name}</span>
        </button>
      </div>

      <div className="room-stage__dots">
        {ROOM_THEMES.map((r, i) => (
          <button
            key={r.id}
            type="button"
            aria-label={r.name}
            aria-current={i === idx ? "true" : undefined}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </div>
  );
}
