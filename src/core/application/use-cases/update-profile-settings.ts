import type {
  CurrentUser,
  ProfileRepository,
  ProfileSettings,
} from "../ports";

export interface UpdateProfileSettingsDeps {
  currentUser: CurrentUser;
  profiles: Pick<ProfileRepository, "saveSettings">;
}

export type UpdateProfileSettingsResult =
  | { status: "unauthenticated" }
  | { status: "invalid"; error: string }
  | { status: "ok"; settings: ProfileSettings };

function isValidProfileSettings(value: unknown): value is ProfileSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.grillMode === "roast" || candidate.grillMode === "gentle") &&
    (candidate.micMode === "tap" || candidate.micMode === "hold") &&
    typeof candidate.voiceEnabled === "boolean" &&
    typeof candidate.soundsEnabled === "boolean"
  );
}

export async function updateProfileSettings(
  deps: UpdateProfileSettingsDeps,
  settings: ProfileSettings,
): Promise<UpdateProfileSettingsResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  if (!isValidProfileSettings(settings)) {
    return { status: "invalid", error: "Invalid profile settings." };
  }

  const saved = await deps.profiles.saveSettings(user.id, {
    grillMode: settings.grillMode,
    micMode: settings.micMode,
    voiceEnabled: settings.voiceEnabled,
    soundsEnabled: settings.soundsEnabled,
  });

  return {
    status: "ok",
    settings: saved,
  };
}
