"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Settings, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import type { ProfileSettings } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export type SaveProfileSettingsResult =
  | { status: "ok" }
  | { status: "error"; error: string };

export type SaveProfileSettingsHandler = (
  settings: ProfileSettings,
) => Promise<SaveProfileSettingsResult>;

export interface SettingsSheetProps {
  initialSettings: ProfileSettings;
  onSave: SaveProfileSettingsHandler;
}

export function SettingsSheet({ initialSettings, onSave }: SettingsSheetProps) {
  const [open, setOpen] = useState(false);
  const [baseline, setBaseline] = useState<ProfileSettings>(initialSettings);
  const [draft, setDraft] = useState<ProfileSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const voiceId = useId();
  const voiceDescId = useId();
  const soundsId = useId();
  const soundsDescId = useId();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(baseline);
      setError(null);
      setSavedNotice(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSavedNotice(false);

    try {
      const result = await onSave({ ...draft });
      if (result.status === "ok") {
        setBaseline({ ...draft });
        setError(null);
        setSavedNotice(true);
        setOpen(false);
      } else {
        setError(result.error || "Couldn't save settings. Try again.");
      }
    } catch {
      setError("Couldn't save settings. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Trigger
          aria-label="Settings"
          className="inline-flex h-11 w-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--noggin-forest)_35%,transparent)] backdrop-blur-[2px]" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,460px)] max-h-[90dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[32px] bg-[var(--noggin-cream)] p-6 text-[var(--noggin-forest)] shadow-[0_20px_48px_var(--noggin-shadow-strong)] outline-none sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="noggin-display text-[1.5rem] font-extrabold leading-tight text-[var(--noggin-forest)]">
                  Room settings
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[0.9375rem] text-[var(--noggin-ink)]">
                  Choose how your Nog talks, listens, and plays sounds.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Close settings"
                className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] hover:bg-[var(--noggin-mint)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <fieldset className="space-y-2.5">
                <legend className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                  Grill mode
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: "roast", label: "Roast", hint: "Playful teasing" },
                      { value: "gentle", label: "Gentle", hint: "Soft & encouraging" },
                    ] as const
                  ).map((option) => {
                    const checked = draft.grillMode === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex min-h-14 cursor-pointer flex-col justify-center rounded-[20px] px-4 py-3 transition-colors",
                          checked
                            ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                            : "bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)] hover:bg-[var(--noggin-mint)]",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="grillMode"
                            value={option.value}
                            checked={checked}
                            onChange={() =>
                              setDraft((prev) => ({
                                ...prev,
                                grillMode: option.value,
                              }))
                            }
                            className="h-4 w-4 accent-[var(--noggin-leaf-strong)]"
                          />
                          <span className="noggin-display text-[1rem] font-bold">
                            {option.label}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 pl-6 text-[0.8125rem]",
                            checked
                              ? "text-[var(--noggin-mint-light)]"
                              : "text-[var(--noggin-ink)]",
                          )}
                        >
                          {option.hint}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-2.5">
                <legend className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                  Mic mode
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: "tap", label: "Tap", hint: "Tap to start & stop" },
                      { value: "hold", label: "Hold", hint: "Press while talking" },
                    ] as const
                  ).map((option) => {
                    const checked = draft.micMode === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex min-h-14 cursor-pointer flex-col justify-center rounded-[20px] px-4 py-3 transition-colors",
                          checked
                            ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                            : "bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)] hover:bg-[var(--noggin-mint)]",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="micMode"
                            value={option.value}
                            checked={checked}
                            onChange={() =>
                              setDraft((prev) => ({
                                ...prev,
                                micMode: option.value,
                              }))
                            }
                            className="h-4 w-4 accent-[var(--noggin-leaf-strong)]"
                          />
                          <span className="noggin-display text-[1rem] font-bold">
                            {option.label}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 pl-6 text-[0.8125rem]",
                            checked
                              ? "text-[var(--noggin-mint-light)]"
                              : "text-[var(--noggin-ink)]",
                          )}
                        >
                          {option.hint}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[var(--noggin-white)] px-4 py-3.5 shadow-[0_2px_8px_var(--noggin-shadow)]">
                  <div>
                    <label
                      htmlFor={voiceId}
                      className="noggin-display block cursor-pointer text-[1rem] font-bold text-[var(--noggin-forest)]"
                    >
                      Voice
                    </label>
                    <p
                      id={voiceDescId}
                      className="text-[0.8125rem] text-[var(--noggin-ink)]"
                    >
                      Hear your Nog speak its answers aloud.
                    </p>
                  </div>
                  <input
                    id={voiceId}
                    type="checkbox"
                    aria-describedby={voiceDescId}
                    checked={draft.voiceEnabled}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        voiceEnabled: event.target.checked,
                      }))
                    }
                    className="h-6 w-6 shrink-0 cursor-pointer rounded accent-[var(--noggin-leaf-strong)]"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[var(--noggin-white)] px-4 py-3.5 shadow-[0_2px_8px_var(--noggin-shadow)]">
                  <div>
                    <label
                      htmlFor={soundsId}
                      className="noggin-display block cursor-pointer text-[1rem] font-bold text-[var(--noggin-forest)]"
                    >
                      Sounds
                    </label>
                    <p
                      id={soundsDescId}
                      className="text-[0.8125rem] text-[var(--noggin-ink)]"
                    >
                      Play playful pops and room sound effects.
                    </p>
                  </div>
                  <input
                    id={soundsId}
                    type="checkbox"
                    aria-describedby={soundsDescId}
                    checked={draft.soundsEnabled}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        soundsEnabled: event.target.checked,
                      }))
                    }
                    className="h-6 w-6 shrink-0 cursor-pointer rounded accent-[var(--noggin-leaf-strong)]"
                  />
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-[16px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-danger)]"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <Dialog.Close className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-5 py-2.5 text-[0.9375rem] font-semibold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] hover:bg-[var(--noggin-mint)]">
                  Cancel
                </Dialog.Close>

                <button
                  type="submit"
                  disabled={saving}
                  className="noggin-primary-pill noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center px-6 py-2.5 text-[1rem] font-bold disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 bottom-24 z-40 md:bottom-6"
      >
        {savedNotice && (
          <div className="noggin-display inline-flex items-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-4 py-2.5 text-[0.9375rem] font-bold text-[var(--noggin-white)] shadow-[0_10px_24px_var(--noggin-shadow-strong)]">
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>Saved</span>
          </div>
        )}
      </div>
    </>
  );
}
