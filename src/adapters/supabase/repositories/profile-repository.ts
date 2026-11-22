import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PROFILE_SETTINGS,
  type GrillMode,
  type MicMode,
  type ProfileRepository,
  type ProfileSettings,
} from "@/core/application/ports";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

interface ProfileSettingsRow {
  grill_mode: unknown;
  settings: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseGrillMode(raw: unknown): GrillMode {
  return raw === "gentle" ? "gentle" : DEFAULT_PROFILE_SETTINGS.grillMode;
}

function parseMicMode(settings: Record<string, unknown>): MicMode {
  const raw = settings.micMode ?? settings.mic_mode;
  return raw === "hold" ? "hold" : DEFAULT_PROFILE_SETTINGS.micMode;
}

function parseBooleanSetting(
  settings: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
  fallback: boolean,
): boolean {
  const raw = settings[camelKey] ?? settings[snakeKey];
  return typeof raw === "boolean" ? raw : fallback;
}

function mapProfileSettingsRow(row: ProfileSettingsRow): ProfileSettings {
  const json = asRecord(row.settings);
  return {
    grillMode: parseGrillMode(row.grill_mode),
    micMode: parseMicMode(json),
    voiceEnabled: parseBooleanSetting(
      json,
      "voiceEnabled",
      "voice_enabled",
      DEFAULT_PROFILE_SETTINGS.voiceEnabled,
    ),
    soundsEnabled: parseBooleanSetting(
      json,
      "soundsEnabled",
      "sounds_enabled",
      DEFAULT_PROFILE_SETTINGS.soundsEnabled,
    ),
  };
}

export function createProfileRepository(options: {
  session: SupabaseClient;
  userId: string;
}): ProfileRepository {
  const { session, userId } = options;

  return {
    async getSettings(targetUserId: string): Promise<ProfileSettings | null> {
      if (targetUserId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot read profile settings for another user.",
        );
      }

      const { data, error } = await session
        .from("profiles")
        .select("grill_mode, settings")
        .eq("id", targetUserId)
        .maybeSingle<ProfileSettingsRow>();

      if (error) {
        throw mapPostgrestError(error, "profiles.getSettings");
      }

      return data ? mapProfileSettingsRow(data) : null;
    },

    async saveSettings(
      targetUserId: string,
      next: ProfileSettings,
    ): Promise<ProfileSettings> {
      if (targetUserId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot update profile settings for another user.",
        );
      }

      const { data: existing, error: readError } = await session
        .from("profiles")
        .select("settings")
        .eq("id", targetUserId)
        .maybeSingle<{ settings: unknown }>();

      if (readError) {
        throw mapPostgrestError(readError, "profiles.saveSettings");
      }

      const mergedSettings = {
        ...asRecord(existing?.settings),
        micMode: next.micMode,
        voiceEnabled: next.voiceEnabled,
        soundsEnabled: next.soundsEnabled,
      };

      const { data, error } = await session
        .from("profiles")
        .update({
          grill_mode: next.grillMode,
          settings: mergedSettings,
        })
        .eq("id", targetUserId)
        .select("grill_mode, settings")
        .single<ProfileSettingsRow>();

      if (error) {
        throw mapPostgrestError(error, "profiles.saveSettings");
      }

      return mapProfileSettingsRow(data);
    },

    async updateDisplayName(
      targetUserId: string,
      displayName: string,
    ): Promise<string> {
      if (targetUserId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot update display name for another user.",
        );
      }

      const trimmed = displayName.trim();
      const { data, error } = await session
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", targetUserId)
        .select("display_name")
        .single<{ display_name: string | null }>();

      if (error) {
        throw mapPostgrestError(error, "profiles.updateDisplayName");
      }

      return typeof data?.display_name === "string"
        ? data.display_name.trim()
        : trimmed;
    },
  };
}
