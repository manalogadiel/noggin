export type ThoughtCardStatus = "understood" | "shaky" | "confused";

export type CardFreshness = "fresh" | "dusty" | "forgotten";

export interface CardFreshnessInput {
  nextReviewAt: Date | string;
  intervalDays: number;
}

export interface CardFreshnessThresholds {
  forgottenIntervalMultiplier?: number;
  forgottenMaxDays?: number;
}

export const DEFAULT_FORGOTTEN_INTERVAL_MULTIPLIER = 3;
export const DEFAULT_FORGOTTEN_MAX_DAYS = 60;
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function cardFreshness(
  card: CardFreshnessInput,
  now: Date = new Date(),
  thresholds: CardFreshnessThresholds = {},
): CardFreshness {
  const multiplier =
    thresholds.forgottenIntervalMultiplier ??
    DEFAULT_FORGOTTEN_INTERVAL_MULTIPLIER;
  const maxDays = thresholds.forgottenMaxDays ?? DEFAULT_FORGOTTEN_MAX_DAYS;

  const reviewTime =
    card.nextReviewAt instanceof Date
      ? card.nextReviewAt.getTime()
      : new Date(card.nextReviewAt).getTime();
  const overdueMs = now.getTime() - reviewTime;

  if (overdueMs <= 0) {
    return "fresh";
  }

  const overdueDays = overdueMs / DAY_IN_MS;
  if (overdueDays > card.intervalDays * multiplier || overdueDays >= maxDays) {
    return "forgotten";
  }

  return "dusty";
}

export function nextReviewIntervalDays(
  currentIntervalDays: number,
  passed: boolean,
): number {
  if (!passed) {
    return REVIEW_INTERVAL_DAYS[0];
  }
  const next = REVIEW_INTERVAL_DAYS.find((days) => days > currentIntervalDays);
  return next ?? REVIEW_INTERVAL_DAYS[REVIEW_INTERVAL_DAYS.length - 1];
}
