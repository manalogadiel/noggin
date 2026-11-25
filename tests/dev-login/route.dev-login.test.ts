/// <reference types="vite/client" />
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { cookieStore, createClient, createServerClient, signInWithPassword } = vi.hoisted(() => ({
  cookieStore: { getAll: vi.fn(() => []), set: vi.fn() },
  createClient: vi.fn(),
  createServerClient: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const routePath = "../../src/app/dev/login/route.ts";
const routes = import.meta.glob<{
  GET(request: NextRequest): Promise<NextResponse>;
}>("../../src/app/dev/login/route.ts");
const origin = "http://localhost:3000";
const email = "dev@example.test";
const password = "fixture-dev-login-password";
const anonKey = "fixture-anon-key";
const serviceKey = "fixture-service-role-key";
const supabaseUrl = "https://staging-project.supabase.co";
const cookie = {
  name: "sb-fixture-auth-token",
  value: "fixture-session",
  options: { path: "/", httpOnly: true },
};

async function request(url = new URL("/dev/login", origin)) {
  const load = routes[routePath];
  if (!load) throw new Error("Missing auto-login route: src/app/dev/login/route.ts");
  const { GET } = await load();
  return GET(new NextRequest(url, { headers: { host: url.host } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEV_AUTO_LOGIN", "1");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("DEV_LOGIN_EMAIL", email);
  vi.stubEnv("DEV_LOGIN_PASSWORD", password);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
  createServerClient.mockImplementation((_url, _key, { cookies }) => ({
    auth: {
      async signInWithPassword(credentials: { email: string; password: string }) {
        signInWithPassword(credentials);
        cookies.setAll([cookie], {});
        return { data: { user: { id: "dev-user" }, session: {} }, error: null };
      },
    },
  }));
});

afterEach(() => vi.unstubAllEnvs());

it.each([
  { name: "production", key: "NODE_ENV", value: "production" },
  { name: "test mode", key: "NODE_ENV", value: "test" },
  { name: "flag off", key: "DEV_AUTO_LOGIN", value: "0" },
  { name: "flag missing", key: "DEV_AUTO_LOGIN", value: undefined },
  { name: "Vercel", key: "VERCEL", value: "1" },
  { name: "missing password", key: "DEV_LOGIN_PASSWORD", value: undefined },
  { name: "missing email", key: "DEV_LOGIN_EMAIL", value: undefined },
])("returns an empty 404 without signing in with $name", async ({ key, value }) => {
  vi.stubEnv(key, value);
  const url = new URL("/dev/login?email=query@example.test&password=query-password", origin);
  const response = await request(url);

  expect(response.status).toBe(404);
  expect(await response.text()).toBe("");
  expect(signInWithPassword).not.toHaveBeenCalled();
  expect(createClient).not.toHaveBeenCalled();
  expect(response.headers.has("set-cookie")).toBe(false);
});

it.each(["192.168.1.5", "noggin-six.vercel.app", "localhost.evil.com", "127.0.0.2"])(
  "returns an empty 404 without signing in on %s",
  async (host) => {
    const response = await request(new URL("/dev/login", `http://${host}:3000`));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  },
);

it.each(["localhost", "127.0.0.1", "[::1]"])(
  "signs in with the configured credentials and writes session cookies on %s",
  async (host) => {
    const url = new URL("/dev/login?email=query@example.test&password=query-password", `http://${host}:3000`);
    const response = await request(url);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toBe(`${url.origin}/nogs`);
    expect(createServerClient).toHaveBeenCalledWith(supabaseUrl, anonKey, expect.any(Object));
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email, password });
    if (response.headers.has("set-cookie")) {
      expect(response.headers.get("set-cookie")).toContain(`${cookie.name}=${cookie.value}`);
    } else {
      // Next merges writes to the route handler's cookie store into the response.
      expect(cookieStore.set).toHaveBeenCalledWith(cookie.name, cookie.value, cookie.options);
    }
  },
);

it.each([
  "//evil.com",
  "/\\evil.com",
  "https://evil.com",
  "/%2F%2Fevil.com",
  "javascript:alert(1)",
  "/nogs\\abc",
  "/nogs\u0000abc",
  "/nogs%09abc",
])("falls back to /nogs for an unsafe next value %j", async (next) => {
  const url = new URL("/dev/login", origin);
  url.searchParams.set("next", next);

  expect((await request(url)).headers.get("location")).toBe(`${origin}/nogs`);
});

it.each(["/nogs/abc/ask", "/nogs/abc/feed?topic=one"])(
  "preserves a same-origin next path %s",
  async (next) => {
    const url = new URL("/dev/login", origin);
    url.searchParams.set("next", next);

    expect((await request(url)).headers.get("location")).toBe(`${origin}${next}`);
  },
);
