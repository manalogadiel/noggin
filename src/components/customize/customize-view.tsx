"use client";

import { Check, Plus } from "lucide-react";
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
  const initialColor = nog.colors?.body ?? null;

  const { state, openModal, requestPurchase, updateState, showToast } = useGameUi();

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

  return (
    <div className="relative mx-auto flex w-full max-w-[1160px] flex-col gap-6 rounded-[28px] px-4 py-4 md:px-6 md:py-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="noggin-display text-[clamp(2.25rem,4.5vw,3.5rem)] font-extrabold leading-[1.02] tracking-tight text-[var(--noggin-leaf-title)]">
          Make your Nog Yours
        </h1>
        <p className="text-[1.0625rem] font-semibold text-[var(--noggin-forest)]">
          Customize your Nog
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-12">
        {/* LEFT: Grounded Spotlight Stage + Orbiting Accessory Bubbles + 3D Books Pedestal */}
        <div className="relative flex flex-col items-center justify-center rounded-3xl bg-[rgb(255_253_245_/_0.52)] p-4 lg:p-6">
          <div className="relative flex w-full max-w-[440px] flex-col items-center py-6">
            {ORBIT_SLOT_POSITIONS.map((posCls, slotIdx) => {
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
                    "absolute z-20 flex h-13 w-13 items-center justify-center rounded-full border-2 shadow-md transition",
                    posCls,
                    item
                      ? "border-[var(--ng-c-f5be2c)] bg-white"
                      : "border-dashed border-[var(--noggin-sage-strong)] bg-[rgb(255_253_245_/_0.75)] text-[var(--noggin-ink)]",
                  )}
                >
                  {item ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.img} alt={item.name} className="h-8 w-8 object-contain" />
                  ) : (
                    <span className="text-lg font-black" aria-hidden="true">
                      +
                    </span>
                  )}
                </button>
              );
            })}

            <div className="relative z-10 -mb-6 w-full max-w-[300px] lg:max-w-[360px]">
              <NogStage
                scene="room"
                alt={`${nog.name} preview`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 360px, 300px"
                tint={selectedColor}
                priority
                className="w-full"
              />
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/game/ui/books-pedestal-3d.png"
              alt=""
              aria-hidden="true"
              className="relative z-0 w-56 object-contain md:w-64"
            />
          </div>
        </div>

        {/* RIGHT: Cardless Controls */}
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]">
                Body Color
              </h2>
              <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Owned skin packages">
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
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-extrabold transition",
                        isPackActive
                          ? "bg-[var(--noggin-leaf-strong)] text-white shadow-sm"
                          : "bg-[var(--ng-c-e8dec4)] text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
                      )}
                    >
                      {pack.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => openModal({ type: "skinShop" })}
                  aria-label="Open Skin Shop for more packs"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ng-c-ffe26a)] text-sm font-black text-[var(--ng-c-4a2e00)] shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label="Body color"
              className="flex flex-wrap items-center gap-3.5"
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
                    style={{
                      backgroundColor: fill,
                      borderColor: isSelected
                        ? "var(--noggin-forest)"
                        : "color-mix(in srgb, var(--noggin-forest) 38%, transparent)",
                    }}
                    className={cn(
                      "inline-flex h-16 w-16 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[18px] border-2 text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf-strong)] motion-reduce:transition-none",
                      isSelected && "ring-2 ring-[var(--noggin-leaf-strong)]",
                    )}
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
                  style={{
                    backgroundColor: customColor,
                    borderColor:
                      selectedColor === customColor
                        ? "var(--noggin-forest)"
                        : "color-mix(in srgb, var(--noggin-forest) 38%, transparent)",
                  }}
                  className={cn(
                    "inline-flex h-16 w-16 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[18px] border-2 text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf-strong)] motion-reduce:transition-none",
                    selectedColor === customColor &&
                      "ring-2 ring-[var(--noggin-leaf-strong)]",
                  )}
                >
                  {selectedColor === customColor && (
                    <Check className="h-6 w-6 stroke-[2.75]" aria-hidden="true" />
                  )}
                </button>
              )}

              <label
                htmlFor={customInputId}
                className="relative inline-flex h-16 w-16 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[18px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-cream)] text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--noggin-leaf-strong)] motion-reduce:transition-none"
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

          <section className="flex flex-col gap-3">
            <header className="flex items-center justify-between gap-3">
              <h2 className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]">
                Accessories
              </h2>
              <Link
                href="/profile/shop"
                className="text-xs font-extrabold text-[var(--noggin-leaf-strong)] underline underline-offset-4"
              >
                Open Shop →
              </Link>
            </header>

            <div className="flex flex-wrap items-center gap-3">
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
                      "relative flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-1.5 transition hover:-translate-y-0.5",
                      isEquipped
                        ? "border-[var(--noggin-leaf-strong)] bg-[var(--ng-c-e8f6d2)] shadow-md"
                        : isOwned
                          ? "border-[var(--ng-c-e3d6b4)] bg-white shadow-sm"
                          : "border-[var(--ng-c-e3d6b4)] bg-[rgb(245_236_213_/_0.8)]",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={acc.img} alt="" className="h-9 w-9 object-contain" />
                    <span className="rounded-full bg-[var(--ng-c-ffe26a)] px-2 py-0.5 text-[10px] font-black text-[var(--ng-c-4a2e00)]">
                      {!isOwned ? `🪙 ${acc.price}` : isEquipped ? "Equipped" : acc.defaultStatus === "free" ? "FREE" : "OWNED"}
                    </span>
                  </button>
                );
              })}

              <Link
                href="/profile/shop"
                aria-label="Open shop for more accessories"
                className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--noggin-sage-strong)] bg-[var(--noggin-cream)] text-[var(--noggin-forest)] transition hover:-translate-y-0.5"
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

          <button
            type="button"
            disabled={isSaving}
            onClick={handleDone}
            className="noggin-primary-pill noggin-display mt-1 inline-flex min-h-14 w-full cursor-pointer items-center justify-center px-8 text-[1.25rem] font-bold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
