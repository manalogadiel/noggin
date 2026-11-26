import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";

const { createServerClient, getUser } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const origin = "http://localhost:3000";
const protectedPath = "/nogs/pip/feed?topic=networking";
const signedOut = { data: { user: null }, error: null };

async function destination(path: string, base = origin) {
  const url = new URL(path, base);
  const response = await middleware(new NextRequest(url, { headers: { host: url.host } }));
  const location = response.headers.get("location");
  return location === null ? null : new URL(location);
}

async function expectAutoLogin(path: string, next: string, base = origin) {
  const location = await destination(path, base);
  expect(location?.origin).toBe(base);
  expect(location?.pathname).toBe("/dev/login");
  expect(Array.from(location?.searchParams ?? [])).toEqual([["next", next]]);
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEV_AUTO_LOGIN", "1");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("DEV_LOGIN_EMAIL", "dev@example.test");
  vi.stubEnv("DEV_LOGIN_PASSWORD", "fixture-dev-login-password");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging-project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon-key");
  getUser.mockReset().mockResolvedValue(signedOut);
  createServerClient.mockReset().mockReturnValue({ auth: { getUser } });
});

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["/", "/nogs"],
  ["/home", "/home"],
  [protectedPath, protectedPath],
  ["/adopt/networking", "/adopt/networking"],
  ["/settings/privacy", "/settings/privacy"],
])("sends a signed-out local request for %s through auto-login", expectAutoLogin);

it.each([
  { name: "production", key: "NODE_ENV", value: "production", enabled: "development" },
  { name: "flag off", key: "DEV_AUTO_LOGIN", value: "0", enabled: "1" },
  { name: "Vercel", key: "VERCEL", value: "1", enabled: undefined },
  { name: "missing email", key: "DEV_LOGIN_EMAIL", value: undefined, enabled: "dev@example.test" },
  { name: "missing password", key: "DEV_LOGIN_PASSWORD", value: undefined, enabled: "fixture-dev-login-password" },
])("preserves the normal signed-out flow with $name", async ({ key, value, enabled }) => {
  vi.stubEnv(key, value);

  expect(await destination("/")).toBeNull();
  const location = await destination(protectedPath);
  expect(location?.pathname).toBe("/login");
  expect(location?.searchParams.get("next")).toBe(protectedPath);

  vi.stubEnv(key, enabled);
  await expectAutoLogin(protectedPath, protectedPath);
});

it.each([
  ["192.168.1.5", "127.0.0.1"],
  ["127.0.0.2", "[::1]"],
])("keeps the normal login on %s and preserves the origin on %s", async (denied, allowed) => {
  const location = await destination(protectedPath, `http://${denied}:3000`);
  expect(location?.pathname).toBe("/login");
  await expectAutoLogin(protectedPath, protectedPath, `http://${allowed}:3000`);
});

it("does not redirect the auto-login endpoint or other public paths", async () => {
  expect(await destination("/dev/login?next=%2Fnogs")).toBeNull();
  expect(await destination("/nogsuch")).toBeNull();
  await expectAutoLogin("/", "/nogs");
});

it("redirects only after checking that the visitor is signed out", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "dev-user" } }, error: null });

  expect(await destination("/")).toBeNull();
  expect(await destination(protectedPath)).toBeNull();

  getUser.mockResolvedValue(signedOut);
  await expectAutoLogin(protectedPath, protectedPath);
});
