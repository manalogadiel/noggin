"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseCurrentUser } from "@/adapters/supabase/current-user";
import { createServerSupabaseClient } from "@/adapters/supabase/server-client";

export type AuthActionResult =
  | { error: string }
  | { status: "unauthenticated" }
  | void;

const DEFAULT_REDIRECT = "/nogs";
const SIGN_UP_REDIRECT = "/adopt";
const SIGN_OUT_REDIRECT = "/login";
const MIN_AGE_YEARS = 16;

const SIGN_IN_ERROR = "Check your email and password";
const SIGN_UP_ERROR = "Couldn't create the account";
const AGE_GATE_ERROR =
  "You must be at least 16 years old to create an account.";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.*-auth-token(?:\.\d+)?$/;

const signInSchema = z.object({
  email: z.string().trim().max(320).pipe(z.email()),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  email: z.string().trim().max(320).pipe(z.email()),
  password: z.string().min(8).max(1024),
  birth_date: z.string().trim().regex(ISO_DATE_PATTERN),
  display_name: z.string().trim().max(80).optional(),
});

function readFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function sanitizeNextPath(raw: string | undefined): string {
  if (!raw || raw.length === 0) {
    return DEFAULT_REDIRECT;
  }

  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    CONTROL_CHAR_PATTERN.test(raw)
  ) {
    return DEFAULT_REDIRECT;
  }

  try {
    const parsed = new URL(raw, "http://localhost.invalid");
    if (
      parsed.origin !== "http://localhost.invalid" ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//")
    ) {
      return DEFAULT_REDIRECT;
    }
    return raw;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

function parseIsoCalendarDate(
  raw: string,
): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_PATTERN.exec(raw);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function calculateAgeYears(
  birth: { year: number; month: number; day: number },
  now: Date = new Date(),
): number {
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();

  let age = todayYear - birth.year;
  if (
    todayMonth < birth.month ||
    (todayMonth === birth.month && todayDay < birth.day)
  ) {
    age -= 1;
  }

  return age;
}

export async function signInAction(
  formData: FormData,
): Promise<AuthActionResult> {
  if (!(formData instanceof FormData)) {
    return { error: SIGN_IN_ERROR };
  }

  const parsed = signInSchema.safeParse({
    email: readFormString(formData, "email"),
    password: readFormString(formData, "password"),
    next: readFormString(formData, "next"),
  });

  if (!parsed.success) {
    return { error: SIGN_IN_ERROR };
  }

  const supabase = await createServerSupabaseClient();
  let signInResult: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >;
  try {
    signInResult = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch {
    return { error: SIGN_IN_ERROR };
  }

  if (signInResult.error || !signInResult.data?.user) {
    return { error: SIGN_IN_ERROR };
  }

  redirect(sanitizeNextPath(parsed.data.next));
}

export async function signUpAction(
  formData: FormData,
): Promise<AuthActionResult> {
  if (!(formData instanceof FormData)) {
    return { error: SIGN_UP_ERROR };
  }

  const parsed = signUpSchema.safeParse({
    email: readFormString(formData, "email"),
    password: readFormString(formData, "password"),
    birth_date: readFormString(formData, "birth_date"),
    display_name: readFormString(formData, "display_name"),
  });

  if (!parsed.success) {
    return { error: SIGN_UP_ERROR };
  }

  const parsedBirthDate = parseIsoCalendarDate(parsed.data.birth_date);
  if (!parsedBirthDate) {
    return { error: SIGN_UP_ERROR };
  }

  const now = new Date();
  const birthUtc = Date.UTC(
    parsedBirthDate.year,
    parsedBirthDate.month - 1,
    parsedBirthDate.day,
  );
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (birthUtc > todayUtc) {
    return { error: SIGN_UP_ERROR };
  }

  const age = calculateAgeYears(parsedBirthDate, now);
  if (age < MIN_AGE_YEARS) {
    return { error: AGE_GATE_ERROR };
  }

  const metadata: Record<string, string> = {
    birth_date: parsed.data.birth_date,
  };
  if (parsed.data.display_name && parsed.data.display_name.length > 0) {
    metadata.display_name = parsed.data.display_name;
  }

  const supabase = await createServerSupabaseClient();
  let signUpResult: Awaited<ReturnType<typeof supabase.auth.signUp>>;
  try {
    signUpResult = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: metadata,
      },
    });
  } catch {
    return { error: SIGN_UP_ERROR };
  }

  if (signUpResult.error || !signUpResult.data?.user) {
    return { error: SIGN_UP_ERROR };
  }

  redirect(SIGN_UP_REDIRECT);
}

export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createServerSupabaseClient();
  const currentUser = createSupabaseCurrentUser(supabase);
  const user = await currentUser.get();

  if (!user) {
    return { status: "unauthenticated" };
  }

  await supabase.auth.signOut();

  try {
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      if (SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name)) {
        cookieStore.delete(cookie.name);
      }
    }
  } catch {
    // Cookie deletion is best-effort after signOut clears the session.
  }

  redirect(SIGN_OUT_REDIRECT);
}
