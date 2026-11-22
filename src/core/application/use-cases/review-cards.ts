import { cardFreshness } from "../../domain/thought-card";
import type {
  CardReviewOutcome,
  Clock,
  CurrentUser,
  NogRepository,
  ThoughtCardRecord,
  ThoughtCardRepository,
} from "../ports";

export interface ReviewCardsDeps {
  currentUser: CurrentUser;
  clock: Clock;
  nogs: Pick<NogRepository, "findOwned">;
  thoughtCards: Pick<ThoughtCardRepository, "listByNog" | "reviewCard">;
}

export interface ListDueCardsInput {
  nogId: string;
}

export type ListDueCardsResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; cards: ThoughtCardRecord[] };

export interface ReviewCardInput {
  nogId: string;
  cardId: string;
  outcome: CardReviewOutcome;
}

export type ReviewCardResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; card: ThoughtCardRecord };

function reviewTimestampMs(value: Date | string | undefined): number {
  if (value === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export async function listDueCards(
  deps: ReviewCardsDeps,
  input: ListDueCardsInput,
): Promise<ListDueCardsResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const allCards = deps.thoughtCards.listByNog
    ? await deps.thoughtCards.listByNog(input.nogId)
    : [];
  const now = deps.clock.now();

  const ranked = allCards
    .map((card) => {
      const freshness =
        card.nextReviewAt !== undefined && card.intervalDays !== undefined
          ? cardFreshness(
              { nextReviewAt: card.nextReviewAt, intervalDays: card.intervalDays },
              now,
            )
          : "fresh";

      let priority: number | null = null;
      if (freshness === "dusty") {
        priority = 0;
      } else if (freshness === "forgotten") {
        priority = 1;
      } else if (card.status === "shaky") {
        priority = 2;
      }

      return { card, priority };
    })
    .filter(
      (entry): entry is { card: ThoughtCardRecord; priority: number } =>
        entry.priority !== null,
    )
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      const timeDiff =
        reviewTimestampMs(a.card.nextReviewAt) -
        reviewTimestampMs(b.card.nextReviewAt);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.card.id.localeCompare(b.card.id);
    });

  return {
    status: "ok",
    cards: ranked.map((entry) => entry.card),
  };
}

export async function reviewCard(
  deps: ReviewCardsDeps,
  input: ReviewCardInput,
): Promise<ReviewCardResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  if (input.outcome !== "remembered" && input.outcome !== "forgot") {
    return { status: "not_found" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  if (deps.thoughtCards.listByNog) {
    const nogCards = await deps.thoughtCards.listByNog(input.nogId);
    if (!nogCards.some((card) => card.id === input.cardId)) {
      return { status: "not_found" };
    }
  }

  if (!deps.thoughtCards.reviewCard) {
    return { status: "not_found" };
  }

  const updated = await deps.thoughtCards.reviewCard({
    ownerId: user.id,
    nogId: input.nogId,
    cardId: input.cardId,
    outcome: input.outcome,
    now: deps.clock.now(),
  });

  if (!updated) {
    return { status: "not_found" };
  }

  return { status: "ok", card: updated };
}
