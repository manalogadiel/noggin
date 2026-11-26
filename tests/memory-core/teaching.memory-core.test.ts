import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  DigestOperation,
  ListenerDigest,
  ThoughtCardRecord,
  TopicRecord,
} from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { answerFollowUp } from "@/core/application/use-cases/answer-follow-up";
import { teachLesson } from "@/core/application/use-cases/teach-lesson";

const scope = { nogId: "nog-1", topicId: "tcp" };
const ownerId = "student-1";
const subjectId = "networking";
const topic: TopicRecord = {
  id: scope.topicId,
  subjectId,
  ownerId: null,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};
const otherTopic = {
  ...topic,
  id: "ip",
  slug: "ip-addressing",
  title: "IP addressing",
};
const otherNog = "nog-2";
const lesson = {
  ...scope,
  body: "The client starts with SYN.",
  idempotencyKey: "first-lesson",
};
const repeat = {
  ...lesson,
  body: "Uhm, THE client starts with SYN! Parang, ano, uh, bale, like.",
  idempotencyKey: "repeat-lesson",
};
const digest: ListenerDigest = {
  reply: "Got it!",
  mood: "happy",
  followUpQuestions: [],
  operations: [],
};

function fixture(cards: ThoughtCardRecord[] = []) {
  const { deps, stores } = createInMemoryPorts({
    userId: ownerId,
    nogs: [scope.nogId, otherNog].map((id) => ({
      id,
      ownerId,
      subjectId,
      name: id,
      stage: "hatchling",
    })),
    topics: [topic, otherTopic],
    cards,
  });
  return {
    deps,
    stores,
    listen: vi.spyOn(deps.listener, "listen").mockResolvedValue(digest),
    consumeQuota: vi.spyOn(deps.usage, "consumeQuota"),
    applyDigest: vi.spyOn(deps.notebook, "applyDigest"),
  };
}

function card(
  id: string,
  fields: Partial<ThoughtCardRecord> = {},
): ThoughtCardRecord {
  return {
    ...scope,
    id,
    label: "SYN",
    paraphrase: "The client starts with SYN",
    status: "shaky",
    strength: 1,
    ...fields,
  };
}

function create(
  label: string,
  paraphrase: string,
  quote: string,
): Extract<DigestOperation, { type: "create" }> {
  return { type: "create", label, paraphrase, quote, status: "understood" };
}

