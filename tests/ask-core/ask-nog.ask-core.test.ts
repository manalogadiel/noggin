import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  LessonPage,
  NogRecord,
  OwnedMessage,
  ThoughtCardRecord,
  TopicRecord,
} from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { speakAnswer } from "@/core/application/use-cases/speak-answer";

type AskUseCases = typeof import("@/core/application/use-cases/ask-nog");
let askNog: AskUseCases["askNog"];
let listAskHistory: AskUseCases["listAskHistory"];

beforeAll(async () => {
  ({ askNog, listAskHistory } = await import("@/core/application/use-cases/ask-nog"));
});

const ownerId = "student-1";
const otherOwnerId = "student-2";
const nog: NogRecord = {
  id: "nog-1",
  ownerId,
  subjectId: "networking",
  name: "Pingu",
  stage: "hatchling",
};
const otherNog = { ...nog, id: "nog-2", ownerId: otherOwnerId };
const topic: TopicRecord = {
  id: "tcp",
  subjectId: nog.subjectId,
  ownerId: null,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};
const otherTopic = { ...topic, id: "ip", ownerId, slug: "ip-addressing" };
const input = { nogId: nog.id, question: "Which flag starts the handshake?" };
const answer = "The client starts with SYN.";
const notTaught = "You haven't taught me that yet!";
const questionMessageId = "10000000-0000-4000-8000-000000000001";
const answerMessageId = "10000000-0000-4000-8000-000000000002";
const timestamp = "2026-11-22T09:00:00.000Z";

function card(id: string, overrides: Partial<ThoughtCardRecord> = {}): ThoughtCardRecord {
  return {
    id,
    nogId: nog.id,
    topicId: topic.id,
    label: "SYN",
    paraphrase: "The client sends SYN first.",
    quote: answer,
    status: "understood",
    sourceLessonId: `lesson-${id}`,
    ...overrides,
  };
}

