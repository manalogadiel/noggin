import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

export function createServiceSupabaseClient(): SupabaseClient {
  const url = validateSupabaseUrl(
    requireSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL"),
  );
  const serviceRoleKey = requireSupabaseEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
