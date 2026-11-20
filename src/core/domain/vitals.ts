import type { CardFreshness, ThoughtCardStatus } from "./thought-card";

export interface VitalCardSummary {
  status: ThoughtCardStatus;
  freshness: CardFreshness;
}

export interface VitalsInput {
  happiness: number;
  vitality: number;
  cards: ReadonlyArray<VitalCardSummary>;
}

export interface VitalsResult {
  happiness: number;
  clarity: number;
  vitality: number;
  faint: boolean;
}

export function vitals(input: VitalsInput): VitalsResult {
  const activeCards = input.cards.filter(
    (card) => card.freshness !== "forgotten",
  );

  let clarity: number;
  if (input.cards.length === 0) {
    clarity = 1;
  } else if (activeCards.length === 0) {
    clarity = 0;
  } else {
    const understoodCount = activeCards.filter(
      (card) => card.status === "understood",
    ).length;
    clarity = understoodCount / activeCards.length;
  }

  const faint = input.happiness <= 0 || clarity <= 0 || input.vitality <= 0;

  return {
    happiness: input.happiness,
    clarity,
    vitality: input.vitality,
    faint,
  };
}
