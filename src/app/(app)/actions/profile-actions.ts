"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type { ProfileSettings } from "@/core/application/ports";

export interface SaveAccountActionInput {
  displayName: string;
  settings: ProfileSettings;
}

export type SaveAccountActionResult =
  | { status: "ok" }
  | { status: "invalid_name"; error: string }
  | { status: "error"; error: string };

export async function saveAccountAction(
  input: SaveAccountActionInput,
): Promise<SaveAccountActionResult> {
  try {
    const container = await createContainer();
    const nameResult = await container.updateDisplayName(input.displayName);

    if (nameResult.status === "invalid") {
      return {
        status: "invalid_name",
        error: nameResult.error || "Use 1–40 characters",
      };
    }

    if (nameResult.status === "unauthenticated") {
      return {
        status: "error",
        error: "Please log in to save changes.",
      };
    }

    const settingsResult = await container.updateProfileSettings(
      input.settings,
    );

    if (settingsResult.status !== "ok") {
      return {
        status: "error",
        error:
          settingsResult.status === "invalid"
            ? settingsResult.error
            : "Couldn't save account changes. Try again.",
      };
    }

    revalidatePath("/", "layout");
    return { status: "ok" };
  } catch {
    return {
      status: "error",
      error: "Couldn't save account changes. Try again.",
    };
  }
}
