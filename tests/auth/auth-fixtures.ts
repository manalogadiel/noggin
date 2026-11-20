/// <reference types="vite/client" />
import { vi } from "vitest";

type AuthResult = { error?: string; status?: string } | void;
type AuthActions = {
  signInAction(form: FormData): Promise<AuthResult>;
  signUpAction(form: FormData): Promise<AuthResult>;
  signOutAction(): Promise<AuthResult>;
};

const actions = import.meta.glob<AuthActions>("../../src/app/(auth)/actions.ts");

export async function loadAuthActions(): Promise<AuthActions> {
  const load = actions["../../src/app/(auth)/actions.ts"];
  if (!load) throw new Error("Missing auth entry point: src/app/(auth)/actions.ts");
  return load();
}

export function authForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    email: "learner@example.test",
    password: "test-password-123!",
    ...fields,
  })) {
    form.set(key, value);
  }
  return form;
}

class ActionRedirect extends Error {
  constructor(readonly destination: string) {
    super(`Redirect to ${destination}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect(destination: string): never {
    throw new ActionRedirect(destination);
  },
}));
