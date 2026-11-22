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

interface ParsedTimestamp {
  ms: number;
  subMsNanos: number;
}

function parseTimestamp(value: Date | string): ParsedTimestamp {
  if (value instanceof Date) {
    return { ms: value.getTime(), subMsNanos: 0 };
  }

  const ms = new Date(value).getTime();
  const fractionMatch = /\.(\d+)(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(value.trim());
  if (!fractionMatch) {
    return { ms, subMsNanos: 0 };
  }

  const padded = fractionMatch[1].padEnd(9, "0").slice(0, 9);
  const subMsNanos = Number.parseInt(padded.slice(3, 9), 10);
  return { ms, subMsNanos: Number.isNaN(subMsNanos) ? 0 : subMsNanos };
}

function compareTimestamps(a: ParsedTimestamp, b: ParsedTimestamp): number {
  if (a.ms !== b.ms) {
    return a.ms - b.ms;
  }
  return a.subMsNanos - b.subMsNanos;
}

export function trainingMeter(attempts: ReadonlyArray<QuestionAttempt>): number {
  const latestByQuestion = new Map<
    string,
    { timestamp: ParsedTimestamp; correct: boolean }
  >();

  for (const attempt of attempts) {
    const timestamp = parseTimestamp(attempt.attemptedAt);
    const existing = latestByQuestion.get(attempt.questionId);
    if (!existing || compareTimestamps(timestamp, existing.timestamp) >= 0) {
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
