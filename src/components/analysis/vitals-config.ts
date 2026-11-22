import type { GrowthStage } from "@/core/domain/training";
import type { VitalsResult } from "@/core/domain/vitals";

export type VitalKey = "happiness" | "clarity" | "vitality";
export type VitalZone = "low" | "mid" | "high";

export interface VitalMeterData {
  key: VitalKey;
  label: "Happiness" | "Clarity" | "Vitality";
  score: number;
  status: string;
  tone: VitalZone;
  explanation: string;
}

const STAGE_LEVEL_BY_NAME: Record<GrowthStage, number> = {
  Hatchling: 1,
  Sprout: 2,
  Scholar: 3,
  Genius: 4,
};

export function stageToLevel(stage: GrowthStage): number {
  return STAGE_LEVEL_BY_NAME[stage] ?? 1;
}

export function normalizeScore(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function zoneForScore(score: number): VitalZone {
  if (score >= 60) {
    return "high";
  }
  if (score >= 30) {
    return "mid";
  }
  return "low";
}

function happinessStatus(score: number): { status: string; tone: VitalZone } {
  if (score >= 60) {
    return { status: "Happy", tone: "high" };
  }
  if (score >= 30) {
    return { status: "Okay", tone: "mid" };
  }
  return { status: "Sad", tone: "low" };
}

function clarityStatus(score: number): { status: string; tone: VitalZone } {
  if (score >= 60) {
    return { status: "Clear", tone: "high" };
  }
  return { status: "Needs Bath", tone: zoneForScore(score) };
}

function vitalityStatus(score: number): { status: string; tone: VitalZone } {
  if (score >= 60) {
    return { status: "Healthy", tone: "high" };
  }
  if (score >= 1) {
    return { status: "Low", tone: zoneForScore(score) };
  }
  return { status: "Fainted", tone: "low" };
}

export function buildVitalMeters(vitals: VitalsResult): VitalMeterData[] {
  const happinessScore = normalizeScore(vitals.happiness);
  const clarityScore = normalizeScore(vitals.clarity);
  const vitalityScore = normalizeScore(vitals.vitality);

  return [
    {
      key: "happiness",
      label: "Happiness",
      score: happinessScore,
      ...happinessStatus(happinessScore),
      explanation: "Based on how many recent days you cared for your Nog.",
    },
    {
      key: "clarity",
      label: "Clarity",
      score: clarityScore,
      ...clarityStatus(clarityScore),
      explanation: "Share of active thought cards your Nog has understood.",
    },
    {
      key: "vitality",
      label: "Vitality",
      score: vitalityScore,
      ...vitalityStatus(vitalityScore),
      explanation: "How well your Nog keeps up with reviews done on time.",
    },
  ];
}
