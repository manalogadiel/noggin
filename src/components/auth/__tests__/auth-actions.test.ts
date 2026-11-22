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

import { signUpFormAction } from "@/app/(auth)/actions";

const signUp = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  createServerSupabaseClient.mockResolvedValue({ auth: { signUp } });
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
});
