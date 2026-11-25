import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEV_USER_BIRTH_DATE = "2000-01-01";
const DEV_USER_DISPLAY_NAME = "Dev Tester";
const LOCAL_SUPABASE_HOSTS = new Set(["127.0.0.1", "localhost"]);
const USERS_PER_PAGE = 200;

function loadEnvLocal(cwd: string): void {
  const envPath = join(cwd, ".env.local");
  if (!existsSync(envPath)) {
    return;
  }
  const parsed = parseEnv(readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}

function readRequiredEnv(name: string, trimValue = true): string {
  const raw = process.env[name];
  const checked = raw?.trim();
  if (!raw || !checked) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return trimValue ? checked : raw;
}

function assertSafeTarget(rawUrl: string, cwd: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use http or https.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (LOCAL_SUPABASE_HOSTS.has(hostname)) {
    return rawUrl;
  }

  const refPath = join(cwd, "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) {
    throw new Error(
      "Refusing to run: supabase/.temp/project-ref is missing for non-local Supabase URL.",
    );
  }

  const linkedRef = readFileSync(refPath, "utf8").trim().toLowerCase();
  if (!linkedRef || hostname !== `${linkedRef}.supabase.co`) {
    throw new Error(
      "Refusing to run: NEXT_PUBLIC_SUPABASE_URL does not match the linked Supabase project.",
    );
  }

  return rawUrl;
}

async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });
    if (error) {
      throw new Error("Failed to list existing users.");
    }

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === target);
    if (match) {
      return { id: match.id };
    }

    if (!data?.nextPage || users.length < USERS_PER_PAGE) {
      return null;
    }
    page = data.nextPage;
  }
}

export async function provisionDevUser(cwd: string = process.cwd()): Promise<void> {
  loadEnvLocal(cwd);

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("Refusing to run dev-user in production or Vercel.");
  }

  const supabaseUrl = assertSafeTarget(
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    cwd,
  );
  const serviceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = readRequiredEnv("DEV_LOGIN_EMAIL");
  const password = readRequiredEnv("DEV_LOGIN_PASSWORD", false);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const userAttributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      birth_date: DEV_USER_BIRTH_DATE,
      display_name: DEV_USER_DISPLAY_NAME,
    },
  };

  const existing = await findUserByEmail(supabase, email);
  let userId: string;

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      userAttributes,
    );
    if (error || !data?.user?.id) {
      throw new Error("Failed to update dev user.");
    }
    userId = data.user.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser(userAttributes);
    if (error || !data?.user?.id) {
      throw new Error("Failed to create dev user.");
    }
    userId = data.user.id;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      birth_date: DEV_USER_BIRTH_DATE,
      guardian_consent_status: "not_required",
      plan_code: "plus",
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error("Failed to update dev user profile.");
  }

  console.log(`${email} ready`);
}

function isDirectEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }
  const current = resolve(fileURLToPath(import.meta.url));
  const target = resolve(invoked);
  return process.platform === "win32"
    ? current.toLowerCase() === target.toLowerCase()
    : current === target;
}

if (isDirectEntryPoint()) {
  void provisionDevUser().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Failed to provision dev user.";
    console.error(message);
    process.exitCode = 1;
  });
}
