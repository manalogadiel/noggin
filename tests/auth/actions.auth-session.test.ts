import { beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { birthDate, credentials, eq, exactlyOne, localDb, success } from "../db/helpers";
import { authForm, loadAuthActions } from "./auth-fixtures";

const { cookies, createServerSupabaseClient, createSupabaseRepositories } = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createSupabaseRepositories: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("server-only", () => ({}));
vi.mock("@/adapters/supabase/server-client", () => ({ createServerSupabaseClient }));
vi.mock("@/adapters/supabase/repositories", () => ({ createSupabaseRepositories }));

const sessionCookie = "sb-test-auth-token";
const jar = new Map<string, string>();
const from = vi.fn();
const auth = {
  getUser: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  jar.clear();
  cookies.mockResolvedValue({
    get: (name: string) => jar.has(name) ? { name, value: jar.get(name) } : undefined,
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    delete: (name: string) => jar.delete(name),
  });
  createServerSupabaseClient.mockResolvedValue({ auth, from });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const user = { id: "test-user" };
  auth.signInWithPassword.mockResolvedValue({
    data: { user, session: { user, access_token: "test-access-token" } }, error: null,
  });
});

it.each(["https://evil.example", "//evil.example", "javascript:alert(1)"])(
  "redirects a successful sign-in with next=%s to /nogs",
  async (next) => {
    const { signInAction } = await loadAuthActions();

    await expect(signInAction(authForm({ next }))).rejects.toMatchObject({ destination: "/nogs" });
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
  },
);

it("keeps a valid same-origin return path after sign-in", async () => {
  const { signInAction } = await loadAuthActions();
  const next = "/settings?tab=privacy";

  await expect(signInAction(authForm({ next }))).rejects.toMatchObject({ destination: next });
});

it("uses the same generic message for a wrong password and an unknown email", async () => {
  const { signInAction } = await loadAuthActions();
  auth.signInWithPassword
    .mockResolvedValueOnce({ data: {}, error: { code: "invalid_credentials", message: "Wrong password" } })
    .mockResolvedValueOnce({ data: {}, error: { code: "user_not_found", message: "No such email" } });

  const wrongPassword = await signInAction(authForm());
  const unknownEmail = await signInAction(authForm({ email: "unknown@example.test" }));

  expect(wrongPassword).toMatchObject({ error: "Check your email and password" });
  expect(unknownEmail).toEqual(wrongPassword);
  expect(auth.signInWithPassword).toHaveBeenCalledTimes(2);
});

it("rejects malformed sign-in input before calling Supabase", async () => {
  const { signInAction } = await loadAuthActions();

  await expect(signInAction(authForm({ email: "invalid-email" }))).resolves.toMatchObject({
    error: "Check your email and password",
  });
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

it("uses a generic sign-up message when Supabase says the email already exists", async () => {
  const { signUpAction } = await loadAuthActions();
  auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: {
    code: "user_already_exists", message: "This email already exists",
  } });

  await expect(signUpAction(authForm({ birth_date: birthDate(24), display_name: "Pip" })))
    .resolves.toMatchObject({ error: "Couldn't create the account" });
  expect(auth.signUp).toHaveBeenCalledOnce();
});

it("returns unauthenticated when sign-out is called directly without a verified user", async () => {
  const { signOutAction } = await loadAuthActions();
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: "stale-user" } } }, error: null });

  await expect(signOutAction()).resolves.toMatchObject({ status: "unauthenticated" });
  expect(auth.getUser).toHaveBeenCalled();
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(createSupabaseRepositories).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it("signs out a verified user and clears the session cookie", async () => {
  const { signOutAction } = await loadAuthActions();
  jar.set(sessionCookie, "test-session");
  jar.set("theme", "light");
  auth.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  auth.signOut.mockImplementation(async () => {
    jar.delete(sessionCookie);
    return { error: null };
  });

  await signOutAction().catch((error: unknown) => {
    expect(error).toMatchObject({ destination: expect.any(String) });
  });

  expect(auth.getUser).toHaveBeenCalledBefore(auth.signOut);
  expect(auth.signOut).toHaveBeenCalledOnce();
  expect(jar.has(sessionCookie)).toBe(false);
  expect(jar.get("theme")).toBe("light");
});

function useLocalSignUp() {
  const db = localDb();
  type User = { id: string };
  type Session = { access_token: string; user: User };
  // Forward the SDK's sign-up input to local GoTrue and let its profile trigger enforce the gate.
  auth.signUp.mockImplementation(async ({ email, password, options }) => {
    const reply = await db.anon.request<User | Session>("/auth/v1/signup", "POST", {
      email, password, data: options?.data,
    });
    if (!reply.ok) return { data: { user: null, session: null }, error: { code: reply.code } };

    const session = "access_token" in reply.data ? reply.data : null;
    const user = "user" in reply.data ? reply.data.user : reply.data;
    onTestFinished(async () => {
      success(await db.admin.request(`/auth/v1/admin/users/${user.id}`, "DELETE"), "Remove sign-up test user");
    });
    if (session) jar.set(sessionCookie, "signed-in");
    return { data: { user, session }, error: null };
  });
  return db;
}

it.each([15, 16, 17])("shows a clear age message for age %i and leaves no session or account", async (age) => {
  const { signUpAction } = await loadAuthActions();
  const db = useLocalSignUp();
  const account = credentials();

  const result = await signUpAction(authForm({ ...account, birth_date: birthDate(age), display_name: "Pip" }));

  expect(result?.error).toMatch(/\b18\b/);
  expect(result?.error).toMatch(/age|years|older|under|minimum|at least/i);
  expect(auth.signUp).not.toHaveBeenCalled();
  expect(jar.has(sessionCookie)).toBe(false);
  // A local admin can create an eligible user with the same email only if it is unused.
  await db.createUser(account);
}, 25_000);

it("accepts age 18 and saves the display name without guardian consent", async () => {
  const { signUpAction } = await loadAuthActions();
  const db = useLocalSignUp();
  const date = birthDate(18);

  await expect(signUpAction(authForm({ ...credentials(), birth_date: date, display_name: "Pip" })))
    .rejects.toMatchObject({ destination: "/adopt" });

  expect(auth.signUp).toHaveBeenCalledOnce();
  const { data: { user } } = await auth.signUp.mock.results[0].value;
  expect(Boolean(user?.id)).toBe(true);
  const profile = exactlyOne(await db.admin.rows<{
    birth_date: string;
    display_name: string;
    guardian_consent_status: string;
    guardian_consent_at: string | null;
  }>("profiles", { id: eq(user.id) }), "Read age-gated profile");
  expect(profile).toMatchObject({
    birth_date: date, display_name: "Pip", guardian_consent_status: "not_required", guardian_consent_at: null,
  });
}, 25_000);