function lesson(id: string, overrides: Partial<LessonPage> = {}): LessonPage {
  return {
    id,
    nogId: nog.id,
    topicId: topic.id,
    body: answer,
    wordCount: 5,
    kind: "lesson",
    idempotencyKey: `key-${id}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function exchange(index: number, nogId = nog.id) {
  return {
    nogId,
    questionMessageId: `question-${index}`,
    answerMessageId: `answer-${index}`,
    question: `Question ${index}?`,
    answer,
    mood: "happy",
    createdAt: new Date(Date.UTC(2026, 10, 22, 9, index)).toISOString(),
  };
}

const first = card("syn");
const taught = { answer, mood: "happy", knows: true, citedCardIds: [first.id] };

function fixture(cards: ThoughtCardRecord[] = [first]) {
  const { deps: base, setUser } = createInMemoryPorts({
    userId: ownerId,
    nogs: [nog, otherNog],
    topics: [topic, otherTopic],
  });
  if (!base.topics) throw new Error("Expected a topic repository");
  const topics = { findById: vi.fn(base.topics.findById) };
  const deps = {
    currentUser: { get: vi.fn(base.currentUser.get) },
    nogs: { findOwned: vi.fn(base.nogs.findOwned) },
    topics,
    thoughtCards: {
      search: vi.fn(async () => cards),
      listEvidenceLessonIds: vi.fn(async (): Promise<Array<{ cardId: string; lessonId: string }>> => []),
    },
    notebook: {
      findPagesByIds: vi.fn(async (): Promise<LessonPage[]> => []),
    },
    usage: {
      consumeQuota: vi.fn(async () => ({ allowed: true, used: 1, cap: 15 })),
    },
    asker: { ask: vi.fn(async () => taught) },
    askHistory: {
      save: vi.fn(async () => ({ questionMessageId, answerMessageId })),
      listRecent: vi.fn(async (): Promise<ReturnType<typeof exchange>[]> => []),
    },
  };
  return { deps, setUser };
}

function expectNoAskWork(deps: ReturnType<typeof fixture>["deps"]) {
  expect(deps.thoughtCards.search).not.toHaveBeenCalled();
  expect(deps.thoughtCards.listEvidenceLessonIds).not.toHaveBeenCalled();
  expect(deps.notebook.findPagesByIds).not.toHaveBeenCalled();
  expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
  expect(deps.asker.ask).not.toHaveBeenCalled();
  expect(deps.askHistory.save).not.toHaveBeenCalled();
  expect(deps.askHistory.listRecent).not.toHaveBeenCalled();
}

describe("ask-core access and question validation", () => {
  it("authenticates both entry points before checking ownership or accessing data", async () => {
    const { deps, setUser } = fixture();
    setUser(null);

    expect(await askNog(deps, { ...input, topicId: topic.id })).toEqual({ status: "unauthenticated" });
    expect(await listAskHistory(deps, { nogId: nog.id })).toEqual({ status: "unauthenticated" });
    expect(deps.currentUser.get).toHaveBeenCalledTimes(2);
    expect(deps.nogs.findOwned).not.toHaveBeenCalled();
    expect(deps.topics.findById).not.toHaveBeenCalled();
    expectNoAskWork(deps);
  });

  it("returns the same not_found for missing and foreign Nogs in both entry points", async () => {
    const { deps, setUser } = fixture();
    setUser(otherOwnerId);

    for (const nogId of [nog.id, "missing-nog"]) {
      expect(await askNog(deps, { ...input, nogId, topicId: topic.id })).toEqual({ status: "not_found" });
      expect(await listAskHistory(deps, { nogId })).toEqual({ status: "not_found" });
      expect(deps.nogs.findOwned).toHaveBeenCalledWith(otherOwnerId, nogId);
    }
    expect(deps.currentUser.get).toHaveBeenCalledBefore(deps.nogs.findOwned);
    expect(deps.topics.findById).not.toHaveBeenCalled();
    expectNoAskWork(deps);
  });

  it.each([
    ["missing", null],
    ["another subject", { ...topic, subjectId: "physics" }],
    ["another owner's private topic", { ...topic, ownerId: otherOwnerId }],
  ] as const)("rejects a %s topic before retrieval", async (_case, foundTopic) => {
    const { deps } = fixture();
    deps.topics.findById.mockResolvedValueOnce(foundTopic);

    expect(await askNog(deps, { ...input, topicId: topic.id })).toEqual({ status: "not_found" });
    expect(deps.topics.findById).toHaveBeenCalledExactlyOnceWith(topic.id);
    expect(deps.nogs.findOwned).toHaveBeenCalledBefore(deps.topics.findById);
    expectNoAskWork(deps);
  });

  it("fails closed for a topic-scoped ask when the topic repository is unavailable", async () => {
    const { deps } = fixture();

    expect(await askNog({ ...deps, topics: undefined }, { ...input, topicId: topic.id }))
      .toEqual({ status: "not_found" });
    expectNoAskWork(deps);
  });

  it.each([["blank", ""], ["whitespace", "  \n\t  "], ["punctuation", "???"]])(
    "rejects a %s question before retrieval or writing history",
    async (_case, question) => {
      const { deps } = fixture();

      expect(await askNog(deps, { ...input, question })).toEqual({ status: "empty" });
      expectNoAskWork(deps);
    },
  );

  it.each([
    ["61 words", Array(61).fill("ask").join(" ")],
    ["401 characters", "a".repeat(401)],
  ])("rejects a question of %s before retrieval or writing history", async (_case, question) => {
    const { deps } = fixture();

    expect(await askNog(deps, { ...input, question })).toEqual({ status: "too_long" });
    expectNoAskWork(deps);
  });

  it("accepts a trimmed question with exactly 60 words and 400 characters", async () => {
    const { deps } = fixture();
    const atLimit = [...Array(59).fill("hello"), "a".repeat(46)].join(" ");
    expect(atLimit).toHaveLength(400);
    expect(await askNog(deps, { ...input, question: ` \n${atLimit}\t ` }))
      .toMatchObject({ status: "ok", answerMessageId });
    expect(deps.thoughtCards.search).toHaveBeenCalledExactlyOnceWith(nog.id, null, atLimit, 8);
    expect(deps.asker.ask).toHaveBeenCalledWith(expect.objectContaining({ question: atLimit }));
    expect(deps.askHistory.save).toHaveBeenCalledWith(expect.objectContaining({ question: atLimit }));
  });
});

describe("ask-core retrieval and quota", () => {
  it.each([
    ["no hits", []],
    ["only out-of-scope hits", [card("foreign", { nogId: otherNog.id }), card("out-of-topic", { topicId: otherTopic.id })]],
  ] as const)("saves a not-taught reply without AI or quota for %s", async (_case, cards) => {
    const { deps } = fixture([...cards]);
    const scopedInput = { ...input, topicId: topic.id, ownerId: otherOwnerId };

    expect(await askNog(deps, scopedInput)).toMatchObject({
      status: "ok", knows: false, answer: notTaught, citedCards: [], answerMessageId,
    });
    expect(deps.thoughtCards.search).toHaveBeenCalledExactlyOnceWith(nog.id, topic.id, input.question, 8);
    expect(deps.thoughtCards.listEvidenceLessonIds).not.toHaveBeenCalled();
    expect(deps.notebook.findPagesByIds).not.toHaveBeenCalled();
    expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
    expect(deps.asker.ask).not.toHaveBeenCalled();
    expect(deps.askHistory.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      ownerId, nogId: nog.id, question: input.question, answer: notTaught,
    }));
  });

  it("stops before evidence lookup, AI and saving when ask quota is exhausted", async () => {
    const { deps } = fixture();
    deps.usage.consumeQuota.mockResolvedValueOnce({ allowed: false, used: 15, cap: 15 });

    expect(await askNog(deps, input)).toEqual({ status: "tired_for_today" });
    expect(deps.usage.consumeQuota).toHaveBeenCalledExactlyOnceWith(ownerId, "ask", 1);
    expect(deps.thoughtCards.search).toHaveBeenCalledBefore(deps.usage.consumeQuota);
    expect(deps.thoughtCards.listEvidenceLessonIds).not.toHaveBeenCalled();
    expect(deps.notebook.findPagesByIds).not.toHaveBeenCalled();
    expect(deps.asker.ask).not.toHaveBeenCalled();
    expect(deps.askHistory.save).not.toHaveBeenCalled();
  });

  it("sends only eight ranked unique in-scope cards and fetches five unique lessons in one batch", async () => {
    const rankedCards = [first, ...Array.from({ length: 8 }, (_, index) => card(`rank-${index}`))];
    const { deps } = fixture([
      card("foreign", { nogId: otherNog.id }),
      first,
      card("out-of-topic", { topicId: otherTopic.id }),
      ...rankedCards,
    ]);
    const keptCards = rankedCards.slice(0, 8);
    const evidence = rankedCards.map((hit) => ({ cardId: hit.id, lessonId: `evidence-${hit.id}` }));
    deps.thoughtCards.listEvidenceLessonIds.mockResolvedValueOnce([
      ...evidence.slice(0, 8).reverse(),
      evidence[0],
    ]);
    const expectedIds = evidence.slice(0, 5).map(({ lessonId }) => lessonId);
    const allowedPages = [lesson(expectedIds[0]), lesson(expectedIds[3]), lesson(expectedIds[4])];
    deps.notebook.findPagesByIds.mockResolvedValueOnce([
      allowedPages[0],
      lesson(expectedIds[1], { nogId: otherNog.id }),
      lesson(expectedIds[2], { topicId: otherTopic.id }),
      ...allowedPages.slice(1),
    ]);

    expect(await askNog(deps, { ...input, topicId: topic.id })).toMatchObject({ status: "ok", knows: true });
    expect(deps.thoughtCards.search).toHaveBeenCalledExactlyOnceWith(nog.id, topic.id, input.question, 8);
    expect(deps.usage.consumeQuota).toHaveBeenCalledExactlyOnceWith(ownerId, "ask", 1);
    expect(deps.usage.consumeQuota).toHaveBeenCalledBefore(deps.thoughtCards.listEvidenceLessonIds);
    expect(deps.usage.consumeQuota).toHaveBeenCalledBefore(deps.notebook.findPagesByIds);
    expect(deps.usage.consumeQuota).toHaveBeenCalledBefore(deps.asker.ask);
    expect(deps.thoughtCards.listEvidenceLessonIds).toHaveBeenCalledExactlyOnceWith(keptCards.map(({ id }) => id));
    expect(deps.notebook.findPagesByIds).toHaveBeenCalledExactlyOnceWith(nog.id, expectedIds);
    expect(deps.asker.ask).toHaveBeenCalledExactlyOnceWith({
      nogId: nog.id, question: input.question, cards: keptCards, pages: allowedPages,
    });
  });

  it("searches all topics and batches original lessons when the evidence lookup is absent", async () => {
    const second = card("ip", { topicId: otherTopic.id, sourceLessonId: "lesson-ip" });
    const third = card("also-syn", { sourceLessonId: first.sourceLessonId });
    const { deps } = fixture([first, second, third]);
    const pages = [lesson("lesson-syn"), lesson("lesson-ip", { topicId: otherTopic.id })];
    deps.notebook.findPagesByIds.mockResolvedValueOnce(pages);
    const { search } = deps.thoughtCards;

    expect(await askNog({ ...deps, thoughtCards: { search } }, { ...input, topicId: null }))
      .toMatchObject({ status: "ok", knows: true });
    expect(search).toHaveBeenCalledExactlyOnceWith(nog.id, null, input.question, 8);
    expect(deps.topics.findById).not.toHaveBeenCalled();
    expect(deps.notebook.findPagesByIds).toHaveBeenCalledExactlyOnceWith(nog.id, ["lesson-syn", "lesson-ip"]);
    expect(deps.asker.ask).toHaveBeenCalledExactlyOnceWith({
      nogId: nog.id, question: input.question, cards: [first, second, third], pages,
    });
  });

  it("uses a card's original lesson if evidence is empty and skips page lookup without lesson IDs", async () => {
    const withSource = fixture();
    await askNog(withSource.deps, input);
    expect(withSource.deps.notebook.findPagesByIds).toHaveBeenCalledExactlyOnceWith(nog.id, ["lesson-syn"]);

    const withoutSource = fixture([card(first.id, { sourceLessonId: undefined })]);
    expect(await askNog(withoutSource.deps, input)).toMatchObject({ status: "ok", knows: true });
    expect(withoutSource.deps.notebook.findPagesByIds).not.toHaveBeenCalled();
    expect(withoutSource.deps.asker.ask).toHaveBeenCalledWith(expect.objectContaining({ pages: [] }));
  });

  it("caps lesson context at five pages even if a batch lookup returns more", async () => {
    const cards = [first, ...Array.from({ length: 5 }, (_, index) => card(`rank-${index}`))];
    const { deps } = fixture(cards);
    const pages = cards.map(({ id }) => lesson(`lesson-${id}`));
    deps.notebook.findPagesByIds.mockResolvedValueOnce(pages);

    expect(await askNog(deps, input)).toMatchObject({ status: "ok", knows: true });
    expect(deps.asker.ask).toHaveBeenCalledExactlyOnceWith({
      nogId: nog.id, question: input.question, cards, pages: pages.slice(0, 5),
    });
  });
});

describe("ask-core grounding and history", () => {
  it("keeps only unique retrieved citations in model order and returns trusted card fields", async () => {
    const second = card("syn-ack", { label: "SYN-ACK", quote: "The server responds with SYN-ACK." });
    const { deps } = fixture([first, second, card("foreign", { nogId: otherNog.id })]);
    deps.asker.ask.mockResolvedValueOnce({
      ...taught,
      citedCardIds: [second.id, "foreign", "", 42, first.id, second.id] as unknown as string[],
    });

    expect(await askNog(deps, input)).toMatchObject({
      status: "ok", knows: true, answer, answerMessageId,
      citedCards: [second, first].map(({ id, label, quote }) => ({ id, label, quote })),
    });
    expect(deps.askHistory.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      ownerId, nogId: nog.id, question: input.question, answer, mood: "happy",
    }));
  });

  it.each<[string, Partial<typeof taught>]>([
    ["no citations", { citedCardIds: [] }],
    ["only invented or foreign citations", { citedCardIds: ["foreign", "made-up"] }],
    ["a model-declared unknown with an answer body", { knows: false }],
    ["a blank answer with a valid citation", { answer: "  \n " }],
    ["a non-string answer with a valid citation", { answer: 42 as unknown as string }],
  ])("returns and saves the not-taught answer for %s", async (_case, output) => {
    const { deps } = fixture([first, card("foreign", { nogId: otherNog.id })]);
    deps.asker.ask.mockResolvedValueOnce({ ...taught, ...output });

    expect(await askNog(deps, input)).toMatchObject({
      status: "ok", knows: false, answer: notTaught, citedCards: [], answerMessageId,
    });
    expect(deps.askHistory.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ answer: notTaught }));
  });

  it.each([["overlong", "m".repeat(21)], ["blank", "  \n\t  "]])(
    "bounds the answer and substitutes a safe mood when the mood is %s",
    async (_case, mood) => {
      const { deps } = fixture();
      const overlong = "a".repeat(601);
      deps.asker.ask.mockResolvedValueOnce({ ...taught, answer: ` \n${overlong}  `, mood });

      expect(await askNog(deps, input)).toMatchObject({ status: "ok", answer: overlong.slice(0, 600) });
      expect(deps.askHistory.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        answer: overlong.slice(0, 600), mood: expect.stringMatching(/^\S(?:.{0,18}\S)?$/u),
      }));
    },
  );

  it("trims a valid mood before saving", async () => {
    const { deps } = fixture();
    deps.asker.ask.mockResolvedValueOnce({ ...taught, mood: "  happy  " });

    expect(await askNog(deps, input)).toMatchObject({ status: "ok" });
    expect(deps.askHistory.save).toHaveBeenCalledWith(expect.objectContaining({ mood: "happy" }));
  });

  it("returns brain_fog without raw error details or a saved exchange when the asker fails", async () => {
    const { deps } = fixture();
    deps.asker.ask.mockRejectedValueOnce(new Error("internal provider details"));

    expect(await askNog(deps, input)).toEqual({ status: "brain_fog" });
    expect(deps.usage.consumeQuota).toHaveBeenCalledExactlyOnceWith(ownerId, "ask", 1);
    expect(deps.askHistory.save).not.toHaveBeenCalled();
  });

  it("returns the last 20 exchanges for the owned Nog, ordered newest first", async () => {
    const { deps } = fixture();
    const saved = Array.from({ length: 23 }, (_, index) => exchange(index));
    deps.askHistory.listRecent.mockResolvedValueOnce([exchange(30, otherNog.id), ...saved]);

    expect(await listAskHistory(deps, { nogId: nog.id })).toMatchObject({
      status: "ok", exchanges: saved.slice(-20).reverse(),
    });
    expect(deps.nogs.findOwned).toHaveBeenCalledExactlyOnceWith(ownerId, nog.id);
    expect(deps.nogs.findOwned).toHaveBeenCalledBefore(deps.askHistory.listRecent);
    expect(deps.askHistory.listRecent).toHaveBeenCalledExactlyOnceWith(ownerId, nog.id, 20);
    expect(deps.askHistory.save).not.toHaveBeenCalled();
    expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
    expect(deps.asker.ask).not.toHaveBeenCalled();
  });

  it.each([[100, 20], [0, 1], [3, 3]])("clamps a history limit of %i to %i", async (limit, bounded) => {
    const { deps } = fixture();
    const saved = Array.from({ length: 25 }, (_, index) => exchange(index));
    deps.askHistory.listRecent.mockResolvedValueOnce(saved);

    expect(await listAskHistory(deps, { nogId: nog.id, limit })).toMatchObject({
      status: "ok", exchanges: saved.slice(-bounded).reverse(),
    });
    expect(deps.askHistory.listRecent).toHaveBeenCalledExactlyOnceWith(ownerId, nog.id, bounded);
  });

  it("provides the saved Nog message ID for playback and rejects playback of the student question", async () => {
    const { deps } = fixture();
    const result = await askNog(deps, input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Expected a saved answer");
    expect(result.answerMessageId).toBe(answerMessageId);

    const messages: OwnedMessage[] = [
      { id: questionMessageId, nogId: nog.id, role: "student", kind: "ask", body: input.question },
      { id: answerMessageId, nogId: nog.id, role: "nog", kind: "ask_answer", body: answer },
    ];
    const voice = createInMemoryPorts({ userId: ownerId, nogs: [nog], messages }).deps;
    const speak = vi.spyOn(voice.textToSpeech, "speak");

    expect(await speakAnswer(voice, { source: "nog_message", id: questionMessageId })).toEqual({ status: "not_found" });
    expect(await speakAnswer(voice, { source: "nog_message", id: result.answerMessageId })).toMatchObject({ status: "ok" });
    expect(speak).toHaveBeenCalledExactlyOnceWith({ text: answer });
  });
});
