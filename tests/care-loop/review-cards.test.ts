/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import type { ThoughtCardRecord } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import {
  confusedCard,
  dustyCard,
  forgottenCard,
  freshUnderstoodCard,
  nog,
  now,
  shakyCard,
  toRecord,
} from "./fixtures";

type Deps = ReturnType<typeof createInMemoryPorts>["deps"];
type ReviewOutcome = "remembered" | "forgot";

type ListDueCards = (
  deps: Deps,
  input: { nogId: string },
) => Promise<
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; cards: ThoughtCardRecord[] }
>;

type ReviewCard = (
  deps: Deps,
  input: { nogId: string; cardId: string; outcome: ReviewOutcome },
) => Promise<
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; card: ThoughtCardRecord }
>;

const useCasePath = "../../src/core/application/use-cases/review-cards.ts";
const modules = import.meta.glob<{
  listDueCards: ListDueCards;
  reviewCard: ReviewCard;
}>("../../src/core/application/use-cases/review-cards.ts");

async function loadUseCases() {
  const loader = modules[useCasePath];
  if (!loader) {
    throw new Error("Missing use case: src/core/application/use-cases/review-cards.ts");
  }
  return loader();
}

const otherNog = {
  ...nog,
  id: "99999999-8888-4777-8666-555555555599",
  ownerId: "learner-b",
};

const otherNogCard: ThoughtCardRecord = {
  ...toRecord(dustyCard),
  id: "11111111-2222-4333-8444-555555555599",
  nogId: otherNog.id,
};

