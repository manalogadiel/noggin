export type NogBodyColorId = "cream" | "lavender" | "pink" | "sky";

export interface NogBodyColorPreset {
  id: NogBodyColorId;
  label: string;
  hex: string | null;
}

export type ParseBodyColorResult =
  | { ok: true; value: string | null }
  | { ok: false };

function toHex(rgb: string): string {
  return `#${rgb}`;
}

export const NOG_BODY_COLORS: readonly NogBodyColorPreset[] = [
  { id: "cream", label: "Cream", hex: null },
  { id: "lavender", label: "Lavender", hex: toHex("d9c8f5") },
  { id: "pink", label: "Pink", hex: toHex("ffc2e6") },
  { id: "sky", label: "Sky", hex: toHex("c4eef5") },
] as const;

const BODY_COLOR_HEX_PATTERN = /^#[0-9a-f]{6}$/;

export function parseBodyColor(value: unknown): ParseBodyColorResult {
  if (value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false };
  }
  const normalized = value.trim().toLowerCase();
  if (!BODY_COLOR_HEX_PATTERN.test(normalized)) {
    return { ok: false };
  }
  return { ok: true, value: normalized };
}
