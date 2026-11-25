import { describe, expect, it } from "vitest";
import { createAskHistoryRepository } from "@/adapters/supabase/repositories/ask-history-repository";
import { createNotebookRepository } from "@/adapters/supabase/repositories/notebook-repository";
import { createThoughtCardRepository } from "@/adapters/supabase/repositories/thought-card-repository";
import { createSupabaseRepositories, SupabaseAdapterError } from "@/adapters/supabase/repositories";
import { callsOf, fakeClient, postgrestError } from "./fake-supabase";

const userId = "8d8f2a55-0d1c-4a51-9df4-0b7e8c3f4a11";
const nogId = "0c5a3c8e-1f0b-4bcb-9a7e-5f9a2d3e4b21";
const topicId = "3b1e9d7a-6c2f-4d8e-8a1b-9c0d1e2f3a41";

const cardRow = {
  id: "card-1",
  nog_id: nogId,
  topic_id: topicId,
  label: "Spring tide",
  paraphrase: "Spring tides have a larger tidal range.",
  status: "understood",
  strength: 3,
  interval_days: 2,
  next_review_at: "2026-11-24T00:00:00+00:00",
  source_lesson_id: "lesson-1",
  quote: "During a spring tide, the tidal range is larger.",
  evidence_count: 2,
  score: 0.71,
};

function lessonRow(id: string, body = `Body of ${id}`) {
  return {
    id,
    nog_id: nogId,
    topic_id: topicId,
    body,
    word_count: body.split(/\s+/).length,
    kind: "lesson",
    parent_lesson_id: null,
    idempotency_key: `key-${id}`,
    created_at: "2026-11-22T10:00:00+00:00",
  };
}

function repos(results: Parameters<typeof fakeClient>[0] = {}) {
  const session = fakeClient(results);
  const service = fakeClient(results);
  return {
    session,
    service,
    cards: createThoughtCardRepository({ session: session.client, service: service.client, userId }),
    notebook: createNotebookRepository({ session: session.client, service: service.client, userId }),
    history: createAskHistoryRepository({ session: session.client, service: service.client, userId }),
  };
}

async function expectSafeAdapterError(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(SupabaseAdapterError);
  expect(String((error as Error).message)).not.toMatch(/secret detail|thought_cards/);
}

describe("thought card search", () => {
  it("searches through the signed-in session with the ranked-search function and maps every field", async () => {
    const { cards, session, service } = repos({ rpcs: { search_thought_cards: [{ data: [cardRow], error: null }] } });

    const result = await cards.search!(nogId, topicId, "what is a spring tide?", 8);

    expect(session.rpcs).toEqual([{
      name: "search_thought_cards",
      args: { p_nog_id: nogId, p_topic_id: topicId, p_query: "what is a spring tide?", p_limit: 8 },
    }]);
    expect(service.rpcs).toEqual([]);
    expect(result).toEqual([{
      id: "card-1",
      nogId,
      topicId,
      label: "Spring tide",
      paraphrase: "Spring tides have a larger tidal range.",
      status: "understood",
      strength: 3,
      intervalDays: 2,
      nextReviewAt: expect.any(String),
      sourceLessonId: "lesson-1",
      quote: "During a spring tide, the tidal range is larger.",
      evidenceCount: 2,
      score: 0.71,
    }]);
  });

  it("passes a null topic for all-topic searches and returns [] for no rows", async () => {
    const { cards, session } = repos({ rpcs: { search_thought_cards: [{ data: null, error: null }] } });

    await expect(cards.search!(nogId, null, "tides", 8)).resolves.toEqual([]);
    expect(session.rpcs[0]?.args).toMatchObject({ p_topic_id: null });
  });

  it("raises a safe adapter error when the search fails", async () => {
    const { cards } = repos({ rpcs: { search_thought_cards: [{ data: null, error: postgrestError }] } });
    await expectSafeAdapterError(cards.search!(nogId, null, "tides", 8));
  });
});

