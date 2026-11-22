import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SupabaseConfigError } from "./repositories/errors";

function requireSupabaseEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SupabaseConfigError(
      `Missing required Supabase environment variable: ${name}`,
    );
  }
  return value;
}

function validateSupabaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SupabaseConfigError(
      "Invalid NEXT_PUBLIC_SUPABASE_URL: must be a valid http(s) URL.",
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SupabaseConfigError(
      "Invalid NEXT_PUBLIC_SUPABASE_URL: must use http or https.",
    );
  }
  return rawUrl;
}

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const url = validateSupabaseUrl(
    requireSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL"),
  );
  const anonKey = requireSupabaseEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate response cookies; middleware/actions handle writes.
        }
      },
    },
  });
}
