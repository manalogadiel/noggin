// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/app/(auth)/actions";
import { LoginForm } from "../login-form";
import { SignupForm } from "../signup-form";

const { signInFormAction, signUpFormAction } = vi.hoisted(() => ({
  signInFormAction: vi.fn<
    (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>
  >(),
  signUpFormAction: vi.fn<
    (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>
  >(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signInFormAction,
  signUpFormAction,
}));

beforeEach(() => {
  signInFormAction.mockReset();
  signUpFormAction.mockReset();
});

afterEach(cleanup);

describe("LoginForm", () => {
  it("renders labeled inputs, hidden next path, and no Forgot password link", () => {
    const { container } = render(<LoginForm nextPath="/home" />);

    expect(screen.getByLabelText(/^Email\s*\*?$/)).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText(/^Password\s*\*?$/)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(
      container.querySelector('input[type="hidden"][name="next"]'),
    ).toHaveValue("/home");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.queryByRole("link", { name: /forgot password/i })).toBeNull();
  });

  it("shows busy state while submitting and focuses the error alert on failure", async () => {
    const user = userEvent.setup();
    let resolveAction!: (state: AuthFormState) => void;
    signInFormAction.mockImplementation(
      () =>
        new Promise<AuthFormState>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/^Email\s*\*?$/), "cindy@example.com");
    await user.type(screen.getByLabelText(/^Password\s*\*?$/), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    const busyButton = await screen.findByRole("button", { name: "Logging in…" });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");

    resolveAction({
      error: "Check your email and password",
      errorField: "credentials",
      email: "cindy@example.com",
      attempt: 1,
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Check your email and password");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(/^Email\s*\*?$/)).toHaveValue(
      "cindy@example.com",
    );
    expect(screen.getByLabelText(/^Email\s*\*?$/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/^Password\s*\*?$/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

describe("SignupForm", () => {
  it("renders required fields, helpers, max birthday, and unchecked privacy consent", () => {
    render(<SignupForm maxBirthday="2026-11-21" />);

    expect(screen.getByLabelText(/^Your name\s*\*?$/)).toHaveAttribute(
      "maxlength",
      "80",
    );
    expect(screen.getByLabelText(/^Password\s*\*?$/)).toHaveAttribute(
      "minlength",
      "8",
    );
    expect(screen.getByLabelText(/^Password\s*\*?$/)).toHaveAccessibleDescription(
      "At least 8 characters",
    );
    expect(screen.getByLabelText(/^Birthday\s*\*?$/)).toHaveAttribute(
      "max",
      "2026-11-21",
    );
    expect(screen.getByLabelText(/^Birthday\s*\*?$/)).toHaveAccessibleDescription(
      /ages 13 and up/i,
    );
    const consent = screen.getByRole("checkbox", { name: /Privacy notice/i });
    expect(consent).toBeRequired();
    expect(consent).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Privacy notice" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("toggles the privacy checkbox when its 44 px label wrapper is clicked", async () => {
    const user = userEvent.setup();
    render(<SignupForm maxBirthday="2026-11-21" />);

    const consent = screen.getByRole("checkbox", { name: /Privacy notice/i });
    const wrapperLabel = consent.closest("label");
    expect(wrapperLabel).not.toBeNull();
    expect(wrapperLabel).toHaveAttribute("for", consent.id);
    expect(consent).not.toBeChecked();

    await user.click(wrapperLabel!);
    expect(consent).toBeChecked();
  });

  it("announces the age-gate error on Birthday and shows busy state while submitting", async () => {
    const user = userEvent.setup();
    let resolveAction!: (state: AuthFormState) => void;
    signUpFormAction.mockImplementation(
      () =>
        new Promise<AuthFormState>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<SignupForm maxBirthday="2026-11-21" />);
    await user.type(screen.getByLabelText(/^Your name\s*\*?$/), "Cindy");
    await user.type(screen.getByLabelText(/^Email\s*\*?$/), "cindy@example.com");
    await user.type(screen.getByLabelText(/^Password\s*\*?$/), "secret123");
    await user.type(screen.getByLabelText(/^Birthday\s*\*?$/), "2023-01-01");
    await user.click(screen.getByRole("checkbox", { name: /Privacy notice/i }));
    await user.click(screen.getByRole("button", { name: "Hatch my Nog" }));

    const busyButton = await screen.findByRole("button", {
      name: "Hatching your Nog…",
    });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");

    resolveAction({
      error:
        "Your Nog is still snug in its shell! Noggin is for ages 6 and up. Come back on your 6th birthday.",
      errorField: "birthday",
      email: "cindy@example.com",
      displayName: "Cindy",
      birthDate: "2023-01-01",
      attempt: 1,
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/ages 6 and up/i);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(/^Birthday\s*\*?$/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/^Birthday\s*\*?$/)).toHaveAccessibleDescription(
      /Your Nog is still snug in its shell/i,
    );
  });

  it("reveals the required parent or guardian email field when an under-13 birthday (ages 6-12) is entered", async () => {
    const user = userEvent.setup();
    render(<SignupForm maxBirthday="2026-11-26" />);

    expect(screen.queryByLabelText(/Parent or guardian email/i)).toBeNull();
    const tenYearsAgo = `${new Date().getFullYear() - 10}-01-15`;
    await user.type(screen.getByLabelText(/^Birthday\s*\*?$/), tenYearsAgo);

    const guardianInput = await screen.findByLabelText(/Parent or guardian email/i);
    expect(guardianInput).toBeRequired();
    expect(screen.getByText(/Under-13 child privacy mode/i)).toBeVisible();
  });
});
