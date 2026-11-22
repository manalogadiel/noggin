"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type { ProfileSettings } from "@/core/application/ports";

export type SaveSettingsActionResult =
  | { status: "ok" }
  | { status: "error"; error: string };

export async function petNogAction(nogId: string): Promise<void> {
  if (!nogId || typeof nogId !== "string") {
    return;
  }

  try {
    const container = await createContainer();
    const result = await container.petNog({ nogId });
    if (result.status === "ok" && result.deltaApplied > 0) {
      revalidatePath(`/nogs/${nogId}`);
    }
  } catch {
    // Keep petting tactile even when offline or temporarily unavailable.
  }
}

export async function saveProfileSettingsAction(
  settings: ProfileSettings,
): Promise<SaveSettingsActionResult> {
  try {
    const container = await createContainer();
    const result = await container.updateProfileSettings(settings);
    if (result.status === "ok") {
      return { status: "ok" };
    }
    if (result.status === "unauthenticated") {
      return {
        status: "error",
        error: "Please log in again to save your settings.",
      };
    }
    return {
      status: "error",
      error: result.error || "Couldn't save settings. Try again.",
    };
  } catch {
    return {
      status: "error",
      error: "Couldn't save settings. Try again.",
    };
  }
}
