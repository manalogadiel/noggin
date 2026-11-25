"use client";

import { Check, LogOut, Mic, Music, Volume2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import type {
  SaveAccountActionInput,
  SaveAccountActionResult,
} from "@/app/(app)/actions/profile-actions";
import { useGameUi } from "@/components/game-ui/game-ui-context";
import type { ProfileSettings } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export interface AccountFormProps {
  initialDisplayName: string;
  email: string;
  initialSettings: ProfileSettings;
  onSave: (input: SaveAccountActionInput) => Promise<SaveAccountActionResult>;
  onSignOut: () => Promise<unknown>;
}

export function AccountForm({
  initialDisplayName,
  email,
  initialSettings,
  onSave,
  onSignOut,
}: AccountFormProps) {
  const { state: gameState, updateState } = useGameUi();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [settings, setSettings] = useState<ProfileSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setFormError(null);

    try {
      const result = await onSave({
        displayName,
        settings,
      });

      if (result.status === "ok") {
        setSaved(true);
      } else {
        setFormError(result.error);
      }
    } catch {
      setFormError("Couldn't save account changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogOut() {
    await onSignOut();
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="prof-panel gap-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="account-display-name"
              className="figma-auth-label block"
            >
              Display name
            </label>
            <input
              id="account-display-name"
              name="displayName"
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSaved(false);
                setFormError(null);
              }}
              className="g-input h-12 rounded-[14px]"
            />
          </div>

          <div className="space-y-1.5">
            <span className="figma-auth-label block">
              Email address
            </span>
            <p className="m-0 flex h-12 items-center truncate rounded-[14px] bg-[var(--ng-c-f4efe0)] px-4 text-[0.9375rem] font-semibold text-[var(--noggin-ink)]">
              {email}
            </p>
          </div>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
            Grill mode
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(
              [
                { value: "roast", label: "Playful roast", desc: "Witty banter & tough follow-ups" },
                { value: "gentle", label: "Gentle", desc: "Warm encouragement & patient hints" },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 shadow-[0_2px_8px_var(--noggin-shadow)] transition-colors",
                  settings.grillMode === option.value
                    ? "bg-[var(--noggin-mint-light)] ring-2 ring-[var(--noggin-leaf-strong)]"
                    : "bg-[var(--noggin-white)]",
                )}
              >
                <input
                  type="radio"
                  name="grillMode"
                  value={option.value}
                  checked={settings.grillMode === option.value}
                  onChange={() => {
                    setSettings((prev) => ({
                      ...prev,
                      grillMode: option.value,
                    }));
                    setSaved(false);
                  }}
                  className="h-4 w-4 accent-[var(--noggin-leaf-strong)]"
                />
                <span className="flex flex-col">
                  <strong className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                    {option.label}
                  </strong>
                  <span className="text-[0.75rem] text-[var(--noggin-ink)]">
                    {option.desc}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
            Microphone mode
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(
              [
                { value: "tap", label: "Tap to talk", desc: "Tap once to record, tap to send" },
                { value: "hold", label: "Hold to talk", desc: "Hold button while speaking" },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 shadow-[0_2px_8px_var(--noggin-shadow)] transition-colors",
                  settings.micMode === option.value
                    ? "bg-[var(--noggin-mint-light)] ring-2 ring-[var(--noggin-leaf-strong)]"
                    : "bg-[var(--noggin-white)]",
                )}
              >
                <input
                  type="radio"
                  name="micMode"
                  value={option.value}
                  checked={settings.micMode === option.value}
                  onChange={() => {
                    setSettings((prev) => ({
                      ...prev,
                      micMode: option.value,
                    }));
                    setSaved(false);
                  }}
                  className="h-4 w-4 accent-[var(--noggin-leaf-strong)]"
                />
                <span className="flex flex-col">
                  <strong className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                    {option.label}
                  </strong>
                  <span className="text-[0.75rem] text-[var(--noggin-ink)]">
                    {option.desc}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
            Audio switches
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-[var(--noggin-white)] px-4 py-3 shadow-[0_2px_8px_var(--noggin-shadow)]">
              <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                Nog voice
              </span>
              <button
                type="button"
                role="switch"
                aria-label="Nog voice"
                aria-checked={settings.voiceEnabled}
                onClick={() => {
                  setSettings((prev) => ({
                    ...prev,
                    voiceEnabled: !prev.voiceEnabled,
                  }));
                  setSaved(false);
                }}
                className={cn(
                  "inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors",
                  settings.voiceEnabled
                    ? "bg-[var(--noggin-leaf-strong)]"
                    : "bg-[var(--noggin-sand)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-5 w-5 rounded-full bg-[var(--noggin-white)] transition-transform",
                    settings.voiceEnabled ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-[var(--noggin-white)] px-4 py-3 shadow-[0_2px_8px_var(--noggin-shadow)]">
              <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                Sounds
              </span>
              <button
                type="button"
                role="switch"
                aria-label="Sounds"
                aria-checked={settings.soundsEnabled}
                onClick={() => {
                  setSettings((prev) => ({
                    ...prev,
                    soundsEnabled: !prev.soundsEnabled,
                  }));
                  setSaved(false);
                }}
                className={cn(
                  "inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors",
                  settings.soundsEnabled
                    ? "bg-[var(--noggin-leaf-strong)]"
                    : "bg-[var(--noggin-sand)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-5 w-5 rounded-full bg-[var(--noggin-white)] transition-transform",
                    settings.soundsEnabled ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </div>
        </fieldset>

        {formError && (
          <p
            role="alert"
            className="rounded-[16px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-semibold text-[var(--noggin-danger)]"
          >
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="status" aria-live="polite" aria-atomic="true">
            {saved && (
              <span className="noggin-display inline-flex items-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 py-2 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]">
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Saved!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="gbtn gbtn--leaf disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      <section aria-label="Sound and Audio Mixer" className="prof-panel">
        <h2 className="prof-panel__title m-0">Sound &amp; Audio</h2>

        <div className="prof-audio-list">
          {(
            [
              {
                key: "music",
                label: "Background music volume",
                title: "Background Music",
                value: gameState.audio.music,
                icoClass: "prof-audio-ico--music",
                icon: Music,
              },
              {
                key: "sfx",
                label: "Sound effects volume",
                title: "UI Sound Effects",
                value: gameState.audio.sfx,
                icoClass: "prof-audio-ico--sfx",
                icon: Volume2,
              },
              {
                key: "voice",
                label: "Speech synthesis volume",
                title: "Speech Volume",
                value: gameState.audio.voice,
                icoClass: "prof-audio-ico--voice",
                icon: Mic,
              },
            ] as const
          ).map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.key} className="prof-audio-row">
                <span className={`prof-audio-ico ${row.icoClass}`} aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="prof-audio-ctrl">
                  <div className="prof-audio-head">
                    <label htmlFor={`audio-slider-${row.key}`}>{row.title}</label>
                    <span className="tnum">{row.value}%</span>
                  </div>
                  <input
                    id={`audio-slider-${row.key}`}
                    type="range"
                    min={0}
                    max={100}
                    aria-label={row.label}
                    value={row.value}
                    onChange={(event) => {
                      const nextVal = Number(event.target.value);
                      updateState((prev) => ({
                        ...prev,
                        audio: { ...prev.audio, [row.key]: nextVal },
                      }));
                    }}
                    className="prof-slider"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleLogOut()}
          className="gbtn gbtn--white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