describe("review-cards use cases", () => {
  it("lists due cards for the owner's Nog with overdue/dusty cards before shaky cards and excludes fresh understood cards", async () => {
    const { deps } = createInMemoryPorts({
      userId: nog.ownerId,
      now,
      nogs: [nog, otherNog],
      cards: [
        toRecord(freshUnderstoodCard),
        toRecord(shakyCard),
        toRecord(dustyCard),
        toRecord(forgottenCard),
        otherNogCard,
      ],
    });
    const { listDueCards } = await loadUseCases();

    const result = await listDueCards(deps, { nogId: nog.id });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected due cards for owned Nog");
    }

    const ids = result.cards.map((card) => card.id);
    expect(ids).toContain(dustyCard.id);
    expect(ids).toContain(forgottenCard.id);
    expect(ids).toContain(shakyCard.id);
    expect(ids).not.toContain(freshUnderstoodCard.id);
    expect(ids).not.toContain(otherNogCard.id);

    const shakyIndex = ids.indexOf(shakyCard.id);
    expect(ids.indexOf(dustyCard.id)).toBeLessThan(shakyIndex);
    expect(ids.indexOf(forgottenCard.id)).toBeLessThan(shakyIndex);
  });

  it("returns an empty list when all thought cards are fresh and understood", async () => {
    const { deps } = createInMemoryPorts({
      userId: nog.ownerId,
      now,
      nogs: [nog],
      cards: [toRecord(freshUnderstoodCard)],
    });
    const { listDueCards } = await loadUseCases();

    await expect(listDueCards(deps, { nogId: nog.id })).resolves.toEqual({
      status: "ok",
      cards: [],
    });
  });

  it("enforces authentication and Nog ownership on listDueCards", async () => {
    const { deps, setUser } = createInMemoryPorts({
      userId: nog.ownerId,
      now,
      nogs: [nog, otherNog],
      cards: [toRecord(dustyCard), otherNogCard],
    });
    const { listDueCards } = await loadUseCases();

    await expect(listDueCards(deps, { nogId: otherNog.id })).resolves.toEqual({
      status: "not_found",
    });
    await expect(listDueCards(deps, { nogId: "missing-nog" })).resolves.toEqual({
      status: "not_found",
    });

    setUser(null);
    await expect(listDueCards(deps, { nogId: nog.id })).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("advances intervalDays along the 1→3→7→14→30 ladder and increments strength on remembered reviews", async () => {
    const startCard: ThoughtCardRecord = {
      ...toRecord(dustyCard),
      strength: 1,
      intervalDays: 1,
      nextReviewAt: "2026-11-20T12:00:00.000Z",
    };
    const { deps, stores } = createInMemoryPorts({
      userId: nog.ownerId,
      now,
      nogs: [nog],
      cards: [startCard],
    });
    const { reviewCard } = await loadUseCases();

    const expectedLadder = [3, 7, 14, 30, 30];
    for (const [stepIndex, expectedInterval] of expectedLadder.entries()) {
      const result = await reviewCard(deps, {
        nogId: nog.id,
        cardId: startCard.id,
        outcome: "remembered",
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") {
        throw new Error(`Expected step ${stepIndex + 1} to succeed`);
      }

      const expectedStrength = 2 + stepIndex;
      const expectedNextReviewMs =
        now.getTime() + expectedInterval * 24 * 60 * 60 * 1000;
      const actualNextReviewMs = new Date(
        result.card.nextReviewAt ?? 0,
      ).getTime();

      expect(result.card.intervalDays).toBe(expectedInterval);
      expect(result.card.strength).toBe(expectedStrength);
      expect(actualNextReviewMs).toBe(expectedNextReviewMs);

      const persisted = stores.cards.find((c) => c.id === startCard.id);
      expect(persisted?.intervalDays).toBe(expectedInterval);
      expect(persisted?.strength).toBe(expectedStrength);
    }
  });

  it("resets intervalDays to 1 and marks the card shaky when the outcome is forgot", async () => {
    const learnedCard: ThoughtCardRecord = {
      ...toRecord(forgottenCard),
      status: "understood",
      strength: 4,
      intervalDays: 14,
      nextReviewAt: "2026-11-01T12:00:00.000Z",
    };
    const { deps, stores } = createInMemoryPorts({
      userId: nog.ownerId,
      now,
      nogs: [nog],
      cards: [learnedCard],
    });
    const { reviewCard } = await loadUseCases();

    const result = await reviewCard(deps, {
      nogId: nog.id,
      cardId: learnedCard.id,
      outcome: "forgot",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected forgot review to succeed");
    }

    const expectedNextReviewMs = now.getTime() + 1 * 24 * 60 * 60 * 1000;
    const actualNextReviewMs = new Date(
      result.card.nextReviewAt ?? 0,
    ).getTime();

    expect(result.card.intervalDays).toBe(1);
    expect(result.card.status).toBe("shaky");
    expect(actualNextReviewMs).toBe(expectedNextReviewMs);

    const persisted = stores.cards.find((c) => c.id === learnedCard.id);
    expect(persisted?.intervalDays).toBe(1);
    expect(persisted?.status).toBe("shaky");
  });

  it("rejects unauthenticated or cross-owner reviewCard calls without modifying stored cards", async () => {
    const { deps, stores, setUser } = createInMemoryPorts({
      userId: nog.ownerId,
      now,
      nogs: [nog, otherNog],
      cards: [toRecord(confusedCard), otherNogCard],
    });
    const { reviewCard } = await loadUseCases();

    await expect(
      reviewCard(deps, {
        nogId: otherNog.id,
        cardId: otherNogCard.id,
        outcome: "remembered",
      }),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      reviewCard(deps, {
        nogId: nog.id,
        cardId: otherNogCard.id,
        outcome: "remembered",
      }),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      reviewCard(deps, {
        nogId: nog.id,
        cardId: "missing-card",
        outcome: "remembered",
      }),
    ).resolves.toEqual({ status: "not_found" });

    setUser(null);
    await expect(
      reviewCard(deps, {
        nogId: nog.id,
        cardId: confusedCard.id,
        outcome: "remembered",
      }),
    ).resolves.toEqual({ status: "unauthenticated" });

    expect(stores.cards.find((c) => c.id === otherNogCard.id)?.intervalDays).toBe(1);
    expect(stores.cards.find((c) => c.id === confusedCard.id)?.status).toBe("confused");
  });
});
