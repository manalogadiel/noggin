import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContainer } from "@/composition/container";

const { createServerSupabaseClient, createServiceSupabaseClient, createSupabaseRepositories } =
  vi.hoisted(() => ({
    createServerSupabaseClient: vi.fn(),
    createServiceSupabaseClient: vi.fn(),
    createSupabaseRepositories: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/adapters/supabase/server-client", () => ({ createServerSupabaseClient }));
vi.mock("@/adapters/supabase/service-client", () => ({ createServiceSupabaseClient }));
vi.mock("@/adapters/supabase/repositories", () => ({ createSupabaseRepositories }));

const userId = "4fb6862d-eec5-4eb4-8dd3-d0058ce2aed6";

type ProfileReply = {
  data: { display_name: string | null } | null;
  error: { message: string } | null;
};

function mockSession(user: { id: string } | null, reply?: ProfileReply) {
  const read = vi.fn().mockResolvedValue(reply);
  const eq = vi.fn().mockReturnValue({ maybeSingle: read, single: read });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const session = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  };

  createServerSupabaseClient.mockResolvedValue(session);
  return { from, eq };
}

function getDisplayName(container: Awaited<ReturnType<typeof createContainer>>) {
  const app = container as typeof container & { getDisplayName(): Promise<string | null> };
  expect(app.getDisplayName, "AppContainer.getDisplayName").toBeTypeOf("function");
  return app.getDisplayName();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  vi.stubEnv("LLM_PROVIDER", "fake");
  vi.stubEnv("LLM_FALLBACK_BASE_URL", undefined);
  vi.stubEnv("LLM_FALLBACK_API_KEY", undefined);
  vi.stubEnv("LLM_FALLBACK_MODEL", undefined);
  createServiceSupabaseClient.mockReturnValue({});
  createSupabaseRepositories.mockReturnValue({
    appConfig: { getFeatures: vi.fn().mockResolvedValue({ speech_mimicry: false }) },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it("reads and trims the signed-in user's profile display name through the session client", async () => {
  const { from, eq } = mockSession(
    { id: userId },
    { data: { display_name: "  Ada Lovelace  " }, error: null },
  );

  expect(await getDisplayName(await createContainer())).toBe("Ada Lovelace");
  expect(from).toHaveBeenCalledWith("profiles");
  expect(eq).toHaveBeenCalledWith("id", userId);
});

it("returns null for a signed-out caller without querying profiles", async () => {
  const { from } = mockSession(null);

  expect(await getDisplayName(await createContainer())).toBeNull();
  expect(from).not.toHaveBeenCalled();
});

const unavailableProfiles: { reason: string; reply: ProfileReply }[] = [
  { reason: "the display name is unset", reply: { data: { display_name: null }, error: null } },
  { reason: "the display name is blank", reply: { data: { display_name: "  " }, error: null } },
  { reason: "the profile is missing", reply: { data: null, error: null } },
  { reason: "the profile query fails", reply: { data: null, error: { message: "Profile unavailable" } } },
];

it.each(unavailableProfiles)("returns null when $reason", async ({ reply }) => {
  mockSession({ id: userId }, reply);

  expect(await getDisplayName(await createContainer())).toBeNull();
});
