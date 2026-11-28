import type { NogStageSlug } from "@/core/application/ports";
import type { NogSceneName } from "./nog-stage";

export type NogAccessoryId = "glasses" | "beanie" | "bow" | "gradcap";

export type NogSpeciesId =
  | "sprout"
  | "clover"
  | "blossom"
  | "mushroom"
  | "bunny"
  | "acorn"
  | "sunflower";

export interface NogSpeciesMeta {
  id: NogSpeciesId;
  label: string;
  portrait: string;
}

export const NOG_SPECIES_LIST: readonly NogSpeciesMeta[] = [
  { id: "sprout", label: "Sprout", portrait: "/game/nog/thinking.png" },
  { id: "clover", label: "Clover", portrait: "/game/nog/nog-clover.png" },
  { id: "blossom", label: "Blossom", portrait: "/game/nog/nog-blossom.png" },
  { id: "mushroom", label: "Shroomy", portrait: "/game/nog/nog-mushroom.png" },
  { id: "bunny", label: "Bunny", portrait: "/game/nog/nog-bunny.png" },
  { id: "acorn", label: "Acorn", portrait: "/game/nog/nog-acorn.png" },
  { id: "sunflower", label: "Sunbeam", portrait: "/game/nog/nog-sunflower.png" },
] as const;

const ALT_SPECIES_IDS: readonly NogSpeciesId[] = [
  "clover",
  "blossom",
  "mushroom",
  "bunny",
  "acorn",
  "sunflower",
] as const;

const THINKING_SPROUT_PINNED_IDS = new Set([
  "0b1b93f9-74ef-4378-9162-ead7e1236b5c",
]);

export function isNogSpeciesId(value: unknown): value is NogSpeciesId {
  return (
    typeof value === "string" &&
    NOG_SPECIES_LIST.some((item) => item.id === value)
  );
}

