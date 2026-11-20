import { cardFreshness, type CardFreshness } from "../../domain/thought-card";
import { vitals, type VitalsResult } from "../../domain/vitals";
import type {
  Clock,
  CurrentUser,
  NogRecord,
  NogRepository,
  ThoughtCardRecord,
  ThoughtCardRepository,
} from "../ports";

export interface GetNogRoomDeps {
  currentUser: CurrentUser;
  clock: Clock;
  nogs: Pick<NogRepository, "findOwned">;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic" | "listByNog">;
}

export interface GetNogRoomInput {
  nogId: string;
  topicId?: string;
}

export interface RoomCardSummary extends ThoughtCardRecord {
  freshness: CardFreshness;
}

export type GetNogRoomResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | {
      status: "ok";
      nog: NogRecord;
      vitals: VitalsResult;
      cards: RoomCardSummary[];
    };

export async function getNogRoom(
  deps: GetNogRoomDeps,
  input: GetNogRoomInput,
): Promise<GetNogRoomResult> {
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
  const cards: RoomCardSummary[] = rawCards.map((card) => ({
    ...card,
    freshness:
      card.nextReviewAt !== undefined && card.intervalDays !== undefined
        ? cardFreshness(
            { nextReviewAt: card.nextReviewAt, intervalDays: card.intervalDays },
            now,
          )
        : "fresh",
  }));

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
  };
}