describe("teachLesson memory", () => {
  it("returns the original lesson for a normalized repeat without spending quota", async () => {
    const { deps, stores, listen, consumeQuota, applyDigest } = fixture();
    const first = await teachLesson(deps, lesson);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") throw new Error("Expected a saved lesson");

    expect(await teachLesson(deps, repeat)).toEqual({
      status: "already_taught",
      pageId: first.page.id,
    });
    expect(listen).toHaveBeenCalledOnce();
    expect(consumeQuota).toHaveBeenCalledExactlyOnceWith(ownerId, "listener", 1);
    expect(applyDigest).toHaveBeenCalledOnce();
    expect(stores.pages).toHaveLength(1);
  });

  it("teaches repeats in another topic or Nog, and reordered text within the original topic", async () => {
    const { deps, listen, consumeQuota } = fixture();
    const first = await teachLesson(deps, lesson);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") throw new Error("Expected a saved lesson");

    const otherTopicResult = await teachLesson(deps, {
      ...repeat,
      topicId: otherTopic.id,
      idempotencyKey: "second-topic",
    });
    const otherNogResult = await teachLesson(deps, { ...repeat, nogId: otherNog });
    const reorderedResult = await teachLesson(deps, {
      ...lesson,
      body: "With SYN the client starts.",
      idempotencyKey: "reordered-lesson",
    });
    expect(otherTopicResult).toMatchObject({
      status: "ok",
      page: { topicId: otherTopic.id },
    });
    expect(otherNogResult).toMatchObject({
      status: "ok",
      page: { nogId: otherNog },
    });
    expect(reorderedResult.status).toBe("ok");

    expect(await teachLesson(deps, repeat)).toEqual({
      status: "already_taught",
      pageId: first.page.id,
    });
    expect(listen).toHaveBeenCalledTimes(4);
    expect(consumeQuota).toHaveBeenCalledTimes(4);
  });

  it("replays a saved digest and preserves key conflicts before checking for repeats", async () => {
    const { deps, listen, consumeQuota } = fixture();
    const first = await teachLesson(deps, lesson);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") throw new Error("Expected a saved lesson");

    expect(await teachLesson(deps, lesson)).toMatchObject({
      status: "ok",
      page: first.page,
      digest: first.digest,
      applied: { applied: false },
    });
    expect(
      await teachLesson(deps, { ...repeat, idempotencyKey: lesson.idempotencyKey }),
    ).toEqual({ status: "idempotency_conflict" });
    expect(await teachLesson(deps, repeat)).toEqual({
      status: "already_taught",
      pageId: first.page.id,
    });
    expect(listen).toHaveBeenCalledOnce();
    expect(consumeQuota).toHaveBeenCalledOnce();
  });

  it("digests a brain-fog retry with the same key and reuses its page", async () => {
    const { deps, stores, listen, consumeQuota, applyDigest } = fixture();
    listen.mockRejectedValueOnce(new Error("Listener unavailable"));

    const failed = await teachLesson(deps, lesson);
    expect(failed.status).toBe("brain_fog");
    if (failed.status !== "brain_fog") throw new Error("Expected a saved retry page");
    expect(applyDigest).not.toHaveBeenCalled();

    expect(await teachLesson(deps, lesson)).toMatchObject({
      status: "ok",
      page: failed.page,
    });
    expect(await teachLesson(deps, repeat)).toEqual({
      status: "already_taught",
      pageId: failed.page.id,
    });
    expect(listen).toHaveBeenCalledTimes(2);
    expect(consumeQuota).toHaveBeenCalledTimes(2);
    expect(applyDigest).toHaveBeenCalledOnce();
    expect(stores.pages).toHaveLength(1);
  });

  it("reinforces a similar card, creates a distinct card, and reports the reinforced ID", async () => {
    const existing = card("syn");
    const { deps, stores, listen, applyDigest } = fixture([existing]);
    const input = { ...lesson, body: `${lesson.body} Routers forward packets.` };
    const similar = create(
      "SYN",
      "With SYN the client starts",
      "the client starts with syn",
    );
    const distinct = create(
      "Routers",
      "Routers forward packets",
      "Routers forward packets",
    );
    listen.mockResolvedValueOnce({ ...digest, operations: [similar, distinct] });

    const result = await teachLesson(deps, input);

    expect(applyDigest.mock.calls[0]?.[0].operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "reinforce",
          cardId: existing.id,
          quote: "The client starts with SYN",
        }),
        distinct,
      ]),
    );
    expect(applyDigest.mock.calls[0]?.[0].operations).toHaveLength(2);
    expect(result).toMatchObject({
      status: "ok",
      reinforcedCardIds: [existing.id],
    });
    expect(stores.cards).toHaveLength(2);
    expect(stores.cards).toContainEqual(
      expect.objectContaining({ id: existing.id, strength: 2 }),
    );
  });

  it("drops reinforcement outside the topic and rejects ungrounded reinforcement", async () => {
    const valid = card("valid");
    const ungrounded = card("ungrounded");
    const foreign = card("foreign", { topicId: otherTopic.id });
    const { deps, stores, listen, applyDigest } = fixture([valid, ungrounded, foreign]);
    listen.mockResolvedValueOnce({
      ...digest,
      operations: [
        { type: "reinforce", cardId: foreign.id, quote: "The client starts with SYN" },
        { type: "reinforce", cardId: ungrounded.id, quote: "The client starts with FIN" },
        { type: "reinforce", cardId: valid.id, quote: "the client starts with syn" },
      ],
    });

    const result = await teachLesson(deps, lesson);

    expect(applyDigest.mock.calls[0]?.[0].operations).toEqual([
      { type: "reinforce", cardId: valid.id, quote: "The client starts with SYN" },
    ]);
    expect(result).toMatchObject({ status: "ok", reinforcedCardIds: [valid.id] });
    expect(stores.cards.map(({ id, strength }) => ({ id, strength }))).toEqual([
      { id: valid.id, strength: 2 },
      { id: ungrounded.id, strength: 1 },
      { id: foreign.id, strength: 1 },
    ]);
  });

  it("sends the 40 most similar cards and keeps every card when there are only 40", async () => {
    const related = Array.from({ length: 39 }, (_, index) => card(`syn-${index}`));
    const leastSimilar = card("orchids", {
      label: "Orchids",
      paraphrase: "orchids bloom indoors",
    });
    const moreSimilar = card("retransmit", {
      label: "SYN",
      paraphrase: "client retransmits SYN",
    });
    const atLimit = fixture([leastSimilar, ...related]);
    const overLimit = fixture([leastSimilar, ...related, moreSimilar]);

    await teachLesson(atLimit.deps, lesson);
    await teachLesson(overLimit.deps, lesson);

    const idsAtLimit = atLimit.listen.mock.calls[0]?.[0].existingCards.map(
      ({ id }) => id,
    );
    const idsOverLimit = overLimit.listen.mock.calls[0]?.[0].existingCards.map(
      ({ id }) => id,
    );
    expect(idsAtLimit).toHaveLength(40);
    expect(idsAtLimit).toContain(leastSimilar.id);
    expect(idsOverLimit).toHaveLength(40);
    expect(idsOverLimit).toEqual(
      expect.arrayContaining([...related, moreSimilar].map(({ id }) => id)),
    );
  });

  it("passes the topic title and forces both off-topic operation statuses to shaky", async () => {
    const existing = card("plants", {
      label: "Plants",
      paraphrase: "Roots absorb water",
      status: "understood",
    });
    const { deps, stores, listen, applyDigest } = fixture([existing]);
    const input = { ...lesson, body: "Roots absorb water. Leaves turn toward light." };
    const creation = create(
      "Light",
      "Leaves turn toward light",
      "Leaves turn toward light",
    );
    const reinforcement = {
      type: "reinforce" as const,
      cardId: existing.id,
      quote: "Roots absorb water",
    };
    listen.mockResolvedValueOnce({
      ...digest,
      offTopic: true,
      operations: [creation, reinforcement],
    });

    const result = await teachLesson(deps, input);

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ topicTitle: topic.title }),
    );
    expect(applyDigest.mock.calls[0]?.[0].operations).toEqual(
      expect.arrayContaining([
        { ...creation, status: "shaky" },
        { ...reinforcement, status: "shaky" },
      ]),
    );
    expect(applyDigest.mock.calls[0]?.[0].operations).toHaveLength(2);
    expect(result).toMatchObject({
      status: "ok",
      offTopic: true,
      reinforcedCardIds: [existing.id],
    });
    expect(stores.cards.map(({ status }) => status)).toEqual(["shaky", "shaky"]);
  });

  it("accepts card metadata alongside legacy cards and a notebook without listPages", async () => {
    expectTypeOf<ThoughtCardRecord>()
      .toHaveProperty("evidenceCount")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ThoughtCardRecord>()
      .toHaveProperty("score")
      .toEqualTypeOf<number | undefined>();

    const legacy = card("legacy");
    const ranked: ThoughtCardRecord = {
      ...card("ranked"),
      evidenceCount: 3,
      score: 0.9,
    };
    const { deps, listen } = fixture([legacy, ranked]);
    const notebook = {
      savePage: deps.notebook.savePage,
      applyDigest: deps.notebook.applyDigest,
      findPageByIdempotencyKey: deps.notebook.findPageByIdempotencyKey,
      findSavedDigest: deps.notebook.findSavedDigest,
      countIssuedQuestions: deps.notebook.countIssuedQuestions,
    };

    expect(await teachLesson({ ...deps, notebook }, lesson)).toMatchObject({
      status: "ok",
      reinforcedCardIds: [],
    });
    expect(listen.mock.calls[0]?.[0].existingCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: legacy.id }),
        expect.objectContaining({ id: ranked.id }),
      ]),
    );
  });
});

