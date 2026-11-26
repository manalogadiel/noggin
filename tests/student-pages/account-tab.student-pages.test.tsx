// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileSettings } from "@/core/application/ports";
import type { GetProfileSettingsResult } from "@/core/application/use-cases/get-profile-settings";
import type { UpdateProfileSettingsResult } from "@/core/application/use-cases/update-profile-settings";
import {
  initialProfileSettings,
  learnerEmail,
  learnerId,
  updatedProfileSettings,
  type SaveAccountActionInput,
  type SaveAccountActionResult,
  type UpdateDisplayNameResult,
} from "./fixtures";

const {
  getDisplayName,
  getEmail,
  getProfileSettings,
  updateDisplayName,
  updateProfileSettings,
  revalidatePath,
  signOutAction,
} = vi.hoisted(() => ({
  getDisplayName: vi.fn<() => Promise<string | null>>(),
  getEmail: vi.fn<() => Promise<string | null>>(),
  getProfileSettings: vi.fn<() => Promise<GetProfileSettingsResult>>(),
  updateDisplayName:
    vi.fn<(input: unknown) => Promise<UpdateDisplayNameResult>>(),
  updateProfileSettings:
    vi.fn<(settings: ProfileSettings) => Promise<UpdateProfileSettingsResult>>(),
  revalidatePath: vi.fn(),
  signOutAction: vi.fn(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({
    currentUser: {
      get: async () => ({ id: learnerId, email: learnerEmail }),
    },
    getDisplayName,
    getEmail,
    getProfileSettings,
    updateDisplayName,
    updateProfileSettings,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
  revalidateTag: vi.fn(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction,
}));

type ErrorProps = { error: Error; reset: () => void; retry?: () => void };

const routeBase = "../../src/app/(app)/profile/account";
const pageModules = import.meta.glob<{
  default: () => ReactElement | Promise<ReactElement>;
}>("../../src/app/*/profile/account/page.tsx");
const loadingModules = import.meta.glob<{ default: ComponentType }>(
  "../../src/app/*/profile/account/loading.tsx",
);
const errorModules = import.meta.glob<{ default: ComponentType<ErrorProps> }>(
  "../../src/app/*/profile/account/error.tsx",
);
const actionModules = import.meta.glob<{
  saveAccountAction: (
    input: SaveAccountActionInput,
  ) => Promise<SaveAccountActionResult>;
}>("../../src/app/*/actions/profile-actions.ts");

async function loadAccountPage() {
  const loader = pageModules[`${routeBase}/page.tsx`];
  if (!loader) {
    throw new Error("Missing route: src/app/(app)/profile/account/page.tsx");
  }
  return (await loader()).default;
}

async function loadSaveAccountAction() {
  const loader =
    actionModules["../../src/app/(app)/actions/profile-actions.ts"];
  if (!loader) {
    throw new Error(
      "Missing server action module: src/app/(app)/actions/profile-actions.ts",
    );
  }
  return (await loader()).saveAccountAction;
}

function extractNameArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (typeof arg === "object" && arg !== null) {
    const record = arg as { displayName?: string; name?: string };
    return record.displayName ?? record.name ?? "";
  }
  return "";
}

beforeEach(() => {
  vi.clearAllMocks();
  getDisplayName.mockResolvedValue("Cindy");
  getEmail.mockResolvedValue(learnerEmail);
  getProfileSettings.mockResolvedValue({
    status: "ok",
    settings: initialProfileSettings,
  });
  updateDisplayName.mockImplementation(async (input) => {
    const trimmed = extractNameArg(input).trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      return { status: "invalid", error: "Use 1–40 characters" };
    }
    return { status: "ok", displayName: trimmed };
  });
  updateProfileSettings.mockImplementation(async (settings) => ({
    status: "ok",
    settings,
  }));
});

afterEach(() => {
  cleanup();
});

describe("Account tab (/profile/account) and saveAccountAction", () => {
  it("prefills Display name, shows Email as read-only text (with no password fields or Forgot password link), and prefills the Nog settings controls", async () => {
    const AccountPage = await loadAccountPage();
    render(await AccountPage());

    const nameInput = screen.getByLabelText(/display name/i);
    expect(nameInput).toBeVisible();
    expect(nameInput).toHaveValue("Cindy");
    expect(nameInput).toHaveAttribute("maxLength", "40");

    expect(screen.getByText(learnerEmail)).toBeVisible();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();

    const roastRadio = screen.getByRole("radio", { name: /playful roast/i });
    const gentleRadio = screen.getByRole("radio", { name: /gentle/i });
    const tapRadio = screen.getByRole("radio", { name: /tap to talk/i });
    const holdRadio = screen.getByRole("radio", { name: /hold to talk/i });
    const voiceSwitch = screen.getByRole("switch", { name: /nog voice/i });
    const soundsSwitch = screen.getByRole("switch", { name: /sounds/i });

    expect(roastRadio).toBeChecked();
    expect(gentleRadio).not.toBeChecked();
    expect(tapRadio).toBeChecked();
    expect(holdRadio).not.toBeChecked();
    expect(voiceSwitch).toHaveAttribute("aria-checked", "true");
    expect(soundsSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("saves the edited display name and Nog settings, shows Saving… while pending, revalidates the root layout, and announces Saved!", async () => {
    const user = userEvent.setup();
    let resolveSettings!: (result: UpdateProfileSettingsResult) => void;
    updateProfileSettings.mockReturnValueOnce(
      new Promise<UpdateProfileSettingsResult>((resolve) => {
        resolveSettings = resolve;
      }),
    );

    const AccountPage = await loadAccountPage();
    render(await AccountPage());

    const nameInput = screen.getByLabelText(/display name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Cindy Mortel");

    await user.click(screen.getByRole("radio", { name: /gentle/i }));
    await user.click(screen.getByRole("radio", { name: /hold to talk/i }));
    await user.click(screen.getByRole("switch", { name: /nog voice/i }));
    await user.click(screen.getByRole("switch", { name: /sounds/i }));

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    await act(async () => {
      resolveSettings({
        status: "ok",
        settings: updatedProfileSettings,
      });
    });

    expect(updateDisplayName).toHaveBeenCalledOnce();
    expect(extractNameArg(updateDisplayName.mock.calls[0][0])).toBe(
      "Cindy Mortel",
    );
    expect(updateProfileSettings).toHaveBeenCalledExactlyOnceWith(
      updatedProfileSettings,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");

    const savedBanner = await screen.findByText(/saved!/i);
    expect(savedBanner).toBeVisible();
    expect(
      savedBanner.closest('[aria-live], [role="status"]'),
    ).not.toBeNull();
  });

  it("validates a blank display name with 'Use 1–40 characters' and returns invalid_name from saveAccountAction", async () => {
    const saveAccountAction = await loadSaveAccountAction();
    updateDisplayName.mockResolvedValueOnce({
      status: "invalid",
      error: "Use 1–40 characters",
    });

    await expect(
      saveAccountAction({
        displayName: "   ",
        settings: initialProfileSettings,
      }),
    ).resolves.toMatchObject({ status: "invalid_name" });
    expect(updateProfileSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();

    const user = userEvent.setup();
    updateDisplayName.mockResolvedValueOnce({
      status: "invalid",
      error: "Use 1–40 characters",
    });
    const AccountPage = await loadAccountPage();
    render(await AccountPage());

    const nameInput = screen.getByLabelText(/display name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "   ");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/Use 1[–-]40 characters/i)).toBeVisible();
    expect(screen.queryByText(/saved!/i)).not.toBeInTheDocument();
  });

  it("shows an inline error when saving fails and lets the learner retry", async () => {
    const user = userEvent.setup();
    updateProfileSettings
      .mockResolvedValueOnce({
        status: "invalid",
        error: "Couldn't save account changes. Try again.",
      })
      .mockResolvedValueOnce({
        status: "ok",
        settings: initialProfileSettings,
      });

    const AccountPage = await loadAccountPage();
    render(await AccountPage());

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText(/saved!/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/saved!/i)).toBeVisible();
  });

  it("renders a separate Log out button that triggers signOutAction", async () => {
    const user = userEvent.setup();
    const AccountPage = await loadAccountPage();
    render(await AccountPage());

    const logOutButton = screen.getByRole("button", { name: /log out/i });
    expect(logOutButton).toBeVisible();
    await user.click(logOutButton);

    expect(signOutAction).toHaveBeenCalledOnce();
  });

  it("lets the learner switch companion voice and toggle auto-read replies in Sound & Audio", async () => {
    const user = userEvent.setup();
    const { GameUiProvider } = await import("@/components/game-ui/game-ui-context");
    const AccountPage = await loadAccountPage();
    render(<GameUiProvider>{await AccountPage()}</GameUiProvider>);

    const puckBtn = screen.getByRole("button", { name: /puck/i });
    const ledaBtn = screen.getByRole("button", { name: /leda/i });
    expect(puckBtn).toHaveAttribute("aria-pressed", "true");
    expect(ledaBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(ledaBtn);
    expect(ledaBtn).toHaveAttribute("aria-pressed", "true");
    expect(puckBtn).toHaveAttribute("aria-pressed", "false");

    const autoReadSwitch = screen.getByRole("switch", {
      name: /auto-read replies/i,
    });
    expect(autoReadSwitch).toHaveAttribute("aria-checked", "false");
    await user.click(autoReadSwitch);
    expect(autoReadSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("provides loading and error boundaries for /profile/account", async () => {
    const loadLoading = loadingModules[`${routeBase}/loading.tsx`];
    if (!loadLoading) {
      throw new Error(
        "Missing loading boundary: src/app/(app)/profile/account/loading.tsx",
      );
    }
    const { default: Loading } = await loadLoading();
    const { container } = render(<Loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
    cleanup();

    const loadError = errorModules[`${routeBase}/error.tsx`];
    if (!loadError) {
      throw new Error(
        "Missing error boundary: src/app/(app)/profile/account/error.tsx",
      );
    }
    const { default: ErrorBoundary } = await loadError();
    const reset = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary
        error={new Error("Failed to load account settings")}
        reset={reset}
        retry={reset}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/brain fog/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
