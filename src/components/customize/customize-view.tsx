"use client";

import { Check, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { customizeNogAction } from "@/app/(app)/actions/customize-actions";
import {
  ACCESSORIES,
  SKIN_PACKS,
  type SkinPackId,
  useGameUi,
} from "@/components/game-ui/game-ui-context";
import { NogStage } from "@/components/nog-3d/nog-stage";
import type { NogRecord } from "@/core/application/ports";
import { NOG_BODY_COLORS, parseBodyColor } from "@/core/domain/nog-colors";
import { cn } from "@/lib/utils";

export interface CustomizeViewProps {
  nog: NogRecord;
}

const ORBIT_SLOT_POSITIONS = [
  "top-2 left-2",
  "top-1/2 -translate-y-1/2 left-0",
  "bottom-8 left-4",
  "top-2 right-2",
] as const;

function isPresetColor(hex: string | null): boolean {
  return NOG_BODY_COLORS.some((preset) => preset.hex === hex);
}

export function CustomizeView({ nog }: CustomizeViewProps) {
  const router = useRouter();
  const customInputId = useId();
  const nameInputId = useId();
  const initialColor = nog.colors?.body ?? null;

  const { state, openModal, requestPurchase, updateState, showToast } = useGameUi();

  const [draftName, setDraftName] = useState(nog.name);
  const [selectedColor, setSelectedColor] = useState<string | null>(initialColor);
  const [customColor, setCustomColor] = useState<string | null>(
    initialColor && !isPresetColor(initialColor) ? initialColor : null,
  );
  const [equippedSlots, setEquippedSlots] = useState<(string | null)[]>(
    () => state.equippedSlots,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const roomHref = `/nogs/${nog.id}`;
  const defaultPickerValue =
    customColor ?? selectedColor ?? NOG_BODY_COLORS[1]?.hex ?? "rgb(217 200 245)";

  const ownedPacks = SKIN_PACKS.filter(
    (pack) => state.ownedSkinPacks[pack.id] || state.isPlus || pack.price === 0,
  );
  const activePack =
    SKIN_PACKS.find((pack) => pack.id === state.activeSkinPack) ?? SKIN_PACKS[0];

  function handleToggleAccessory(accId: string) {
    const acc = ACCESSORIES.find((a) => a.id === accId);
    if (!acc) return;
    const isOwned = Boolean(
      state.ownedAccessories[acc.id] || acc.defaultStatus !== "locked",
    );
    if (!isOwned) {
      requestPurchase({
        title: "BUY ACCESSORY",
        itemLabel: acc.name,
        cost: acc.price,
        onConfirm: () => {
          setEquippedSlots((prev) => {
            const nextSlots = [...prev];
            nextSlots[acc.slot] = acc.id;
            return nextSlots;
          });
          updateState((prev) => {
            const nextSlots = [...prev.equippedSlots];
            nextSlots[acc.slot] = acc.id;
            return {
              ...prev,
              coins: Math.max(0, prev.coins - acc.price),
              ownedAccessories: { ...prev.ownedAccessories, [acc.id]: true },
              equippedSlots: nextSlots,
            };
          });
          showToast(`Unlocked & equipped ${acc.name}!`);
        },
      });
      return;
    }

    setEquippedSlots((prev) => {
      const nextSlots = [...prev];
      nextSlots[acc.slot] = nextSlots[acc.slot] === acc.id ? null : acc.id;
      return nextSlots;
    });
    updateState((prev) => {
      const nextSlots = [...prev.equippedSlots];
      const alreadyAtSlot = nextSlots[acc.slot] === acc.id;
      nextSlots[acc.slot] = alreadyAtSlot ? null : acc.id;
      return { ...prev, equippedSlots: nextSlots };
    });
  }

  function handleSlotRemove(slotIdx: number) {
    const itemId = equippedSlots[slotIdx];
    if (!itemId) return;
    setEquippedSlots((prev) => {
      const nextSlots = [...prev];
      nextSlots[slotIdx] = null;
      return nextSlots;
    });
    updateState((prev) => {
      const nextSlots = [...prev.equippedSlots];
      nextSlots[slotIdx] = null;
      return { ...prev, equippedSlots: nextSlots };
    });
  }

  async function handleDone() {
    if (isSaving) return;

    if (selectedColor === initialColor) {
      router.push(roomHref);
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const result = await customizeNogAction({
        nogId: nog.id,
        body: selectedColor,
      });

      if (result.status === "ok") {
        router.push(roomHref);
        return;
      }

      if (result.status === "invalid") {
        setErrorMessage("That color didn’t stick — pick another");
      } else {
        setErrorMessage("Couldn’t save — try again");
      }
    } catch {
      setErrorMessage("Couldn’t save — try again");
    } finally {
      setIsSaving(false);
    }
  }

  const custBubblePositions = [
    "cust-bubble--l1",
    "cust-bubble--l2",
    "cust-bubble--l3",
    "cust-bubble--r1",
    "cust-bubble--r2",
    "cust-bubble--r3",
  ] as const;

  return (
    <div className="game-world game-world--hub game-world--customize cs-world">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/select-stage.jpg"
        alt=""
        className="cs-bg-img -scale-x-100"
      />
      <div className="cs-spotlight-overlay -scale-x-100" aria-hidden="true" />

      <div className="stage-body stage-body--customize justify-center">
        <div className="mb-1 flex flex-wrap items-baseline gap-2.5">
          <h1
            className="stage-h1"
            style={{
              fontSize: 22,
              color: "var(--noggin-white)",
              textShadow: "0 2px 10px rgb(34 56 12 / 0.35)",
            }}
          >
            Make your Nog Yours
          </h1>
          <p
            className="stage-sub"
            style={{
              fontSize: 13,
              color: "rgb(255 255 255 / 0.88)",
              textShadow: "0 1px 6px rgb(34 56 12 / 0.35)",
            }}
          >
            Customize your Nog
          </p>
        </div>

        <div className="cust-layout">
          {/* LEFT: Grounded Spotlight Stage + 6 Orbiting Accessory Bubbles + 3D Turntable Stand */}
          <div className="cust-stage-left">
            <div className="cust-spotlight-cone" aria-hidden="true" />
            <div className="cust-orbit-wrap">
              <div className="cust-nog-aura" aria-hidden="true" />
              {ORBIT_SLOT_POSITIONS.map((_, slotIdx) => {
                const posCls = custBubblePositions[slotIdx] ?? "cust-bubble--l1";
                const id = equippedSlots[slotIdx];
                const item = id ? ACCESSORIES.find((a) => a.id === id) : null;
                return (
                  <button
                    key={slotIdx}
                    type="button"
                    onClick={() => handleSlotRemove(slotIdx)}
                    aria-label={
                      item
                        ? `Slot ${slotIdx + 1}: ${item.name} (click to remove)`
                        : `Empty accessory slot ${slotIdx + 1}`
                    }
                    className={cn(
                      "cust-bubble",
                      posCls,
                      item && "is-filled",
                    )}
                  >
                    {item ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.img} alt={item.name} />
                    ) : (
                      <span className="cust-bubble__plus" aria-hidden="true">
                        +
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                className="cust-bubble cust-bubble--r2 is-locked"
                disabled
                aria-label="Slot 5 unlocks at Level 3"
              >
                <span>Lv.3</span>
              </button>
              <button
                type="button"
                className="cust-bubble cust-bubble--r3 is-locked"
                disabled
                aria-label="Slot 6 unlocks at Level 5"
              >
                <span>Lv.5</span>
              </button>

              <div
                className={cn(
                  "cust-nog-bob nog-bob",
                  nog.stage === "hatchling" && "cust-nog-bob--baby",
                )}
              >
                <NogStage
                  scene="room"
                  alt={`${nog.name} preview`}
                  poster="/nog/blob-closeup.png"
                  width={1254}
                  height={1254}
                  sizes="(min-width: 1024px) 360px, 300px"
                  tint={selectedColor}
                  priority
                  className={cn(
                    "cust-nog-img",
                    nog.stage === "hatchling" && "cust-nog-img--baby",
                  )}
                />
              </div>

              <div className="cust-stand" aria-hidden="true">
                <div className="cust-stand__contact" />
                <div className="cust-stand__top" />
                <div className="cust-stand__base" />
                <div className="cust-stand__pool" />
              </div>
            </div>
          </div>

          {/* RIGHT: Cardless Controls */}
          <div className="cust-controls">
            <section className="cust-section cust-section--name">
              <div className="cust-section__head">
                <label htmlFor={nameInputId} className="cust-heading">
                  Nog Name
                </label>
              </div>
              <div className="cust-name-row">
                <input
                  id={nameInputId}
                  type="text"
                  maxLength={24}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Name your Nog"
                  className="cust-name-input"
                />
                <span className="cust-name-icon" aria-hidden="true">
                  <Pencil className="h-4 w-4" strokeWidth={2.4} />
                </span>
              </div>
            </section>

            <section className="cust-section">
              <div className="cust-section__head">
                <h2 className="cust-heading">Body Color</h2>
              </div>
              <div
                className="cust-pack-row m-0"
                role="tablist"
                aria-label="Owned skin packages"
              >
                {ownedPacks.map((pack) => {
                  const isPackActive = activePack.id === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      role="tab"
                      aria-selected={isPackActive}
                      onClick={() =>
                        updateState((prev) => ({
                          ...prev,
                          activeSkinPack: pack.id as SkinPackId,
                        }))
                      }
                      className={cn("cust-pack-btn", isPackActive && "is-on")}
                    >
                      {pack.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => openModal({ type: "skinShop" })}
                  aria-label="Open Skin Shop for more packs"
                  className="cust-pack-btn is-locked"
                >
                  +
                </button>
              </div>

              <div
                role="radiogroup"
                aria-label="Body color"
                className="cust-swatch-row"
              >
                {NOG_BODY_COLORS.map((preset) => {
                  const isSelected = selectedColor === preset.hex;
                  const fill = preset.hex ?? "var(--noggin-cream)";

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-label={preset.label}
                      aria-checked={isSelected}
                      onClick={() => {
                        setErrorMessage(null);
                        setSelectedColor(preset.hex);
                      }}
                      style={{ backgroundColor: fill }}
                      className={cn("cust-swatch", isSelected && "is-selected")}
                    >
                      {isSelected && (
                        <Check className="h-6 w-6 stroke-[2.75]" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}

                {customColor && (
                  <button
                    type="button"
                    role="radio"
                    aria-label="Custom"
                    aria-checked={selectedColor === customColor}
                    onClick={() => {
                      setErrorMessage(null);
                      setSelectedColor(customColor);
                    }}
                    style={{ backgroundColor: customColor }}
                    className={cn(
                      "cust-swatch",
                      selectedColor === customColor && "is-selected",
                    )}
                  >
                    {selectedColor === customColor && (
                      <Check className="h-6 w-6 stroke-[2.75]" aria-hidden="true" />
                    )}
                  </button>
                )}

                <label
                  htmlFor={customInputId}
                  className="cust-swatch cust-swatch--plus"
                >
                  <Plus className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
                  <input
                    id={customInputId}
                    type="color"
                    aria-label="Custom color"
                    value={defaultPickerValue}
                    onChange={(event) => {
                      const parsed = parseBodyColor(event.target.value);
                      const nextHex =
                        parsed.ok && parsed.value
                          ? parsed.value
                          : event.target.value.trim().toLowerCase();
                      setErrorMessage(null);
                      setCustomColor(nextHex);
                      setSelectedColor(nextHex);
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            </section>

            <section className="cust-section">
              <header className="cust-section__head">
                <h2 className="cust-heading">Accessories</h2>
              </header>

              <div className="cust-acc-row flex-wrap">
                {ACCESSORIES.map((acc) => {
                  const isEquipped = equippedSlots.includes(acc.id);
                  const isOwned = Boolean(
                    state.ownedAccessories[acc.id] || acc.defaultStatus !== "locked",
                  );
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      aria-pressed={isEquipped}
                      aria-label={`${acc.name} (${isOwned ? (isEquipped ? "equipped" : acc.defaultStatus) : `${acc.price} coins`})`}
                      onClick={() => handleToggleAccessory(acc.id)}
                      className={cn(
                        "cust-acc-tile",
                        isEquipped ? "is-equipped" : !isOwned && "is-locked",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={acc.img} alt="" className="cust-acc-tile__img" />
                      {isEquipped && (
                        <span className="cust-acc-check" aria-hidden="true">
                          <Check />
                        </span>
                      )}
                      <span
                        className={cn(
                          "cust-acc-tag",
                          !isOwned
                            ? "cust-acc-tag--locked"
                            : acc.defaultStatus === "free" && !isEquipped
                              ? "cust-acc-tag--free"
                              : "cust-acc-tag--owned",
                        )}
                      >
                        {!isOwned
                          ? `🪙 ${acc.price}`
                          : isEquipped
                            ? "Equipped"
                            : acc.defaultStatus === "free"
                              ? "FREE"
                              : "OWNED"}
                      </span>
                    </button>
                  );
                })}

                <Link
                  href="/profile/shop"
                  aria-label="Open shop for more accessories"
                  className="cust-acc-tile cust-acc-tile--plus"
                >
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </Link>
              </div>
            </section>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-[20px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-semibold text-[var(--noggin-danger)]"
              >
                {errorMessage}
              </p>
            )}

            <div className="cust-done-wrap">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleDone}
                className="cust-done-btn disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving…" : "Done"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