describe("card evidence links", () => {
  it("returns [] without querying when no card ids are given", async () => {
    const { cards, session } = repos();
    await expect(cards.listEvidenceLessonIds!([])).resolves.toEqual([]);
    expect(session.queries).toEqual([]);
  });

  it("reads taught, reinforced and merged evidence for the cards, oldest first, through the session", async () => {
    const { cards, session, service } = repos({ tables: { card_evidence: [{
      data: [
        { card_id: "card-1", lesson_id: "lesson-1" },
        { card_id: "card-1", lesson_id: "lesson-2" },
        { card_id: "card-2", lesson_id: "lesson-3" },
      ],
      error: null,
    }] } });

    const links = await cards.listEvidenceLessonIds!(["card-1", "card-2", "card-1"]);

    expect(links).toEqual([
      { cardId: "card-1", lessonId: "lesson-1" },
      { cardId: "card-1", lessonId: "lesson-2" },
      { cardId: "card-2", lessonId: "lesson-3" },
    ]);
    const query = session.queries.find(({ table }) => table === "card_evidence");
    expect(query).toBeDefined();
    expect(service.queries).toEqual([]);
    expect(callsOf(query, "in")).toEqual(expect.arrayContaining([
      ["card_id", ["card-1", "card-2"]],
      ["kind", ["taught", "reinforced", "merged"]],
    ]));
    expect(callsOf(query, "order")[0]).toEqual(["created_at", { ascending: true }]);
  });

  it("raises a safe adapter error when evidence cannot be read", async () => {
    const { cards } = repos({ tables: { card_evidence: [{ data: null, error: postgrestError }] } });
    await expectSafeAdapterError(cards.listEvidenceLessonIds!(["card-1"]));
  });
});

describe("lesson pages by id", () => {
  it("returns [] without querying when no ids are given", async () => {
    const { notebook, session } = repos();
    await expect(notebook.findPagesByIds!(nogId, [])).resolves.toEqual([]);
    expect(session.queries).toEqual([]);
  });

  it("loads only this nog's pages and keeps the requested order", async () => {
    const { notebook, session } = repos({ tables: { lessons: [{
      data: [lessonRow("lesson-2"), lessonRow("lesson-1")],
      error: null,
    }] } });

    const pages = await notebook.findPagesByIds!(nogId, ["lesson-1", "lesson-2", "lesson-1", "lesson-9"]);

    expect(pages.map(({ id }) => id)).toEqual(["lesson-1", "lesson-2"]);
    expect(pages[0]).toMatchObject({ nogId, topicId, body: "Body of lesson-1", kind: "lesson" });
    const query = session.queries.find(({ table }) => table === "lessons");
    expect(callsOf(query, "eq")).toContainEqual(["nog_id", nogId]);
    expect(callsOf(query, "in")).toContainEqual(["id", ["lesson-1", "lesson-2", "lesson-9"]]);
  });

  it("raises a safe adapter error when pages cannot be read", async () => {
    const { notebook } = repos({ tables: { lessons: [{ data: null, error: postgrestError }] } });
    await expectSafeAdapterError(notebook.findPagesByIds!(nogId, ["lesson-1"]));
  });
});

