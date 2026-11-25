import { beforeEach, expect, vi } from "vitest";
import type { AskInput, AskOutput, NogAsker, ThoughtCardRecord } from "@/core/application/ports";
import { listenerInput, loadAdapters, makeAdapters, page, scope } from "@/adapters/ai/__tests__/fixtures";

beforeEach(() => {
  vi.stubEnv("LLM_ASKER_MODEL", undefined);
});

export const card: ThoughtCardRecord = {
  ...scope,
  id: "card-tide",
  label: "Spring tide",
  paraphrase: "Spring tides have a larger tidal range.",
  status: "shaky",
  quote: "During a spring tide, the tidal range is larger.",
};

export const askInput: AskInput = {
  nogId: scope.nogId,
  question: "What does a spring tide do?",
  cards: [card],
  pages: [page(card.quote!)],
};

export const askOutput: AskOutput = {
  answer: card.paraphrase,
  mood: "curious",
  knows: true,
  citedCardIds: [card.id],
};

export const listenerV3Input = {
  ...listenerInput,
  topicTitle: "Tides",
  existingCards: [card],
  page: page(card.paraphrase),
};

export function requireAsker(adapters: object): NogAsker {
  const { asker } = adapters as { asker?: NogAsker };
  if (typeof asker?.ask !== "function") throw new Error("Missing asker.ask on LLM adapters");
  return asker;
}

export async function makeAsker(options?: Parameters<typeof makeAdapters>[0]) {
  return requireAsker(await makeAdapters(options));
}

export async function getAskerOutputError() {
  const { AskerOutputError } = await loadAdapters() as { AskerOutputError?: typeof Error };
  if (typeof AskerOutputError !== "function") {
    throw new Error("Missing AskerOutputError export from fallback-llm");
  }
  return AskerOutputError;
}

export function expectMetadataOnly(logs: unknown[][]) {
  const keys = [
    "event", "role", "model", "promptVersion", "latencyMs", "status",
    "promptTokens", "completionTokens", "totalTokens",
  ];
  expect(logs.length).toBeGreaterThan(0);
  for (const args of logs) {
    expect(args).toHaveLength(1);
    expect(Object.keys(args[0] as object).sort()).toEqual(keys.toSorted());
  }
}