/** Deterministic variation per Nog ID so every hatched Nog gets its own distinct 3D species. */
export function nogSpeciesForId(nogId?: string | null): NogSpeciesId {
  if (!nogId || THINKING_SPROUT_PINNED_IDS.has(nogId)) {
    return "sprout";
  }
  let hash = 2166136261;
  for (let i = 0; i < nogId.length; i++) {
    hash ^= nogId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ALT_SPECIES_IDS[Math.abs(hash) % ALT_SPECIES_IDS.length] ?? "clover";
}

export function nogPortraitForSpecies(species?: NogSpeciesId | null): string {
  const found = NOG_SPECIES_LIST.find((s) => s.id === species);
  return found?.portrait ?? "/game/nog/thinking.png";
}

export interface AccessoryMountOverride {
  anchor: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scaleMultiplier?: number;
}

export interface GlbAssetEntry {
  url: string;
  targetHeight?: number;
  rotationY?: number;
  yOffset?: number;
  cameraTargetY?: number;
  cameraDistance?: number;
  smartTint?: boolean;
  /** Keep native model origin and apply an explicit uniform scale (used for fitted accessories). */
  rawScale?: number;
  /** Attachment point in normalized character height units. */
  anchor?: readonly [number, number, number];
  /** Euler rotation in radians when attached as an accessory. */
  rotation?: readonly [number, number, number];
  /** Optional per-character attachment overrides when a stage has different proportions. */
  accessoryAnchors?: Partial<Record<NogAccessoryId, AccessoryMountOverride>>;
}

const SPROUT_STAGE_GLB: GlbAssetEntry = {
  url: "/models/nog-sprout.glb",
  targetHeight: 1.32,
  yOffset: -0.02,
  cameraTargetY: 0.67,
  cameraDistance: 2.62,
  smartTint: true,
  accessoryAnchors: {
    glasses: {
      anchor: [0.032, 0.521, 0.224],
      rotation: [-0.08, 0, 0.06],
      scaleMultiplier: 0.58,
    },
    beanie: {
      anchor: [0.03, 0.652, -0.047],
      rotation: [-0.06, 0, 0.03],
      scaleMultiplier: 0.65,
    },
    bow: {
      anchor: [-0.138, 0.652, 0.061],
      rotation: [-0.06, -0.26, 0.42],
      scaleMultiplier: 0.67,
    },
    gradcap: {
      anchor: [0.03, 0.711, -0.047],
      rotation: [-0.05, 0.08, 0.04],
      scaleMultiplier: 0.65,
    },
  },
};

/**
 * Registry of compressed `.glb` models stored under `public/models/`.
 * Scenes with an entry automatically render in interactive 3D with studio lighting;
 * scenes without an entry render cleanly with the studio card view.
 */
export const SCENE_GLB_MODELS: Partial<Record<NogSceneName, GlbAssetEntry>> = {
  room: {
    url: "/models/nog-hatchling.glb",
    targetHeight: 0.78,
    cameraTargetY: 0.68,
    cameraDistance: 3.1,
    smartTint: true,
  },
  egg: {
    url: "/models/nog-egg.glb",
    targetHeight: 1.42,
    cameraTargetY: 0.72,
    cameraDistance: 3.1,
    smartTint: false,
  },
};

export const STAGE_GLB_MODELS: Partial<Record<NogStageSlug, GlbAssetEntry>> = {
  hatchling: SCENE_GLB_MODELS.room,
  sprout: SPROUT_STAGE_GLB,
  scholar: SPROUT_STAGE_GLB,
  genius: SPROUT_STAGE_GLB,
};

export const ACCESSORY_GLB_MODELS: Partial<Record<NogAccessoryId, GlbAssetEntry>> = {
  glasses: {
    url: "/models/acc-glasses.glb",
    smartTint: false,
    rawScale: 0.66,
    anchor: [0.088, 0.652, 0.495],
    rotation: [-0.22, 0.17, 0.22],
  },
  beanie: {
    url: "/models/acc-beanie.glb",
    smartTint: false,
    rawScale: 0.84,
    anchor: [0.025, 0.78, -0.02],
    rotation: [-0.08, 0.12, 0.08],
  },
  bow: {
    url: "/models/acc-bow.glb",
    smartTint: false,
    rawScale: 0.48,
    anchor: [-0.31, 0.80, 0.15],
    rotation: [-0.08, -0.35, 0.44],
  },
  gradcap: {
    url: "/models/acc-gradcap.glb",
    smartTint: false,
    rawScale: 0.82,
    anchor: [0.03, 0.86, -0.02],
    rotation: [-0.06, 0.14, 0.08],
  },
};

export function hasAccessoryGlb(id: string): id is NogAccessoryId {
  return Boolean(ACCESSORY_GLB_MODELS[id as NogAccessoryId]);
}

const EVOLVED_COMMON_FRAME = {
  targetHeight: 1.32,
  yOffset: -0.02,
  cameraTargetY: 0.67,
  cameraDistance: 2.62,
  smartTint: true,
} as const;

export const SPECIES_GLB_MODELS: Record<NogSpeciesId, GlbAssetEntry> = {
  sprout: SPROUT_STAGE_GLB,
  clover: {
    ...EVOLVED_COMMON_FRAME,
    url: "/models/nog-clover.glb",
    targetHeight: 1.18,
    cameraTargetY: 0.60,
    cameraDistance: 2.66,
    accessoryAnchors: {
      glasses: { anchor: [-0.02, 0.375, 0.382], rotation: [-0.08, 0, 0.05], scaleMultiplier: 0.82 },
      beanie: { anchor: [-0.02, 0.555, -0.015], rotation: [-0.06, 0, 0.02], scaleMultiplier: 0.84 },
      bow: { anchor: [-0.245, 0.545, 0.145], rotation: [-0.06, -0.26, 0.42], scaleMultiplier: 0.74 },
      gradcap: { anchor: [-0.02, 0.618, -0.015], rotation: [-0.05, 0.08, 0.03], scaleMultiplier: 0.84 },
    },
  },
  blossom: {
    ...EVOLVED_COMMON_FRAME,
    url: "/models/nog-blossom.glb",
    targetHeight: 1.28,
    cameraTargetY: 0.66,
    cameraDistance: 2.62,
    accessoryAnchors: {
      glasses: { anchor: [0.0, 0.518, 0.228], rotation: [-0.08, 0, 0.0], scaleMultiplier: 0.55 },
      beanie: { anchor: [0.0, 0.665, -0.01], rotation: [-0.06, 0, 0.02], scaleMultiplier: 0.64 },
      bow: { anchor: [-0.155, 0.66, 0.088], rotation: [-0.06, -0.26, 0.42], scaleMultiplier: 0.64 },
      gradcap: { anchor: [0.0, 0.725, -0.01], rotation: [-0.05, 0.08, 0.03], scaleMultiplier: 0.64 },
    },
  },
  mushroom: {
    ...EVOLVED_COMMON_FRAME,
    url: "/models/nog-mushroom.glb",
    targetHeight: 1.32,
    cameraTargetY: 0.67,
    cameraDistance: 2.66,
    accessoryAnchors: {
      glasses: { anchor: [-0.01, 0.472, 0.192], rotation: [-0.08, 0, 0.05], scaleMultiplier: 0.46 },
      beanie: { anchor: [-0.01, 0.635, 0.004], rotation: [-0.06, 0, 0.02], scaleMultiplier: 0.52 },
      bow: { anchor: [-0.21, 0.79, 0.165], rotation: [-0.06, -0.26, 0.42], scaleMultiplier: 0.66 },
      gradcap: { anchor: [-0.01, 0.692, 0.004], rotation: [-0.05, 0.08, 0.03], scaleMultiplier: 0.52 },
    },
  },
  bunny: {
    ...EVOLVED_COMMON_FRAME,
    url: "/models/nog-bunny.glb",
    targetHeight: 1.4,
    cameraTargetY: 0.7,
    cameraDistance: 2.66,
    accessoryAnchors: {
      glasses: { anchor: [0.0, 0.526, 0.198], rotation: [-0.08, 0, 0.02], scaleMultiplier: 0.47 },
      beanie: { anchor: [0.0, 0.65, 0.012], rotation: [-0.06, 0, 0.02], scaleMultiplier: 0.52 },
      bow: { anchor: [-0.125, 0.655, 0.082], rotation: [-0.06, -0.26, 0.42], scaleMultiplier: 0.58 },
      gradcap: { anchor: [0.0, 0.706, 0.012], rotation: [-0.05, 0.08, 0.03], scaleMultiplier: 0.52 },
    },
  },
  acorn: {
    ...EVOLVED_COMMON_FRAME,
    url: "/models/nog-acorn.glb",
    targetHeight: 1.32,
    cameraTargetY: 0.67,
    cameraDistance: 2.64,
    accessoryAnchors: {
      glasses: { anchor: [0.0, 0.478, 0.252], rotation: [-0.08, 0, 0.0], scaleMultiplier: 0.63 },
      beanie: { anchor: [0.0, 0.62, -0.006], rotation: [-0.06, 0, 0.02], scaleMultiplier: 0.72 },
      bow: { anchor: [-0.19, 0.66, 0.12], rotation: [-0.06, -0.26, 0.42], scaleMultiplier: 0.66 },
      gradcap: { anchor: [0.0, 0.68, -0.006], rotation: [-0.05, 0.08, 0.03], scaleMultiplier: 0.72 },
    },
  },
  sunflower: {
    ...EVOLVED_COMMON_FRAME,
    url: "/models/nog-sunflower.glb",
    targetHeight: 1.32,
    cameraTargetY: 0.67,
    cameraDistance: 2.64,
    accessoryAnchors: {
      glasses: { anchor: [0.001, 0.486, 0.218], rotation: [-0.08, 0, 0.05], scaleMultiplier: 0.62 },
      beanie: { anchor: [0.0, 0.642, -0.015], rotation: [-0.06, 0, 0.02], scaleMultiplier: 0.7 },
      bow: { anchor: [-0.185, 0.64, 0.085], rotation: [-0.06, -0.26, 0.42], scaleMultiplier: 0.66 },
      gradcap: { anchor: [0.0, 0.702, -0.015], rotation: [-0.05, 0.08, 0.03], scaleMultiplier: 0.7 },
    },
  },
};

export function resolveSceneGlb(
  scene: NogSceneName,
  stage?: NogStageSlug,
  species?: NogSpeciesId,
): GlbAssetEntry | null {
  if (scene === "room" && stage && stage !== "hatchling") {
    return SPECIES_GLB_MODELS[species ?? "sprout"] ?? SPROUT_STAGE_GLB;
  }
  if (scene === "room" && stage && STAGE_GLB_MODELS[stage]) {
    return STAGE_GLB_MODELS[stage] ?? null;
  }
  return SCENE_GLB_MODELS[scene] ?? null;
}
