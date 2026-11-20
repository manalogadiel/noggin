export type GrowthStage = "Hatchling" | "Sprout" | "Scholar" | "Genius";

export interface QuestionAttempt {
  questionId: string;
  attemptedAt: Date | string;
  correct: boolean;
}

export interface GrowthStageThresholds {
  sproutMastered?: number;
  scholarMastered?: number;
  geniusMastered?: number;
  geniusTopicsCount?: number;
  geniusTopicMasteryRatio?: number;
}

export const DEFAULT_GROWTH_THRESHOLDS: Required<GrowthStageThresholds> = {
  sproutMastered: 5,
  scholarMastered: 15,
  geniusMastered: 30,
  geniusTopicsCount: 3,
  geniusTopicMasteryRatio: 0.8,
};

function toTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function trainingMeter(attempts: ReadonlyArray<QuestionAttempt>): number {
  const latestByQuestion = new Map<
    string,
    { timestamp: number; correct: boolean }
  >();

  for (const attempt of attempts) {
    const timestamp = toTimestamp(attempt.attemptedAt);
    const existing = latestByQuestion.get(attempt.questionId);
    if (!existing || timestamp >= existing.timestamp) {
      latestByQuestion.set(attempt.questionId, {
        timestamp,
        correct: attempt.correct,
      });
    }
  }

  let mastered = 0;
  for (const entry of latestByQuestion.values()) {
    if (entry.correct) {
      mastered += 1;
    }
  }

  return mastered;
}

export function growthStage(
  mastered: number,
  topicMastery: ReadonlyArray<number>,
  thresholds: GrowthStageThresholds = {},
): GrowthStage {
  const sproutMastered =
    thresholds.sproutMastered ?? DEFAULT_GROWTH_THRESHOLDS.sproutMastered;
  const scholarMastered =
    thresholds.scholarMastered ?? DEFAULT_GROWTH_THRESHOLDS.scholarMastered;
  const geniusMastered =
    thresholds.geniusMastered ?? DEFAULT_GROWTH_THRESHOLDS.geniusMastered;
  const geniusTopicsCount =
    thresholds.geniusTopicsCount ?? DEFAULT_GROWTH_THRESHOLDS.geniusTopicsCount;
  const geniusTopicMasteryRatio =
    thresholds.geniusTopicMasteryRatio ??
    DEFAULT_GROWTH_THRESHOLDS.geniusTopicMasteryRatio;

  const qualifyingTopics = topicMastery.filter(
    (ratio) => ratio >= geniusTopicMasteryRatio,
  ).length;

  if (mastered >= geniusMastered && qualifyingTopics >= geniusTopicsCount) {
    return "Genius";
  }
  if (mastered >= scholarMastered) {
    return "Scholar";
  }
  if (mastered >= sproutMastered) {
    return "Sprout";
  }
  return "Hatchling";
}
