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
    <form action={formAction} className="mt-2 flex flex-col gap-3.5">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

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
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
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
          autoComplete="current-password"
          required
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className="figma-auth-input"
        />
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

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 6 }}>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="pub-cta-pill pub-cta-pill--md w-full max-w-[290px]"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </div>

      <p style={{ margin: "4px 0 0", textAlign: "center", fontSize: 13.5, color: "var(--noggin-charcoal)" }}>
        New to Noggin?{" "}
        <Link href="/signup" className="figma-auth-link">
          Create an account
        </Link>
      </p>
    </form>
  );
}
