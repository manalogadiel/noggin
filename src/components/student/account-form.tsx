"use client";

import { Check, LogOut } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import type {
  SaveAccountActionInput,
  SaveAccountActionResult,
} from "@/app/(app)/actions/profile-actions";
import type { ProfileSettings } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export interface AccountFormProps {
  initialDisplayName: string;
  email: string;
  initialSettings: ProfileSettings;
  onSave: (input: SaveAccountActionInput) => Promise<SaveAccountActionResult>;
  onSignOut: () => Promise<unknown> | void;
}

export function AccountForm({
  initialDisplayName,
  email,
  initialSettings,
  onSave,
  onSignOut,
}: AccountFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [settings, setSettings] = useState<ProfileSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const displayNameId = useId();
  const displayNameErrorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    setNameError(null);
    setFormError(null);
    setSaved(false);

    try {
      const result = await onSave({
        displayName,
        settings: { ...settings },
      });

      if (result.status === "ok") {
        setSaved(true);
      } else if (result.status === "invalid_name") {
        setNameError(result.error || "Use 1–40 characters");
      } else {
        setFormError(
          result.error || "Couldn't save account changes. Try again.",
        );
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
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-6 rounded-[36px] bg-[var(--noggin-panel)] p-6 text-[var(--noggin-forest)] shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-8"
      >
        <div className="space-y-2">
          <label
            htmlFor={displayNameId}
            className="noggin-display block text-[1rem] font-bold text-[var(--noggin-forest)]"
          >
            Display name
          </label>
          <input
            id={displayNameId}
            name="displayName"
            type="text"
            required
            maxLength={40}
            value={displayName}
            aria-invalid={nameError ? "true" : undefined}
            aria-describedby={nameError ? displayNameErrorId : undefined}
            onChange={(event) => {
              setDisplayName(event.target.value);
              if (nameError) setNameError(null);
              if (saved) setSaved(false);
            }}
            className="min-h-12 w-full rounded-[12px] bg-[var(--noggin-white)] px-4 py-2.5 text-[1rem] font-medium text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)] outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf-strong)]"
          />
          {nameError && (
            <p
              id={displayNameErrorId}
              role="alert"
              className="rounded-[12px] bg-[var(--noggin-danger-soft)] px-3.5 py-2 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
            >
              {nameError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="noggin-display block text-[1rem] font-bold text-[var(--noggin-forest)]">
            Email
          </span>
          <p className="min-h-12 rounded-[12px] bg-[var(--noggin-cream)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-forest)]">
            {email}
          </p>
        </div>

        <fieldset className="space-y-5">
          <legend className="noggin-display text-[1.125rem] font-extrabold text-[var(--noggin-forest)]">
            Nog settings
          </legend>

          <div className="space-y-2">
            <span className="noggin-display block text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
              Grill mode
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "roast", label: "Playful roast" },
                  { value: "gentle", label: "Gentle" },
                ] as const
              ).map((option) => {
                const checked = settings.grillMode === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 transition-colors",
                      checked
                        ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                        : "bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)] hover:bg-[var(--noggin-mint)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="grillMode"
                      value={option.value}
                      checked={checked}
                      onChange={() => {
                        setSettings((prev) => ({
                          ...prev,
                          grillMode: option.value,
                        }));
                        setSaved(false);
                      }}
                      className="h-4 w-4 accent-[var(--noggin-leaf-strong)]"
                    />
                    <span className="noggin-display text-[0.9375rem] font-bold">
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="noggin-display block text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
              Mic mode
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "tap", label: "Tap to talk" },
                  { value: "hold", label: "Hold to talk" },
                ] as const
              ).map((option) => {
                const checked = settings.micMode === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 transition-colors",
                      checked
                        ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                        : "bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)] hover:bg-[var(--noggin-mint)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="micMode"
                      value={option.value}
                      checked={checked}
                      onChange={() => {
                        setSettings((prev) => ({
                          ...prev,
                          micMode: option.value,
                        }));
                        setSaved(false);
                      }}
                      className="h-4 w-4 accent-[var(--noggin-leaf-strong)]"
                    />
                    <span className="noggin-display text-[0.9375rem] font-bold">
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            className="noggin-primary-pill noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center px-6 py-2.5 text-[1rem] font-bold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleLogOut()}
          className="noggin-display inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-5 py-2.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors hover:bg-[var(--noggin-mint)]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
