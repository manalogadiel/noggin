import {
  DEFAULT_PROFILE_SETTINGS,
  type CurrentUser,
  type ProfileRepository,
  type ProfileSettings,
} from "../ports";

export interface GetProfileSettingsDeps {
  currentUser: CurrentUser;
  profiles: Pick<ProfileRepository, "getSettings">;
}

export type GetProfileSettingsResult =
  | { status: "unauthenticated" }
  | { status: "ok"; settings: ProfileSettings };

export function normalizeProfileSettings(
  input: Partial<ProfileSettings> | null | undefined,
): ProfileSettings {
  return {
    grillMode:
      input?.grillMode === "gentle" || input?.grillMode === "roast"
        ? input.grillMode
        : DEFAULT_PROFILE_SETTINGS.grillMode,
    micMode:
      input?.micMode === "hold" || input?.micMode === "tap"
        ? input.micMode
        : DEFAULT_PROFILE_SETTINGS.micMode,
    voiceEnabled:
      typeof input?.voiceEnabled === "boolean"
        ? input.voiceEnabled
        : DEFAULT_PROFILE_SETTINGS.voiceEnabled,
    soundsEnabled:
      typeof input?.soundsEnabled === "boolean"
        ? input.soundsEnabled
        : DEFAULT_PROFILE_SETTINGS.soundsEnabled,
  };
}

export async function getProfileSettings(
  deps: GetProfileSettingsDeps,
): Promise<GetProfileSettingsResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const stored = await deps.profiles.getSettings(user.id);
  return {
    status: "ok",
    settings: normalizeProfileSettings(stored),
  };
}
