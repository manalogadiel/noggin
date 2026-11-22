/// <reference types="vite/client" />
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { createServerClient, getUser } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const entries = import.meta.glob<{
  middleware(request: NextRequest): Promise<NextResponse>;
}>("../../src/middleware.ts");
const origin = "https://noggin.example.test";

async function request(path: string) {
  const load = entries["../../src/middleware.ts"];
  if (!load) throw new Error("Missing auth entry point: src/middleware.ts");
  const { middleware } = await load();
  return middleware(new NextRequest(new URL(path, origin)));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon-key");
  getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  createServerClient.mockReset().mockReturnValue({ auth: { getUser } });
});
afterEach(() => vi.unstubAllEnvs());

it.each(["/nogs", "/nogs/pip", "/adopt", "/adopt/networking", "/settings", "/settings/privacy"])(
  "redirects an anonymous request for %s to login with the encoded return path",
  async (path) => {
    const response = await request(path);

    expect([307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toBe(`${origin}/login?next=${encodeURIComponent(path)}`);
    expect(getUser).toHaveBeenCalledOnce();
  },
);

it("refreshes the session on public requests without redirecting to login", async () => {
  const response = await request("/login");

  expect(response.headers.has("location")).toBe(false);
  expect(getUser).toHaveBeenCalledOnce();
});

it("allows authenticated requests and forwards refreshed Supabase cookies", async () => {
  const sessionCookie = "sb-test-auth-token";
  createServerClient.mockImplementation((_url, _key, { cookies }) => ({
    auth: {
      getUser: async () => {
        cookies.setAll([{ name: sessionCookie, value: "refreshed-session", options: { path: "/" } }]);
        return { data: { user: { id: "verified-student" } }, error: null };
      },
    },
  }));

  const response = await request("/nogs");

  expect(response.headers.has("location")).toBe(false);
  expect(response.cookies.get(sessionCookie)?.value).toBe("refreshed-session");
});
