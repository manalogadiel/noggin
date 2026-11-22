"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { customizeNogAction } from "@/app/(app)/actions/customize-actions";
import { NogStage } from "@/components/nog-3d/nog-stage";
import type { NogRecord } from "@/core/application/ports";
import { NOG_BODY_COLORS, parseBodyColor } from "@/core/domain/nog-colors";
import { cn } from "@/lib/utils";

export interface CustomizeViewProps {
  nog: NogRecord;
}

const ACCESSORY_SLOTS = [
  "Accessory slot 1",
  "Accessory slot 2",
  "Accessory slot 3",
] as const;

function isPresetColor(hex: string | null): boolean {
  return NOG_BODY_COLORS.some((preset) => preset.hex === hex);
}

export function CustomizeView({ nog }: CustomizeViewProps) {
  const router = useRouter();
  const customInputId = useId();
  const initialColor = nog.colors?.body ?? null;

  const [selectedColor, setSelectedColor] = useState<string | null>(
    initialColor,
  );
  const [customColor, setCustomColor] = useState<string | null>(
    initialColor && !isPresetColor(initialColor) ? initialColor : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const roomHref = `/nogs/${nog.id}`;
  const defaultPickerValue =
    customColor ?? selectedColor ?? NOG_BODY_COLORS[1]?.hex ?? "";

  async function handleDone() {
    if (isSaving) {
      return;
    }

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
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 py-4 md:py-8">
      <div className="flex flex-col gap-2">
        <h1 className="noggin-display text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-[1.02] tracking-tight text-[var(--noggin-leaf-title)]">
          Make your Nog Yours
        </h1>
        <p className="text-[1.125rem] font-semibold text-[var(--noggin-forest)]">
          Customize your Nog
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-12">
        <div className="flex flex-col items-center justify-center p-2 lg:p-4">
          <div className="w-full max-w-[340px] lg:max-w-[600px]">
            <NogStage
              scene="room"
              alt={`${nog.name} preview`}
              poster="/nog/blob-closeup.png"
              width={1254}
              height={1254}
              sizes="(min-width: 1024px) 600px, 340px"
              tint={selectedColor}
              priority
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-col gap-7">
          <section className="flex flex-col gap-3.5">
            <h2 className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]">
              Body Color
            </h2>

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
                      <Check
                        className="h-6 w-6 stroke-[2.75]"
                        aria-hidden="true"
                      />
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
                    <Check
                      className="h-6 w-6 stroke-[2.75]"
                      aria-hidden="true"
                    />
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

          <section className="flex flex-col gap-3.5">
            <header className="flex items-center gap-3">
              <h2 className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]">
                Accessories
              </h2>
              <span className="noggin-display inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3 py-0.5 text-[0.8125rem] font-bold text-[var(--noggin-forest)]">
                Soon
              </span>
            </header>

            <div className="flex flex-wrap items-center gap-3.5">
              {ACCESSORY_SLOTS.map((slotLabel) => (
                <button
                  key={slotLabel}
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label={`${slotLabel} (coming soon)`}
                  className="inline-flex h-16 w-16 min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-[18px] border-2 border-dashed border-[color-mix(in_srgb,var(--noggin-forest)_30%,transparent)] bg-[var(--noggin-cream)] opacity-60"
                />
              ))}

              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-label="More accessories (coming soon)"
                className="inline-flex h-16 w-16 min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-[18px] border-2 border-dashed border-[color-mix(in_srgb,var(--noggin-forest)_30%,transparent)] bg-[var(--noggin-cream)] text-[var(--noggin-forest)] opacity-60"
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <p className="text-[0.9375rem] font-medium text-[var(--noggin-ink)]">
              Hats and bows are coming soon.
            </p>
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
