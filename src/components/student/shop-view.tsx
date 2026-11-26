"use client";

import {
  ACCESSORIES,
  ROOM_THEMES,
  SKIN_PACKS,
  useGameUi,
} from "@/components/game-ui/game-ui-context";

export function ShopView() {
  const { state, openModal, requestPurchase, updateState, showToast } =
    useGameUi();

  const ownedSkinsCount = SKIN_PACKS.filter(
    (p) => state.ownedSkinPacks[p.id],
  ).length;
  const ownedAccCount = ACCESSORIES.filter(
    (a) => state.ownedAccessories[a.id],
  ).length;
  const ownedRoomsCount = ROOM_THEMES.filter(
    (r) => state.ownedRooms[r.id],
  ).length;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="prof-plus-banner">
        <div className="prof-plus-banner__txt">
          <span className="prof-plus-banner__tag">NOGGIN PLUS</span>
          <strong>
            {state.isPlus
              ? "Plus Active — Unlimited Pages & 2× Daily Coins!"
              : "Unlock 30 pages per notebook, bonus coin drops & study perks"}
          </strong>
          <span>Balance: 🪙 {state.coins} Coins</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal({ type: "topup" })}
            className="prof-topup-cta"
          >
            Top Up 🪙
          </button>
          <button
            type="button"
            onClick={() => openModal({ type: "plus" })}
            className="prof-plus-cta"
          >
            {state.isPlus ? "Manage Plus" : "Get Plus"}
          </button>
        </div>
      </div>

      <div className="shop-sections-stack">
        <section
          aria-labelledby="shop-skins-heading"
          className="shop-sec-shell shop-sec-shell--skins"
        >
          <div className="shop-sec-head">
            <h3 id="shop-skins-heading">SKIN PACKS</h3>
            <span className="shop-sec-count tnum">
              {ownedSkinsCount} / {SKIN_PACKS.length} Owned
            </span>
          </div>

          <div className="shop-sec-body">
            <div className="shop-sec-grid">
              {SKIN_PACKS.map((pack) => {
                const isOwned = Boolean(state.ownedSkinPacks[pack.id]);
                const isActive = state.activeSkinPack === pack.id;

                return (
                  <div key={pack.id} className="skin-shop-card">
                    <div className="skin-shop-dots">
                      {pack.swatches.map((swatch) => (
                        <span
                          key={swatch.name}
                          title={swatch.name}
                          style={{ background: swatch.hex }}
                        />
                      ))}
                    </div>
                    <strong>{pack.name} Pack</strong>
                    <span className="text-[12px] font-semibold text-[var(--noggin-ink)]">
                      {pack.swatches.length} signature clay tones
                    </span>

                    {isOwned ? (
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => ({
                            ...prev,
                            activeSkinPack: pack.id,
                          }));
                          showToast(`${pack.name} Pack equipped`);
                        }}
                        className="streak-btn streak-btn--leaf"
                      >
                        {isActive ? "Active Pack ✓" : "Equip Pack"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          requestPurchase({
                            title: `Unlock ${pack.name} Pack?`,
                            itemLabel: `${pack.name} Skin Pack (4 swatches)`,
                            cost: pack.price,
                            onConfirm: () => {
                              updateState((prev) => ({
                                ...prev,
                                ownedSkinPacks: {
                                  ...prev.ownedSkinPacks,
                                  [pack.id]: true,
                                },
                                activeSkinPack: pack.id,
                              }));
                            },
                          })
                        }
                        className="streak-btn streak-btn--gold"
                      >
                        Buy 🪙 {pack.price}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="shop-acc-heading"
          className="shop-sec-shell shop-sec-shell--acc"
        >
          <div className="shop-sec-head">
            <h3 id="shop-acc-heading">ACCESSORIES</h3>
            <span className="shop-sec-count tnum">
              {ownedAccCount} / {ACCESSORIES.length} Owned
            </span>
          </div>

          <div className="shop-sec-body">
            <div className="shop-sec-grid">
              {ACCESSORIES.map((acc) => {
                const isOwned = Boolean(state.ownedAccessories[acc.id]);
                const isEquipped = state.equippedSlots.includes(acc.id);

                return (
                  <div key={acc.id} className="prof-shop-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={acc.img}
                      alt=""
                      width={58}
                      height={58}
                      className="prof-shop-card__img"
                    />
                    <strong>{acc.name}</strong>
                    <span className="text-[12px] font-semibold text-[var(--noggin-ink)]">
                      {acc.category}
                    </span>

                    {isOwned ? (
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => {
                            const nextSlots = [...prev.equippedSlots];
                            const slotIdx = nextSlots.indexOf(acc.id);
                            if (slotIdx >= 0) {
                              nextSlots[slotIdx] = null;
                            } else {
                              nextSlots[acc.slot % nextSlots.length] = acc.id;
                            }
                            return { ...prev, equippedSlots: nextSlots };
                          });
                        }}
                        className="streak-btn streak-btn--leaf mt-auto"
                      >
                        {isEquipped ? "Equipped ✓" : "Equip Item"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          requestPurchase({
                            title: `Buy ${acc.name}?`,
                            itemLabel: `${acc.category} accessory`,
                            cost: acc.price,
                            onConfirm: () => {
                              updateState((prev) => ({
                                ...prev,
                                ownedAccessories: {
                                  ...prev.ownedAccessories,
                                  [acc.id]: true,
                                },
                              }));
                            },
                          })
                        }
                        className="streak-btn streak-btn--gold mt-auto"
                      >
                        Buy 🪙 {acc.price}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="shop-upgrades-heading"
          className="shop-sec-shell shop-sec-shell--upgrades"
        >
          <div className="shop-sec-head">
            <h3 id="shop-upgrades-heading">ROOMS &amp; UPGRADES</h3>
            <span className="shop-sec-count tnum">
              {ownedRoomsCount} / {ROOM_THEMES.length} Rooms
            </span>
          </div>

          <div className="shop-sec-body">
            <div className="shop-sec-grid shop-sec-grid--3">
              {ROOM_THEMES.map((room) => {
                const isOwned = Boolean(state.ownedRooms[room.id]);
                const isActive = state.roomBgId === room.id;

                return (
                  <div key={room.id} className="prof-shop-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={room.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-24 w-full rounded-[14px] object-cover shadow-[0_4px_10px_rgb(42_66_14_/_0.16)]"
                    />
                    <strong>{room.name}</strong>

                    {isOwned ? (
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => ({
                            ...prev,
                            roomBgId: room.id,
                          }));
                          showToast(`Room set to ${room.name}`);
                        }}
                        className="streak-btn streak-btn--leaf mt-auto"
                      >
                        {isActive ? "Active Room ✓" : "Use Room"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          requestPurchase({
                            title: `Unlock ${room.name}?`,
                            itemLabel: "Sanctuary room background",
                            cost: room.price,
                            onConfirm: () => {
                              updateState((prev) => ({
                                ...prev,
                                ownedRooms: {
                                  ...prev.ownedRooms,
                                  [room.id]: true,
                                },
                                roomBgId: room.id,
                              }));
                            },
                          })
                        }
                        className="streak-btn streak-btn--gold mt-auto"
                      >
                        Buy 🪙 {room.price}
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="prof-shop-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/game/ui/icon-chest-clay.svg"
                  alt=""
                  width={58}
                  height={58}
                  className="prof-shop-card__img"
                />
                <strong>Streak Restore</strong>
                <span className="text-[12px] font-semibold text-[var(--noggin-ink)]">
                  {state.streakRestores} saved in pouch
                </span>
                <button
                  type="button"
                  onClick={() =>
                    requestPurchase({
                      title: "Buy Streak Restore?",
                      itemLabel: "Protects one missed study day",
                      cost: 100,
                      onConfirm: () => {
                        updateState((prev) => ({
                          ...prev,
                          streakRestores: prev.streakRestores + 1,
                        }));
                      },
                    })
                  }
                  className="streak-btn streak-btn--gold mt-auto"
                >
                  Buy 🪙 100
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