describe("ask history", () => {
  const input = { ownerId: userId, nogId, question: "What is a spring tide?", answer: "A bigger tide!", mood: "happy" };

  it("saves both messages in one service call and returns their ids", async () => {
    const { history, session, service } = repos({ rpcs: { save_ask_exchange: [{
      data: { question_id: "msg-q", answer_id: "msg-a" },
      error: null,
    }] } });

    await expect(history.save(input)).resolves.toEqual({ questionMessageId: "msg-q", answerMessageId: "msg-a" });
    expect(service.rpcs).toEqual([{
      name: "save_ask_exchange",
      args: {
        p_owner_id: userId,
        p_nog_id: nogId,
        p_question: input.question,
        p_answer: input.answer,
        p_mood: "happy",
      },
    }]);
    expect(session.rpcs).toEqual([]);
  });

  it("refuses to save for anyone but the signed-in owner", async () => {
    const { history, service } = repos();
    await expect(history.save({ ...input, ownerId: "someone-else" })).rejects.toBeInstanceOf(SupabaseAdapterError);
    expect(service.rpcs).toEqual([]);
  });

  it("raises a safe adapter error when the save fails or returns no ids", async () => {
    const failing = repos({ rpcs: { save_ask_exchange: [{ data: null, error: postgrestError }] } });
    await expectSafeAdapterError(failing.history.save(input));
    const empty = repos({ rpcs: { save_ask_exchange: [{ data: {}, error: null }] } });
    await expect(empty.history.save(input)).rejects.toBeInstanceOf(SupabaseAdapterError);
  });

  it("pairs each question with its answer, newest first, and drops unpaired messages", async () => {
    const rows = [
      { id: "a3", nog_id: nogId, kind: "ask_answer", body: "Third answer", mood: "happy", created_at: "2026-11-22T10:05:01+00:00" },
      { id: "q3", nog_id: nogId, kind: "ask", body: "Third?", mood: null, created_at: "2026-11-22T10:05:00+00:00" },
      { id: "q2", nog_id: nogId, kind: "ask", body: "Orphan?", mood: null, created_at: "2026-11-22T10:03:00+00:00" },
      { id: "a1", nog_id: nogId, kind: "ask_answer", body: "First answer", mood: null, created_at: "2026-11-22T10:00:01+00:00" },
      { id: "q1", nog_id: nogId, kind: "ask", body: "First?", mood: null, created_at: "2026-11-22T10:00:00+00:00" },
    ];
    const { history, session } = repos({ tables: { nog_messages: [{ data: rows, error: null }] } });

    const exchanges = await history.listRecent(userId, nogId, 5);

    expect(exchanges).toEqual([
      {
        questionMessageId: "q3", answerMessageId: "a3", nogId,
        question: "Third?", answer: "Third answer", mood: "happy",
        createdAt: expect.stringMatching(/^2026-11-22T10:05:01/),
      },
      {
        questionMessageId: "q1", answerMessageId: "a1", nogId,
        question: "First?", answer: "First answer", mood: null,
        createdAt: expect.stringMatching(/^2026-11-22T10:00:01/),
      },
    ]);
    const query = session.queries.find(({ table }) => table === "nog_messages");
    expect(callsOf(query, "eq")).toContainEqual(["nog_id", nogId]);
    expect(callsOf(query, "in")).toContainEqual(["kind", ["ask", "ask_answer"]]);
    expect(callsOf(query, "order")[0]).toEqual(["created_at", { ascending: false }]);
    expect(callsOf(query, "limit")[0]?.[0]).toBeGreaterThanOrEqual(10);
  });

  it("caps the result at the limit", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => [
      { id: `a${index}`, nog_id: nogId, kind: "ask_answer", body: `A${index}`, mood: null, created_at: `2026-11-22T10:0${index}:01+00:00` },
      { id: `q${index}`, nog_id: nogId, kind: "ask", body: `Q${index}?`, mood: null, created_at: `2026-11-22T10:0${index}:00+00:00` },
    ]).flat().reverse();
    const { history } = repos({ tables: { nog_messages: [{ data: rows, error: null }] } });

    const exchanges = await history.listRecent(userId, nogId, 2);
    expect(exchanges.map(({ questionMessageId }) => questionMessageId)).toEqual(["q5", "q4"]);
  });

  it("returns nothing for another owner without querying", async () => {
    const { history, session } = repos();
    await expect(history.listRecent("someone-else", nogId, 5)).resolves.toEqual([]);
    expect(session.queries).toEqual([]);
  });

  it("raises a safe adapter error when history cannot be read", async () => {
    const { history } = repos({ tables: { nog_messages: [{ data: null, error: postgrestError }] } });
    await expectSafeAdapterError(history.listRecent(userId, nogId, 5));
  });
});

describe("repository bundle", () => {
  it("includes the ask history repository", () => {
    const { client } = fakeClient();
    const bundle = createSupabaseRepositories({ session: client, service: client, userId });
    expect(bundle.askHistory).toMatchObject({ save: expect.any(Function), listRecent: expect.any(Function) });
    expect(bundle.thoughtCards.search).toBeTypeOf("function");
    expect(bundle.thoughtCards.listEvidenceLessonIds).toBeTypeOf("function");
    expect(bundle.notebook.findPagesByIds).toBeTypeOf("function");
  });
});
