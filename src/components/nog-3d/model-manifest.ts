import type { NogStageSlug } from "@/core/application/ports";
import type { NogSceneName } from "./nog-stage";

export type NogAccessoryId = "glasses" | "beanie" | "bow" | "gradcap";

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
  targetHeight: 1.06,
  cameraTargetY: 0.72,
  cameraDistance: 3.1,
  smartTint: true,
  accessoryAnchors: {
    glasses: {
      anchor: [0.004, 0.512, 0.345],
      rotation: [-0.08, 0, 0.18],
      scaleMultiplier: 0.7,
    },
    beanie: {
      anchor: [0, 0.64, -0.02],
      rotation: [-0.06, 0, 0.04],
      scaleMultiplier: 0.72,
    },
    bow: {
      anchor: [-0.21, 0.66, 0.12],
      rotation: [-0.06, -0.3, 0.42],
      scaleMultiplier: 0.76,
    },
    gradcap: {
      anchor: [0, 0.72, -0.02],
      rotation: [-0.05, 0.1, 0.06],
      scaleMultiplier: 0.74,
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

export function resolveSceneGlb(
  scene: NogSceneName,
  stage?: NogStageSlug,
): GlbAssetEntry | null {
  if (scene === "room" && stage && STAGE_GLB_MODELS[stage]) {
    return STAGE_GLB_MODELS[stage] ?? null;
  }
  return SCENE_GLB_MODELS[scene] ?? null;
}
