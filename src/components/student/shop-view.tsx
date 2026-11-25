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
    <div className="flex flex-col gap-5 pb-4">
      <div className="ng-prof-plus-banner">
        <div className="flex flex-col gap-0.5">
          <span className="noggin-display text-[11px] font-black tracking-[0.06em] text-[var(--ng-c-ffe678)]">
            NOGGIN PLUS
          </span>
          <strong className="noggin-display text-[17px] font-black">
            {state.isPlus
              ? "Plus Active — Unlimited Pages & 2× Daily Coins!"
              : "Unlock 30 pages per notebook, bonus coin drops & study perks"}
          </strong>
          <span className="text-[12px] font-semibold opacity-90">
            Balance: 🪙 {state.coins} Coins
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal({ type: "topup" })}
            className="ng-prof-topup-cta"
          >
            Top Up 🪙
          </button>
          <button
            type="button"
            onClick={() => openModal({ type: "plus" })}
            className="ng-prof-plus-cta"
          >
            {state.isPlus ? "Manage Plus" : "Get Plus"}
          </button>
        </div>
      </div>

      <div className="ng-shop-sections-stack">
        <section
          aria-labelledby="shop-skins-heading"
          className="ng-shop-sec-shell ng-shop-sec-shell--skins"
        >
          <div className="ng-shop-sec-head">
            <h2 id="shop-skins-heading">SKIN PACKS</h2>
            <span className="ng-shop-sec-count tabular-nums">
              {ownedSkinsCount} / {SKIN_PACKS.length} Owned
            </span>
          </div>

          <div className="ng-shop-sec-body">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SKIN_PACKS.map((pack) => {
                const isOwned = Boolean(state.ownedSkinPacks[pack.id]);
                const isActive = state.activeSkinPack === pack.id;

                return (
                  <div key={pack.id} className="ng-shop-card">
                    <div className="flex items-center gap-1.5 py-1">
                      {pack.swatches.map((swatch) => (
                        <span
                          key={swatch.name}
                          title={swatch.name}
                          className="h-7 w-7 rounded-full border-2 border-[var(--ng-c-ffffff)] shadow-[0_3px_6px_rgba(42,66,14,0.22)]"
                          style={{ background: swatch.hex }}
                        />
                      ))}
                    </div>
                    <strong className="noggin-display text-[15px] font-extrabold text-[var(--noggin-forest)]">
                      {pack.name} Pack
                    </strong>
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
                        className="ng-btn ng-btn--leaf ng-btn--sm mt-1 w-full"
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
                        className="ng-btn ng-btn--gold ng-btn--sm mt-1 w-full"
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
          className="ng-shop-sec-shell ng-shop-sec-shell--acc"
        >
          <div className="ng-shop-sec-head">
            <h2 id="shop-acc-heading">ACCESSORIES</h2>
            <span className="ng-shop-sec-count tabular-nums">
              {ownedAccCount} / {ACCESSORIES.length} Owned
            </span>
          </div>

          <div className="ng-shop-sec-body">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACCESSORIES.map((acc) => {
                const isOwned = Boolean(state.ownedAccessories[acc.id]);
                const isEquipped = state.equippedSlots.includes(acc.id);

                return (
                  <div key={acc.id} className="ng-shop-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={acc.img}
                      alt=""
                      width={58}
                      height={58}
                      className="h-14 w-14 object-contain drop-shadow-[0_6px_10px_rgba(42,66,14,0.22)]"
                    />
                    <strong className="noggin-display text-[15px] font-extrabold text-[var(--noggin-forest)]">
                      {acc.name}
                    </strong>
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
                        className="ng-btn ng-btn--leaf ng-btn--sm mt-1 w-full"
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
                        className="ng-btn ng-btn--gold ng-btn--sm mt-1 w-full"
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
          className="ng-shop-sec-shell ng-shop-sec-shell--upgrades"
        >
          <div className="ng-shop-sec-head">
            <h2 id="shop-upgrades-heading">ROOMS &amp; UPGRADES</h2>
            <span className="ng-shop-sec-count tabular-nums">
              {ownedRoomsCount} / {ROOM_THEMES.length} Rooms
            </span>
          </div>

          <div className="ng-shop-sec-body">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ROOM_THEMES.map((room) => {
                const isOwned = Boolean(state.ownedRooms[room.id]);
                const isActive = state.roomBgId === room.id;

                return (
                  <div key={room.id} className="ng-shop-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={room.src}
                      alt=""
                      className="h-24 w-full rounded-[14px] object-cover shadow-[0_4px_10px_rgba(42,66,14,0.16)]"
                    />
                    <strong className="noggin-display text-[14.5px] font-extrabold text-[var(--noggin-forest)]">
                      {room.name}
                    </strong>

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
                        className="ng-btn ng-btn--leaf ng-btn--sm mt-auto w-full"
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
                        className="ng-btn ng-btn--gold ng-btn--sm mt-auto w-full"
                      >
                        Buy 🪙 {room.price}
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="ng-shop-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/game/ui/icon-chest-clay.svg"
                  alt=""
                  width={58}
                  height={58}
                  className="h-14 w-14 object-contain"
                />
                <strong className="noggin-display text-[14.5px] font-extrabold text-[var(--noggin-forest)]">
                  Streak Restore
                </strong>
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
                  className="ng-btn ng-btn--gold ng-btn--sm mt-auto w-full"
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
