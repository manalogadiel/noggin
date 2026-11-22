import type { CurrentUser, ProfileRepository } from "../ports";

export type UpdateDisplayNameInput =
  | string
  | {
      displayName?: string;
      name?: string;
    };

export type UpdateDisplayNameResult =
  | { status: "unauthenticated" }
  | { status: "invalid"; error: string }
  | { status: "ok"; displayName: string };

export interface UpdateDisplayNameDeps {
  currentUser: CurrentUser;
  profiles: Pick<ProfileRepository, "updateDisplayName">;
}

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const DISPLAY_NAME_ERROR = "Use 1–40 characters";

function extractRawName(input: unknown): string | null {
  if (typeof input === "string") {
    return input;
  }
  if (typeof input === "object" && input !== null) {
    const candidate =
      (input as { displayName?: unknown; name?: unknown }).displayName ??
      (input as { displayName?: unknown; name?: unknown }).name;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return null;
}

export async function updateDisplayName(
  deps: UpdateDisplayNameDeps,
  input: UpdateDisplayNameInput,
): Promise<UpdateDisplayNameResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const raw = extractRawName(input);
  if (raw === null || CONTROL_CHAR_PATTERN.test(raw)) {
    return { status: "invalid", error: DISPLAY_NAME_ERROR };
  }

  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    return { status: "invalid", error: DISPLAY_NAME_ERROR };
  }

  await deps.profiles.updateDisplayName(user.id, trimmed);

  return {
    status: "ok",
    displayName: trimmed,
  };
}
