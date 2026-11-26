import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, redirect, createServerSupabaseClient } = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn((destination: string) => {
    const error = new Error(`NEXT_REDIRECT:${destination}`);
    Object.assign(error, { destination });
    throw error;
  }),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/adapters/supabase/server-client", () => ({
  createServerSupabaseClient,
}));

import { signInAction, signUpFormAction } from "@/app/(auth)/actions";

const signUp = vi.fn();
const signInWithPassword = vi.fn();
const from = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  createServerSupabaseClient.mockResolvedValue({
    auth: { signUp, signInWithPassword },
    from,
  });
});

function buildSignupFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  const values: Record<string, string | undefined> = {
    display_name: "Cindy",
    email: "cindy@example.com",
    password: "password123",
    birth_date: "2000-01-01",
    privacy_accepted: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("signUpFormAction", () => {
  it.each([undefined, "", "false", "true", "yes"])(
    "rejects when privacy_accepted is %s before calling Supabase signUp",
    async (consentValue) => {
      const formData = buildSignupFormData({ privacy_accepted: consentValue });

      const result = await signUpFormAction({ attempt: 1 }, formData);

      expect(result).toEqual({
        error: "Please agree to the Privacy notice to continue.",
        errorField: "form",
        email: "cindy@example.com",
        displayName: "Cindy",
        birthDate: "2000-01-01",
        attempt: 2,
      });
      expect(createServerSupabaseClient).not.toHaveBeenCalled();
      expect(signUp).not.toHaveBeenCalled();
    },
  );

  it("proceeds to signUpAction when privacy_accepted is 'on'", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    });
    const formData = buildSignupFormData({ privacy_accepted: "on" });

    await expect(signUpFormAction({}, formData)).rejects.toMatchObject({
      destination: "/adopt",
    });
    expect(signUp).toHaveBeenCalledOnce();
  });

  it("requires a valid guardian_email for ages 6-12 and forwards it when provided", async () => {
    const tenYearsAgo = `${new Date().getUTCFullYear() - 10}-01-15`;
    const missingGuardian = await signUpFormAction(
      {},
      buildSignupFormData({ birth_date: tenYearsAgo }),
    );
    expect(missingGuardian).toMatchObject({
      errorField: "guardian_email",
      birthDate: tenYearsAgo,
    });
    expect(signUp).not.toHaveBeenCalled();

    signUp.mockResolvedValue({
      data: { user: { id: "child-1" }, session: null },
      error: null,
    });
    await expect(
      signUpFormAction(
        {},
        buildSignupFormData({
          birth_date: tenYearsAgo,
          guardian_email: "Parent@Example.com",
        }),
      ),
    ).rejects.toMatchObject({ destination: "/adopt" });
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: expect.objectContaining({
            birth_date: tenYearsAgo,
            guardian_email: "parent@example.com",
          }),
        },
      }),
    );
  });
});

describe("signInAction first-time onboarding redirect", () => {
  it("redirects first-time users with 0 Nogs straight to /adopt when no next path is given", async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "new-user-1" }, session: { access_token: "tok" } },
      error: null,
    });
    const eq = vi.fn().mockResolvedValueOnce({ count: 0, error: null });
    const select = vi.fn().mockReturnValueOnce({ eq });
    from.mockReturnValueOnce({ select });

    const formData = new FormData();
    formData.set("email", "new@example.com");
    formData.set("password", "password123");

    await expect(signInAction(formData)).rejects.toMatchObject({
      destination: "/adopt",
    });
    expect(from).toHaveBeenCalledWith("nogs");
    expect(eq).toHaveBeenCalledWith("owner_id", "new-user-1");
  });

  it("redirects returning users with existing Nogs to /nogs", async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "returning-user" }, session: { access_token: "tok" } },
      error: null,
    });
    const eq = vi.fn().mockResolvedValueOnce({ count: 2, error: null });
    const select = vi.fn().mockReturnValueOnce({ eq });
    from.mockReturnValueOnce({ select });

    const formData = new FormData();
    formData.set("email", "returning@example.com");
    formData.set("password", "password123");

    await expect(signInAction(formData)).rejects.toMatchObject({
      destination: "/nogs",
    });
  });
});
