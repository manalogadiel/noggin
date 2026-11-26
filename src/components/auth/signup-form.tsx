"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  signUpFormAction,
  type AuthFormState,
} from "@/app/(auth)/actions";

export interface SignupFormProps {
  maxBirthday: string;
}

const INITIAL_STATE: AuthFormState = {};

function computeAgeFromIso(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const now = new Date();
  let age = now.getFullYear() - year;
  const mDiff = now.getMonth() + 1 - month;
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) age -= 1;
  return age;
}

export function SignupForm({ maxBirthday }: SignupFormProps) {
  const [state, formAction, pending] = useActionState(
    signUpFormAction,
    INITIAL_STATE,
  );
  const [displayName, setDisplayName] = useState(state.displayName ?? "");
  const [email, setEmail] = useState(state.email ?? "");
  const [birthDate, setBirthDate] = useState(state.birthDate ?? "");
  const [guardianEmail, setGuardianEmail] = useState(state.guardianEmail ?? "");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const computedAge = computeAgeFromIso(birthDate);
  const isTooYoung = computedAge !== null && computedAge < 6;
  const isUnder13 =
    (computedAge !== null && computedAge >= 6 && computedAge < 13) ||
    state.errorField === "guardian_email";

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const passwordHelpId = useId();
  const birthdayId = useId();
  const birthdayHelpId = useId();
  const guardianEmailId = useId();
  const guardianHelpId = useId();
  const privacyId = useId();
  const errorId = useId();

  const hasError = Boolean(state.error);
  const isBirthdayError = hasError && state.errorField === "birthday";
  const isGuardianError = hasError && state.errorField === "guardian_email";
  const isFormError =
    hasError &&
    state.errorField !== "birthday" &&
    state.errorField !== "guardian_email";

  useEffect(() => {
    if (state.error) {
      alertRef.current?.focus();
    }
  }, [state.error, state.attempt]);

  const birthdayDescribedBy = isBirthdayError
    ? `${birthdayHelpId} ${errorId}`
    : birthdayHelpId;

  const passwordDescribedBy = isFormError
    ? `${passwordHelpId} ${errorId}`
    : passwordHelpId;

  return (
    <form action={formAction} className="mt-1 flex flex-col gap-3">
      <div>
        <label htmlFor={nameId} className="figma-auth-label">
          Your name{" "}
          <span aria-hidden="true" style={{ color: "var(--game-coral)" }}>
            *
          </span>
        </label>
        <input
          id={nameId}
          name="display_name"
          type="text"
          autoComplete="name"
          maxLength={80}
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={isFormError || undefined}
          aria-describedby={isFormError ? errorId : undefined}
          className="figma-auth-input"
        />
      </div>

      <div>
        <label htmlFor={emailId} className="figma-auth-label">
          Email{" "}
          <span aria-hidden="true" style={{ color: "var(--game-coral)" }}>
            *
          </span>
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={isFormError || undefined}
          aria-describedby={isFormError ? errorId : undefined}
          className="figma-auth-input"
        />
      </div>

      <div>
        <label htmlFor={passwordId} className="figma-auth-label">
          Password{" "}
          <span aria-hidden="true" style={{ color: "var(--game-coral)" }}>
            *
          </span>
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={isFormError || undefined}
          aria-describedby={passwordDescribedBy}
          className="figma-auth-input"
        />
        <p id={passwordHelpId} className="mt-1 text-[12px] text-[var(--noggin-ink)]">
          At least 8 characters
        </p>
      </div>

      <div>
        <label htmlFor={birthdayId} className="figma-auth-label">
          Birthday{" "}
          <span aria-hidden="true" style={{ color: "var(--game-coral)" }}>
            *
          </span>
        </label>
        <input
          id={birthdayId}
          name="birth_date"
          type="date"
          autoComplete="bday"
          max={maxBirthday}
          required
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          aria-invalid={isBirthdayError || undefined}
          aria-describedby={birthdayDescribedBy}
          className="figma-auth-input"
        />
        <p id={birthdayHelpId} className="mt-1 text-[12px] text-[var(--noggin-ink)]">
          Ages 13 and up can create a standard account. Learners ages 6–12 need a parent or guardian email and receive a private, ad-free account with restricted social features.
        </p>
        {isTooYoung && (
          <p className="mt-1 rounded-xl bg-[var(--noggin-danger-soft)] px-3 py-2 text-[12px] font-medium text-[var(--noggin-danger)]">
            Noggin is for learners ages 6 and up.
          </p>
        )}
        {isUnder13 && !isTooYoung && (
          <p className="mt-1 rounded-xl bg-[var(--noggin-meter-mid-soft)] px-3 py-2 text-[12px] font-medium text-[var(--noggin-meter-mid-ink)]">
            Under-13 child privacy mode: your profile stays private with no public Arena leaderboards, no adding friends, and no data collected for ads.
          </p>
        )}
      </div>

      {isUnder13 && !isTooYoung && (
        <div>
          <label htmlFor={guardianEmailId} className="figma-auth-label">
            Parent or guardian email{" "}
            <span aria-hidden="true" style={{ color: "var(--game-coral)" }}>
              *
            </span>
          </label>
          <input
            id={guardianEmailId}
            name="guardian_email"
            type="email"
            autoComplete="email"
            required
            value={guardianEmail}
            onChange={(event) => setGuardianEmail(event.target.value)}
            aria-invalid={isGuardianError || undefined}
            aria-describedby={isGuardianError ? `${guardianHelpId} ${errorId}` : guardianHelpId}
            placeholder="parent@example.com"
            className="figma-auth-input"
          />
          <p id={guardianHelpId} className="mt-1 text-[12px] text-[var(--noggin-ink)]">
            Required for learners under 13 (used for parent oversight and account recovery).
          </p>
        </div>
      )}

      <label className="auth-age13-check">
        <input
          id={`${privacyId}-age`}
          name="age_confirmed"
          type="checkbox"
          defaultChecked
        />
        <span>
          I confirm my birthday is accurate (<strong>ages 13+</strong> standard account, or <strong>ages 6–12</strong> with a parent/guardian email).
        </span>
      </label>

      <div className="flex items-start gap-2 pt-0.5">
        <label
          htmlFor={privacyId}
          className="relative -ml-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
        >
          <input
            id={privacyId}
            name="privacy_accepted"
            type="checkbox"
            required
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            className="peer h-6 w-6 cursor-pointer appearance-none rounded-[7px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] transition-colors checked:border-[var(--noggin-leaf-strong)] checked:bg-[var(--noggin-leaf-strong)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf-strong)]"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            className="pointer-events-none absolute h-4 w-4 text-[var(--noggin-white)] opacity-0 transition-opacity peer-checked:opacity-100"
          >
            <path
              d="M3.25 8.5L6.5 11.75L12.75 4.75"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </label>

        <label
          htmlFor={privacyId}
          className="cursor-pointer pt-2 text-[13px] leading-[1.45] text-[var(--noggin-charcoal)]"
        >
          I&apos;ve read the{" "}
          <Link href="/privacy" className="figma-auth-link">
            Privacy notice
          </Link>{" "}
          and agree to Noggin saving my lessons and progress.
        </label>
      </div>

      {state.error ? (
        <div
          ref={alertRef}
          id={errorId}
          role="alert"
          tabIndex={-1}
          className="pill pill--coral justify-center rounded-[14px] px-3.5 py-2.5 text-[0.9375rem]"
        >
          {state.error}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 4 }}>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="pub-cta-pill pub-cta-pill--md w-full max-w-[290px]"
        >
          {pending ? "Hatching your Nog…" : "Hatch my Nog"}
        </button>
      </div>

      <p style={{ margin: "2px 0 0", textAlign: "center", fontSize: 13.5, color: "var(--noggin-charcoal)" }}>
        Already have a Nog?{" "}
        <Link href="/login" className="figma-auth-link">
          Log in
        </Link>
      </p>
    </form>
  );
}
