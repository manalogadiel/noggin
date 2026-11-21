// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changedSettings,
  savedSettings,
  type ProfileSettings,
  type SaveProfileSettings,
} from "./fixtures";

const sheetPath = "../../src/components/settings/settings-sheet.tsx";
const sheetModules = import.meta.glob<{
  SettingsSheet: ComponentType<{
    initialSettings: ProfileSettings;
    onSave: SaveProfileSettings;
  }>;
}>("../../src/components/settings/settings-sheet.tsx");

afterEach(cleanup);

async function openSettings(onSave = vi.fn<SaveProfileSettings>()) {
  const load = sheetModules[sheetPath];
  if (!load) throw new Error("Missing component: src/components/settings/settings-sheet.tsx");
  const { SettingsSheet } = await load();
  const user = userEvent.setup();
  render(<SettingsSheet initialSettings={savedSettings} onSave={onSave} />);

  const trigger = screen.getByRole("button", { name: /settings/i });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: /settings/i });
  return { dialog, user, onSave };
}

function controls(dialog: HTMLElement) {
  const sheet = within(dialog);
  return {
    roast: sheet.getByRole("radio", { name: "Roast" }),
    gentle: sheet.getByRole("radio", { name: "Gentle" }),
    tap: sheet.getByRole("radio", { name: "Tap" }),
    hold: sheet.getByRole("radio", { name: "Hold" }),
    voice: sheet.getByLabelText(/^voice$/i),
    sounds: sheet.getByLabelText(/^sounds$/i),
    save: sheet.getByRole("button", { name: "Save" }),
  };
}

describe("Nog Room settings sheet", () => {
  it("opens with all four preferences from the saved profile", async () => {
    const { dialog, onSave } = await openSettings();
    const { roast, gentle, tap, hold, voice, sounds } = controls(dialog);

    expect(gentle).toBeChecked();
    expect(roast).not.toBeChecked();
    expect(hold).toBeChecked();
    expect(tap).not.toBeChecked();
    expect(voice).not.toBeChecked();
    expect(sounds).toBeChecked();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves all four edited preferences and announces success", async () => {
    const saveSettings = vi.fn<SaveProfileSettings>().mockResolvedValue({ status: "ok" });
    const { dialog, user } = await openSettings(saveSettings);
    const { roast, tap, voice, sounds, save } = controls(dialog);

    await user.click(roast);
    await user.click(tap);
    await user.click(voice);
    await user.click(sounds);
    expect(roast).toBeChecked();
    expect(tap).toBeChecked();
    expect(voice).toBeChecked();
    expect(sounds).not.toBeChecked();
    expect(saveSettings).not.toHaveBeenCalled();

    await user.click(save);

    expect(saveSettings).toHaveBeenCalledExactlyOnceWith(changedSettings);
    const confirmation = await screen.findByText(/^saved$/i);
    expect(confirmation).toBeVisible();
    expect(confirmation.closest('[aria-live="polite"], [role="status"]')).not.toBeNull();
  });

  it("shows a save failure inside the sheet and lets the learner retry the same draft", async () => {
    const error = "Couldn't save settings. Try again.";
    const saveSettings = vi.fn<SaveProfileSettings>()
      .mockResolvedValueOnce({ status: "error", error })
      .mockResolvedValueOnce({ status: "ok" });
    const { dialog, user } = await openSettings(saveSettings);
    const { roast, voice, save } = controls(dialog);
    const draft = { ...savedSettings, grillMode: "roast", voiceEnabled: true };

    await user.click(roast);
    await user.click(voice);
    await user.click(save);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(error);
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
    expect(roast).toBeChecked();
    expect(voice).toBeChecked();

    await user.click(save);

    expect(saveSettings.mock.calls).toEqual([[draft], [draft]]);
    expect(await screen.findByText(/^saved$/i)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