describe("answerFollowUp memory", () => {
  it("uses the saved root lesson and questions as context while grounding quotes in the answer alone", async () => {
    const { deps, stores, listen, applyDigest } = fixture();
    const questions = [
      "Which flag does the client send first?",
      "What starts the handshake?",
    ];
    const rootInput = { ...lesson, body: "The client starts the handshake." };
    listen.mockResolvedValueOnce({ ...digest, followUpQuestions: questions });
    const root = await teachLesson(deps, rootInput);
    expect(root.status).toBe("ok");
    if (root.status !== "ok") throw new Error("Expected a saved root lesson");

    const answerCard = create("SYN", "The client starts with SYN", "syn");
    const ungrounded = create(
      "Handshake",
      "The client starts it",
      "The client starts the handshake",
    );
    listen.mockResolvedValueOnce({ ...digest, operations: [answerCard, ungrounded] });

    const result = await answerFollowUp(deps, {
      ...scope,
      body: "SYN",
      lessonId: root.page.id,
      idempotencyKey: "first-answer",
    });

    const listenerInput = listen.mock.calls[1]?.[0];
    expect(listenerInput?.page).toMatchObject({
      body: "SYN",
      parentLessonId: root.page.id,
    });
    expect(listenerInput?.context?.rootLesson).toBe(rootInput.body);
    for (const question of questions) {
      expect(listenerInput?.context?.nogQuestion).toContain(question);
    }
    expect(result.status).toBe("ok");
    expect(applyDigest.mock.calls[1]?.[0].operations).toEqual([
      { ...answerCard, quote: "SYN" },
    ]);
    expect(stores.cards).toEqual([
      expect.objectContaining({ label: "SYN", quote: "SYN" }),
    ]);
  });
});
