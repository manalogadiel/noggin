import { cardFreshness, type CardFreshness } from "../../domain/thought-card";
import {
  growthStage,
  trainingMeter,
  type GrowthStage,
} from "../../domain/training";
import { vitals, type VitalsResult } from "../../domain/vitals";
import type {
  AttemptRepository,
  Clock,
  CurrentUser,
  NogRecord,
  NogRepository,
  ThoughtCardRecord,
  ThoughtCardRepository,
} from "../ports";

export interface GetNogAnalysisDeps {
  currentUser: CurrentUser;
  clock: Clock;
  nogs: Pick<NogRepository, "findOwned">;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic" | "listByNog">;
  attempts: Pick<AttemptRepository, "findLatest" | "listByNog">;
}

export interface GetNogAnalysisInput {
  nogId: string;
  topicId?: string;
  topicMasteryRatios?: ReadonlyArray<number>;
}

export interface AnalysisCard extends ThoughtCardRecord {
  freshness: CardFreshness;
}

export type GetNogAnalysisResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | {
      status: "ok";
      nog: NogRecord;
      vitals: VitalsResult;
      cards: AnalysisCard[];
      masteredCount: number;
      stage: GrowthStage;
    };

export async function getNogAnalysis(
  deps: GetNogAnalysisDeps,
  input: GetNogAnalysisInput,
): Promise<GetNogAnalysisResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const rawCards =
    input.topicId !== undefined
      ? await deps.thoughtCards.listByTopic(input.nogId, input.topicId)
      : deps.thoughtCards.listByNog
        ? await deps.thoughtCards.listByNog(input.nogId)
        : [];

  const now = deps.clock.now();
  const cards: AnalysisCard[] = rawCards.map((card) => ({
    ...card,
    freshness:
      card.nextReviewAt !== undefined && card.intervalDays !== undefined
        ? cardFreshness(
            { nextReviewAt: card.nextReviewAt, intervalDays: card.intervalDays },
            now,
          )
        : "fresh",
  }));

  const rawAttempts =
    input.topicId !== undefined
      ? await deps.attempts.findLatest(input.nogId, input.topicId)
      : deps.attempts.listByNog
        ? await deps.attempts.listByNog(input.nogId)
        : [];

  const masteredCount = trainingMeter(
    rawAttempts.map((attempt) => ({
      questionId: attempt.questionId,
      attemptedAt: attempt.createdAt,
      correct: attempt.correct,
    })),
  );

  const stage = growthStage(masteredCount, input.topicMasteryRatios ?? []);
  const happiness = (nog.happiness ?? 70) / 100;
  const vitality = nog.vitality ?? 1;
  const computedVitals = vitals({
    happiness,
    vitality,
    cards: cards.map((card) => ({
      status: card.status,
      freshness: card.freshness,
    })),
  });

  return {
    status: "ok",
    nog,
    vitals: computedVitals,
    cards,
    masteredCount,
    stage,
  };
}
