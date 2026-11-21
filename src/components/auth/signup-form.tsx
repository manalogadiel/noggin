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

export function SignupForm({ maxBirthday }: SignupFormProps) {
  const [state, formAction, pending] = useActionState(
    signUpFormAction,
    INITIAL_STATE,
  );
  const [displayName, setDisplayName] = useState(state.displayName ?? "");
  const [email, setEmail] = useState(state.email ?? "");
  const [birthDate, setBirthDate] = useState(state.birthDate ?? "");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const passwordHelpId = useId();
  const birthdayId = useId();
  const birthdayHelpId = useId();
  const privacyId = useId();
  const errorId = useId();

  const hasError = Boolean(state.error);
  const isBirthdayError = hasError && state.errorField === "birthday";
  const isFormError = hasError && state.errorField !== "birthday";

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
    <form action={formAction} className="mt-7 flex flex-col gap-4 sm:mt-8 sm:gap-5">
      <div className="flex flex-col gap-2">
        <label
          htmlFor={nameId}
          className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)] sm:text-[1.25rem]"
        >
          Your name{" "}
          <span aria-hidden="true" className="text-[var(--noggin-danger)]">
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
          className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-4 text-[1.125rem] text-[var(--noggin-forest)] transition-colors focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)] lg:h-16 lg:px-5"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={emailId}
          className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)] sm:text-[1.25rem]"
        >
          Email{" "}
          <span aria-hidden="true" className="text-[var(--noggin-danger)]">
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
          className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-4 text-[1.125rem] text-[var(--noggin-forest)] transition-colors focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)] lg:h-16 lg:px-5"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={passwordId}
          className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)] sm:text-[1.25rem]"
        >
          Password{" "}
          <span aria-hidden="true" className="text-[var(--noggin-danger)]">
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
          className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-4 text-[1.125rem] text-[var(--noggin-forest)] transition-colors focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)] lg:h-16 lg:px-5"
        />
        <p id={passwordHelpId} className="text-[0.875rem] text-[var(--noggin-ink)]">
          At least 8 characters
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={birthdayId}
          className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)] sm:text-[1.25rem]"
        >
          Birthday{" "}
          <span aria-hidden="true" className="text-[var(--noggin-danger)]">
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
          className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-4 text-[1.125rem] text-[var(--noggin-forest)] transition-colors focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)] lg:h-16 lg:px-5"
        />
        <p id={birthdayHelpId} className="text-[0.875rem] text-[var(--noggin-ink)]">
          Noggin is for ages 16 and up. If you&apos;re 16–17, a guardian will
          need to say OK.
        </p>
      </div>

      <div className="flex items-start gap-2 pt-1">
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
          className="cursor-pointer pt-2 text-[0.9375rem] leading-[1.45] text-[var(--noggin-forest)]"
        >
          I&apos;ve read the{" "}
          <Link
            href="/privacy"
            className="font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
          >
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
          className="rounded-2xl bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-danger)] focus:outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-danger)]"
        >
          {state.error}
        </div>
      ) : null}

      <div className="mt-2 flex justify-center">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="noggin-primary-pill noggin-display inline-flex h-[60px] min-h-11 w-full max-w-[372px] cursor-pointer items-center justify-center px-8 text-[1.25rem] font-bold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Hatching your Nog…" : "Hatch my Nog"}
        </button>
      </div>

      <p className="mt-1 text-center text-[1rem] text-[var(--noggin-forest)]">
        Already have a Nog?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
