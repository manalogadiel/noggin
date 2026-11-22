import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { test as base, type BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const loopbackHosts = ["127.0.0.1", "localhost", "[::1]"];

function readSupabaseSettings() {
  if (!existsSync(".env.test")) {
    throw new Error("Add local Supabase settings to .env.test to run auth browser tests.");
  }
  const env = parseEnv(readFileSync(".env.test", "utf8"));
  const url = URL.parse(env.API_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");
  const anonKey = env.ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.PUBLISHABLE_KEY;
  const serviceKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SECRET_KEY;
  if (!url || !loopbackHosts.includes(url.hostname) || !anonKey || !serviceKey) {
    throw new Error("Set a loopback Supabase URL, anon key and service role key in .env.test.");
  }
  return { url: url.origin, anonKey, serviceKey };
}

type TestUser = { id: string; displayName: string };
type TestCredentials = { email: string; password: string };
type LocalAuth = {
  appUrl: URL;
  url: string;
  anonKey: string;
  admin: ReturnType<typeof createClient>["auth"]["admin"];
  credentials: TestCredentials;
};
type BrowserCookie = Parameters<BrowserContext["addCookies"]>[0][number];

export const localAuthTest = base.extend<{
  localAuth: LocalAuth;
  loginUser: TestUser & { credentials: TestCredentials };
}>({
  localAuth: async ({ baseURL }, runTest) => {
    const appUrl = URL.parse(baseURL ?? "");
    if (!appUrl || !loopbackHosts.includes(appUrl.hostname)) {
      throw new Error("Auth browser tests require a loopback Playwright base URL.");
    }

    const { url, anonKey, serviceKey } = readSupabaseSettings();
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const credentials = {
      email: `noggin-e2e-${randomUUID()}@example.com`,
      password: `Test!${randomUUID()}`,
    };
    await runTest({ appUrl, url, anonKey, admin: admin.auth.admin, credentials });
  },

  loginUser: async ({ localAuth: { admin, credentials } }, runTest) => {
    const displayName = "Ada Lovelace";
    const { data, error } = await admin.createUser({
      ...credentials,
      email_confirm: true,
      user_metadata: { display_name: displayName, birth_date: "2000-01-01" },
    });
    if (error || !data.user) {
      throw new Error(`Couldn't create the local test user (${error?.code ?? "no user"}).`);
    }

    const { id } = data.user;
    try {
      await runTest({ id, displayName, credentials });
    } finally {
      const deletion = await admin.deleteUser(id);
      if (deletion.error) {
        throw new Error(`Couldn't delete the local test user (${deletion.error.code ?? "unknown error"}).`);
      }
    }
  },
});

export const test = localAuthTest.extend<{ signedInUser: TestUser }>({
  signedInUser: async ({ context, localAuth: { url, anonKey, appUrl }, loginUser }, runTest) => {
    const cookies = new Map<string, BrowserCookie>();
    const session = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => [...cookies.values()],
        setAll(updates) {
          for (const { name, value, options } of updates) {
            if (options.maxAge === 0) {
              cookies.delete(name);
              continue;
            }
            cookies.set(name, {
              name,
              value,
              url: new URL(options.path ?? "/", appUrl).href,
              httpOnly: options.httpOnly,
              secure: options.secure,
            });
          }
        },
      },
    });
    const signIn = await session.auth.signInWithPassword(loginUser.credentials);
    if (signIn.error || !signIn.data.session || cookies.size === 0) {
      throw new Error(`Couldn't establish the local test session (${signIn.error?.code ?? "no session cookies"}).`);
    }
    await context.addCookies([...cookies.values()]);
    await runTest({ id: loginUser.id, displayName: loginUser.displayName });
  },
});
