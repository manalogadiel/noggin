export interface ProfileSettings {
  grillMode: "roast" | "gentle";
  micMode: "tap" | "hold";
  voiceEnabled: boolean;
  soundsEnabled: boolean;
}

export type SaveProfileSettings = (
  settings: ProfileSettings,
) => Promise<{ status: "ok" } | { status: "error"; error: string }>;

export const savedSettings: ProfileSettings = {
  grillMode: "gentle",
  micMode: "hold",
  voiceEnabled: false,
  soundsEnabled: true,
};

export const changedSettings: ProfileSettings = {
  grillMode: "roast",
  micMode: "tap",
  voiceEnabled: true,
  soundsEnabled: false,
};
