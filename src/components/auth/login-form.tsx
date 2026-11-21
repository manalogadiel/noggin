"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  signInFormAction,
  type AuthFormState,
} from "@/app/(auth)/actions";

export interface LoginFormProps {
  nextPath?: string;
}

const INITIAL_STATE: AuthFormState = {};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    signInFormAction,
    INITIAL_STATE,
  );
  const [email, setEmail] = useState(state.email ?? "");
  const alertRef = useRef<HTMLDivElement>(null);

  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const hasError = Boolean(state.error);

  useEffect(() => {
    if (state.error) {
      alertRef.current?.focus();
    }
  }, [state.error, state.attempt]);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5 sm:mt-9">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

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
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-title)] bg-[var(--noggin-white)] px-4 text-[1.125rem] text-[var(--noggin-forest)] transition-colors focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)] lg:h-16 lg:px-5"
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
          autoComplete="current-password"
          required
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-title)] bg-[var(--noggin-white)] px-4 text-[1.125rem] text-[var(--noggin-forest)] transition-colors focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)] lg:h-16 lg:px-5"
        />
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
          {pending ? "Logging in…" : "Log in"}
        </button>
      </div>

      <p className="mt-1 text-center text-[1rem] text-[var(--noggin-forest)]">
        New to Noggin?{" "}
        <Link
          href="/signup"
          className="inline-flex min-h-11 items-center font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
