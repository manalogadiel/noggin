import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
  createCardOp, createLesson, createNog, eq, exactlyOne, expectDenied, expectNoRows,
  lessonBody, localDb, success, type Lesson, type LocalDb, type Row,
} from "./helpers";
import { insertFixture, privateTopic } from "./topics-data-fixtures";

vi.setConfig({ testTimeout: 25_000, hookTimeout: 15_000 });

const migrations = new URL("../../supabase/migrations/", import.meta.url);
const memoryMigration = "20261122000008_card_memory.sql";
const originalTimestamp = "2001-01-01T00:00:00+00:00";
const reinforcedQuote = "The SYN opens the handshake.";
const mergedQuote = "The SYN carries a sequence number.";
const conflictQuote = "The ACK supposedly starts the handshake.";

type Evidence = {
  lesson_id: string;
  kind: "taught" | "reinforced" | "merged" | "conflict";
  quote: string;
};
type Digest = { applied: boolean; card_ids: string[]; saved_digest: unknown };
type AskExchange = { question_id: string; answer_id: string };
type SearchHit = Row & { nog_id: string; topic_id: string; evidence_count: number; score: number };
type CardState = { strength: number; status: string; updated_at: string };

async function fixture() {
  const db = localDb();
  const { subject, topic } = await db.tcpTopic();
  const owner = await db.createUser();
  const nog = await createNog(db, owner.id, subject.id);
  return { db, subject, topic, owner, nog };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function additionalTopic({ db, subject, owner, nog }: Fixture) {
  const topic = await insertFixture(db, "topics", privateTopic(subject.id, owner.id));
  onTestFinished(async () => {
    success(await db.admin.rows("lessons", {
      nog_id: eq(nog.id), topic_id: eq(topic.id),
    }, "DELETE"), "Remove lessons before removing their private topic");
  });
  return topic;
}

function applyDigest(
  { db, nog, owner }: Fixture,
  lesson: Lesson,
  ops: Record<string, unknown>[],
  options = {},
) {
  return db.admin.rpc<Digest>("apply_lesson_digest", {
    p_nog_id: nog.id, p_owner_id: owner.id, p_idempotency_key: lesson.idempotency_key,
    p_ops: ops, p_messages: [], ...options,
  });
}

async function teachCard(
  f: Fixture,
  { topicId = f.topic.id, label = "SYN", paraphrase = createCardOp().paraphrase } = {},
) {
  const lesson = await createLesson(f.db, f.nog.id, topicId);
  const result = success(await applyDigest(f, lesson, [{ ...createCardOp(), label, paraphrase }]), "Teach a card");
  expect(result.card_ids).toHaveLength(1);
  return { lesson, cardId: result.card_ids[0] };
}

async function evidence(client: LocalDb["admin"], cardId: string) {
  return success(await client.rows<Evidence>("card_evidence", {
    card_id: eq(cardId), select: "lesson_id,kind,quote", order: "kind.asc,lesson_id.asc",
  }), "Read card evidence");
}

async function cardState(db: LocalDb, cardId: string) {
  return exactlyOne(await db.admin.rows<CardState>("thought_cards", {
    id: eq(cardId), select: "strength,status,updated_at",
  }), "Read card state");
}

function reinforce(cardId: string, quote = reinforcedQuote) {
  return { type: "reinforce", card_id: cardId, quote };
}

function searchArgs(nogId: string, topicId: string | null = null, query = "syn", limit: number | null = 8) {
  return { p_nog_id: nogId, p_topic_id: topicId, p_query: query, p_limit: limit };
}

function askArgs({ owner, nog }: Fixture, mood: string | null = "happy") {
  return {
    p_owner_id: owner.id, p_nog_id: nog.id, p_question: "What starts the handshake?",
    p_answer: "The client sends a SYN.", p_mood: mood,
  };
}

function psql(database: string, sql: string, operation: string) {
  // The database CI job starts this local container from supabase/config.toml.
  const result = spawnSync("docker", [
    "exec", "-i", "supabase_db_noggin", "psql", "-X", "-qAtw", "-U", "postgres",
    "-d", database, "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-",
  ], { input: sql, encoding: "utf8", timeout: 15_000 });
  if (result.error || result.status !== 0) {
    const state = result.stderr?.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5})\b/)?.[1];
    throw new Error(`${operation} failed (psql ${result.error?.name ?? result.status}, SQLSTATE ${state ?? "none"})`);
  }
  return result.stdout.trim();
}

describe("card memory migration", () => {
  it("backfills every legacy card once with its original lesson, quote and timestamp, and merges ask caps", () => {
    const migration = new URL(memoryMigration, migrations);
    expect(existsSync(migration), `Missing migration supabase/migrations/${memoryMigration}`).toBe(true);
    const baseline = readdirSync(migrations)
      .filter((name) => /^\d{14}_.+\.sql$/.test(name) && name < memoryMigration)
      .sort()
      .map((name) => readFileSync(new URL(name, migrations), "utf8"))
      .join("\n");

    // Supabase starts with all migrations applied. Use a fresh database so the cards really predate migration 8.
    const database = `card_memory_${randomUUID().replaceAll("-", "")}`;
    psql("postgres", `CREATE DATABASE ${database} TEMPLATE template0;`, "Create isolated migration database");
    try {
      const result = psql(database, `
        CREATE SCHEMA extensions;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
        CREATE SCHEMA storage;
        CREATE TABLE storage.buckets (
          id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
        );
        ${baseline}
        ${readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8")}
        UPDATE public.plans SET caps = (caps - 'ask') || '{"fixture_cap":9}'::jsonb;
        CREATE TEMP TABLE prior_caps AS SELECT code, caps FROM public.plans;

        INSERT INTO auth.users (id, raw_user_meta_data)
        VALUES ('92eefc46-fc48-4264-851c-d13f2701d279', '{"birth_date":"1990-01-01"}');
        WITH nog AS (
          INSERT INTO public.nogs (owner_id, subject_id, name)
          SELECT '92eefc46-fc48-4264-851c-d13f2701d279', id, 'Legacy card fixture'
          FROM public.subjects WHERE slug = 'networking' RETURNING id, subject_id
        )
        INSERT INTO public.lessons (nog_id, topic_id, body, word_count, idempotency_key)
        SELECT nog.id, t.id, 'First SYN. Second ACK.', 4, 'legacy-card-memory'
        FROM nog JOIN public.topics t ON t.subject_id = nog.subject_id AND t.slug = 'tcp-handshake';

        SET ROLE service_role;
        INSERT INTO public.thought_cards (nog_id, topic_id, source_lesson_id, label, paraphrase, status, quote, created_at)
        SELECT l.nog_id, l.topic_id, l.id, v.label, v.quote, 'understood', v.quote, v.created_at::timestamptz
        FROM public.lessons l CROSS JOIN (VALUES
          ('SYN', 'First SYN.', '2001-01-01T00:00:00Z'), ('ACK', 'Second ACK.', '2002-01-01T00:00:00Z')
        ) AS v(label, quote, created_at)
        WHERE l.idempotency_key = 'legacy-card-memory';
        RESET ROLE;

        ${readFileSync(migration, "utf8")}

        SELECT jsonb_build_object(
          'legacyCards', (SELECT count(*) FROM public.thought_cards),
          'evidenceRows', (SELECT count(*) FROM public.card_evidence),
          'cardsWithOneMatchingRow', (
            SELECT count(*) FROM public.thought_cards c
            WHERE (SELECT count(*) FROM public.card_evidence e WHERE e.card_id = c.id
              AND e.lesson_id = c.source_lesson_id AND e.quote = c.quote
              AND e.created_at = c.created_at AND e.kind = 'taught') = 1
          ),
          'plansWithMergedCaps', (
            SELECT count(*) FROM prior_caps old JOIN public.plans p USING (code)
            WHERE p.code IN ('free', 'plus')
              AND p.caps = old.caps || jsonb_build_object('ask', CASE p.code WHEN 'free' THEN 15 ELSE 100 END)
          )
        );
      `, "Apply migration to legacy cards and verify backfill and caps");
      expect(JSON.parse(result)).toEqual({
        legacyCards: 2, evidenceRows: 2, cardsWithOneMatchingRow: 2, plansWithMergedCaps: 2,
      });
    } finally {
      psql("postgres", `DROP DATABASE ${database};`, "Remove isolated migration database");
    }
  });

  it("sets the planned function security and an empty search path", () => {
    const migration = new URL(memoryMigration, migrations);
    expect(existsSync(migration), `Missing migration supabase/migrations/${memoryMigration}`).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const [name, mode] of [
      ["apply_lesson_digest", "definer"], ["save_ask_exchange", "definer"], ["search_thought_cards", "invoker"],
    ]) {
      const header = sql.match(new RegExp(
        String.raw`create\s+(?:or\s+replace\s+)?function\s+public\.${name}\s*\([\s\S]*?\bas\s+\$\w*\$`, "i",
      ))?.[0];
      expect(header, `${name} definition`).toMatch(new RegExp(String.raw`\bsecurity\s+${mode}\b`, "i"));
      expect(header, `${name} search path`).toMatch(/\bset\s+search_path\s*(?:=|to)\s*''/i);
    }
  });

  it("seeds the free and plus ask caps alongside all existing caps", async () => {
    const { admin } = localDb();
    const plans = success(await admin.rows("plans", { select: "code,caps", order: "code.asc" }), "Read seeded caps");
    expect(plans).toEqual([
      { code: "free", caps: { listener: 10, answer: 5, grade: 5, stt_seconds: 300, tts_chars: 1000, pet: 50, generate: 5, ask: 15 } },
      { code: "plus", caps: { listener: 60, answer: 40, grade: 40, stt_seconds: 1800, tts_chars: 15000, pet: 200, generate: 20, ask: 100 } },
    ]);
  });
});

describe("card evidence and lesson digests", () => {
  it("records taught evidence for create and replays the same evidence once", async () => {
    const f = await fixture();
    const { lesson, cardId } = await teachCard(f);
    expect(success(await applyDigest(f, lesson, [createCardOp()]), "Replay create")).toMatchObject({
      applied: false, card_ids: [cardId],
    });
    expect(await evidence(f.db.admin, cardId)).toEqual([{ lesson_id: lesson.id, kind: "taught", quote: lessonBody }]);
  });

  it("allows an owner to read evidence, hides it from other users and anon, and denies client writes", async () => {
    const f = await fixture();
    const { lesson, cardId } = await teachCard(f);
    const owner = await f.db.signIn(f.owner);
    const otherUser = await f.db.signIn(await f.db.createUser());
    const query = { card_id: eq(cardId) };
    expect(await evidence(owner, cardId)).toEqual([{ lesson_id: lesson.id, kind: "taught", quote: lessonBody }]);
    expect(success(await otherUser.rows("card_evidence", query), "Read another owner's evidence")).toEqual([]);
    expectNoRows(await f.db.anon.rows("card_evidence", query), "Anonymous evidence access");
    expectDenied(await owner.rows("card_evidence", {}, "POST", {
      card_id: cardId, lesson_id: lesson.id, kind: "merged", quote: mergedQuote,
    }), "Authenticated evidence insert");
    expectDenied(await owner.rows("card_evidence", query, "PATCH", { quote: mergedQuote }), "Authenticated evidence update");
    expectDenied(await owner.rows("card_evidence", query, "DELETE"), "Authenticated evidence delete");
    success(await f.db.admin.rows("card_evidence", {}, "POST", {
      card_id: cardId, lesson_id: lesson.id, kind: "merged", quote: mergedQuote,
    }), "Service role writes evidence");
    expect(await evidence(owner, cardId)).toHaveLength(2);
  });

  it("cascades evidence deletion when either its card or its lesson is removed", async () => {
    const f = await fixture();
    const { cardId } = await teachCard(f);
    const repeat = await createLesson(f.db, f.nog.id, f.topic.id);
    success(await applyDigest(f, repeat, [reinforce(cardId)]), "Reinforce card before removing the lesson");
    expect(await evidence(f.db.admin, cardId)).toHaveLength(2);
    success(await f.db.admin.rows("lessons", { id: eq(repeat.id) }, "DELETE"), "Remove the reinforcing lesson");
    expect((await evidence(f.db.admin, cardId)).map(({ kind }) => kind)).toEqual(["taught"]);
    success(await f.db.admin.rows("thought_cards", { id: eq(cardId) }, "DELETE"), "Remove card");
    expect(await evidence(f.db.admin, cardId)).toEqual([]);
  });

  it("increments strength, bumps updated_at, and preserves status when reinforce omits it", async () => {
    const f = await fixture();
    const { cardId, lesson: source } = await teachCard(f);
    const repeat = await createLesson(f.db, f.nog.id, f.topic.id);
    success(await f.db.admin.rows("thought_cards", { id: eq(cardId) }, "PATCH", {
      strength: 4, status: "confused", updated_at: originalTimestamp,
    }), "Set the card's initial state");
    const before = await cardState(f.db, cardId);
    expect(success(await applyDigest(f, repeat, [reinforce(cardId)]), "Reinforce without status")).toMatchObject({
      applied: true, card_ids: [cardId],
    });
    const after = await cardState(f.db, cardId);
    expect(after).toMatchObject({ strength: before.strength + 1, status: "confused" });
    expect(Date.parse(after.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
    expect(await evidence(f.db.admin, cardId)).toEqual([
      { lesson_id: repeat.id, kind: "reinforced", quote: reinforcedQuote },
      { lesson_id: source.id, kind: "taught", quote: lessonBody },
    ]);

    const next = await createLesson(f.db, f.nog.id, f.topic.id);
    success(await applyDigest(f, next, [{ ...reinforce(cardId), status: "shaky" }]), "Reinforce with status");
    expect(await cardState(f.db, cardId)).toMatchObject({ strength: after.strength + 1, status: "shaky" });
  });

  it("stores one evidence row per quoted kind per lesson and preserves the original quote", async () => {
    const f = await fixture();
    const { cardId, lesson: source } = await teachCard(f);
    const repeat = await createLesson(f.db, f.nog.id, f.topic.id);
    const update = { type: "update", card_id: cardId, quote: mergedQuote };
    const conflict = { type: "conflict", card_id: cardId, quote: conflictQuote };
    success(await applyDigest(f, repeat, [
      reinforce(cardId), reinforce(cardId, lessonBody), update, { ...update, quote: lessonBody },
      conflict, { ...conflict, quote: lessonBody },
    ]), "Apply repeated evidence operations");
    const unquoted = await createLesson(f.db, f.nog.id, f.topic.id);
    success(await applyDigest(f, unquoted, [
      { type: "update", card_id: cardId, label: "SYN revisited" }, { type: "conflict", card_id: cardId },
    ]), "Apply operations without quotes");
    expect(await evidence(f.db.admin, cardId)).toEqual([
      { lesson_id: repeat.id, kind: "conflict", quote: conflictQuote },
      { lesson_id: repeat.id, kind: "merged", quote: mergedQuote },
      { lesson_id: repeat.id, kind: "reinforced", quote: reinforcedQuote },
      { lesson_id: source.id, kind: "taught", quote: lessonBody },
    ]);
  });

  it("keeps the legacy create, update and conflict result shape on apply and replay", async () => {
    const f = await fixture();
    const { cardId } = await teachCard(f);
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    const savedDigest = { reply: "I can explain SYN now.", questions: [] };
    const args = {
      p_nog_id: f.nog.id, p_idempotency_key: lesson.idempotency_key,
      p_ops: [createCardOp(), { type: "update", card_id: cardId, label: "SYN revisited" }, { type: "conflict", card_id: cardId }],
      p_messages: [{ role: "nog", kind: "reply", body: savedDigest.reply }], p_digest: savedDigest,
    };
    const applied = success(await f.db.admin.rpc<Digest>("apply_lesson_digest", args), "Apply legacy digest");
    expect(applied.card_ids[0]).toMatch(/^[0-9a-f-]{36}$/i);
    const expected = { applied: true, card_ids: [applied.card_ids[0], cardId, cardId], saved_digest: savedDigest };
    expect(applied).toEqual(expected);
    expect(success(await f.db.admin.rpc("apply_lesson_digest", args), "Replay legacy digest")).toEqual({
      ...expected, applied: false,
    });
    expect(await evidence(f.db.admin, applied.card_ids[0])).toEqual([
      { lesson_id: lesson.id, kind: "taught", quote: lessonBody },
    ]);
  });

  it.each(["another Nog", "another topic"])("rolls back the digest when reinforce targets %s", async (scope) => {
    const f = await fixture();
    const own = await teachCard(f);
    const target = scope === "another Nog"
      ? await teachCard(await fixture())
      : await teachCard(f, { topicId: (await additionalTopic(f)).id });
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    const before = await Promise.all([own, target].map(async ({ cardId }) => ({
      card: await cardState(f.db, cardId), evidence: await evidence(f.db.admin, cardId),
    })));
    expect(await applyDigest(f, lesson, [reinforce(own.cardId), reinforce(target.cardId)])).toMatchObject({
      ok: false, code: "P0001",
    });
    for (const [index, { cardId }] of [own, target].entries()) {
      expect(await cardState(f.db, cardId)).toEqual(before[index].card);
      expect(await evidence(f.db.admin, cardId)).toEqual(before[index].evidence);
    }
    expect(exactlyOne(await f.db.admin.rows<Lesson>("lessons", { id: eq(lesson.id) }), "Read rolled back lesson").digest_status)
      .toBe("pending");
  });

  it("rejects missing reinforce inputs, oversized quotes and invalid statuses without writing evidence", async () => {
    const f = await fixture();
    const { cardId } = await teachCard(f);
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    const before = await cardState(f.db, cardId);
    for (const op of [
      { type: "reinforce", quote: reinforcedQuote }, { type: "reinforce", card_id: cardId },
      reinforce(cardId, ""), reinforce(cardId, "x".repeat(301)), { ...reinforce(cardId), status: "wrong" },
    ]) {
      expect(await applyDigest(f, lesson, [op])).toMatchObject({ ok: false, code: "P0001" });
    }
    expect(await cardState(f.db, cardId)).toEqual(before);
    expect((await evidence(f.db.admin, cardId)).map(({ kind }) => kind)).toEqual(["taught"]);
  });

  it("preserves the digest owner check and rejects ask messages in a digest", async () => {
    const f = await fixture();
    const other = await f.db.createUser();
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    expect(await applyDigest(f, lesson, [createCardOp()], { p_owner_id: other.id })).toMatchObject({
      ok: false, code: "P0001",
    });
    for (const kind of ["ask", "ask_answer"]) {
      expect(await applyDigest(f, lesson, [createCardOp()], {
        p_messages: [{ role: "nog", kind, body: "A fixture message" }],
      })).toMatchObject({ ok: false, code: "P0001" });
    }
    expect(success(await f.db.admin.rows("nog_messages", { nog_id: eq(f.nog.id) }), "Read messages after rejection"))
      .toEqual([]);
    expect(success(await f.db.admin.rows("thought_cards", { nog_id: eq(f.nog.id) }), "Read cards after rejection"))
      .toEqual([]);
    const { card_ids: [cardId] } = success(await applyDigest(f, lesson, [createCardOp()]), "Retry with a valid digest");
    expect(await evidence(f.db.admin, cardId)).toHaveLength(1);
  });
});

describe("search_thought_cards", () => {
  it("ranks an exact label over a trigram paraphrase match and counts taught and reinforced evidence", async () => {
    const f = await fixture();
    const exact = await teachCard(f);
    const partial = await teachCard(f, { label: "Connection setup", paraphrase: "The client starts synchronization." });
    await teachCard(f, { label: "Window", paraphrase: "The window controls throughput." });
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    success(await applyDigest(f, lesson, [
      reinforce(exact.cardId), { type: "update", card_id: exact.cardId, quote: mergedQuote },
      { type: "conflict", card_id: exact.cardId, quote: conflictQuote },
    ]), "Add search evidence of different kinds");
    const client = await f.db.signIn(f.owner);
    const hits = success(await client.rpc<SearchHit[]>("search_thought_cards", searchArgs(f.nog.id)), "Search thought cards");
    expect(hits.map(({ id, evidence_count }) => ({ id, evidence_count }))).toEqual([
      { id: exact.cardId, evidence_count: 2 }, { id: partial.cardId, evidence_count: 1 },
    ]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[1].score).toBeGreaterThan(0);
  });

  it("searches all of the Nog's topics on null, filters by topic, and hides another user's Nog", async () => {
    const f = await fixture();
    const extraTopic = await additionalTopic(f);
    const first = await teachCard(f);
    const extra = await teachCard(f, { topicId: extraTopic.id });
    const owner = await f.db.signIn(f.owner);
    const stranger = await f.db.signIn(await f.db.createUser());
    const all = success(await owner.rpc<SearchHit[]>("search_thought_cards", searchArgs(f.nog.id)), "Search all topics");
    expect(all.map(({ id }) => id).sort()).toEqual([first.cardId, extra.cardId].sort());
    const filtered = success(await owner.rpc<SearchHit[]>("search_thought_cards", searchArgs(f.nog.id, extraTopic.id)), "Search one topic");
    expect(filtered).toMatchObject([{ id: extra.cardId, nog_id: f.nog.id, topic_id: extraTopic.id }]);
    expect(success(await stranger.rpc<SearchHit[]>("search_thought_cards", searchArgs(f.nog.id)), "Search another user's Nog"))
      .toEqual([]);
    expectDenied(await f.db.anon.rpc("search_thought_cards", searchArgs(f.nog.id)), "Anonymous search");
    expectDenied(await f.db.admin.rpc("search_thought_cards", searchArgs(f.nog.id)), "Service role search");
  });

  it("rejects blank, null and oversized queries and accepts operator punctuation", async () => {
    const f = await fixture();
    await teachCard(f);
    const client = await f.db.signIn(f.owner);
    for (const query of ["", " \t ", null, "x".repeat(501)]) {
      expect(await client.rpc("search_thought_cards", { ...searchArgs(f.nog.id), p_query: query })).toMatchObject({ ok: false });
    }
    for (const query of ["syn & | !( ", "x".repeat(500)]) {
      expect(Array.isArray(success(await client.rpc("search_thought_cards", searchArgs(f.nog.id, null, query)),
        "Search accepted at a valid query length"))).toBe(true);
    }
  });

  it("clamps result limits to 1–20 with an eight-row default", async () => {
    const f = await fixture();
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    const ops = Array.from({ length: 24 }, (_, index) => ({ ...createCardOp(), label: `SYN example ${index}` }));
    expect(success(await applyDigest(f, lesson, ops), "Teach 24 matching cards").card_ids).toHaveLength(24);
    const client = await f.db.signIn(f.owner);
    for (const [limit, count] of [[1000, 20], [3, 3], [0, 1], [null, 8]] as const) {
      const rows = success(await client.rpc<SearchHit[]>("search_thought_cards", searchArgs(f.nog.id, null, "syn", limit)), "Search with a result limit");
      expect(rows).toHaveLength(count);
    }
  });
});

describe("save_ask_exchange", () => {
  it("writes the student question and Nog answer without lessons and returns their IDs", async () => {
    const f = await fixture();
    const input = askArgs(f);
    const saved = success(await f.db.admin.rpc<AskExchange>("save_ask_exchange", input), "Save ask exchange");
    const owner = await f.db.signIn(f.owner);
    const messages = success(await owner.rows("nog_messages", {
      nog_id: eq(f.nog.id), select: "id,lesson_id,role,kind,body,mood", order: "kind.asc",
    }), "Read saved ask exchange");
    expect(messages).toEqual([
      { id: saved.question_id, lesson_id: null, role: "student", kind: "ask", body: input.p_question, mood: null },
      { id: saved.answer_id, lesson_id: null, role: "nog", kind: "ask_answer", body: input.p_answer, mood: input.p_mood },
    ]);
    expect(saved.question_id).not.toBe(saved.answer_id);
  });

  it("denies authenticated and anonymous calls to the save and digest RPCs", async () => {
    const f = await fixture();
    const lesson = await createLesson(f.db, f.nog.id, f.topic.id);
    const owner = await f.db.signIn(f.owner);
    for (const client of [owner, f.db.anon]) {
      expectDenied(await client.rpc("save_ask_exchange", askArgs(f)), "Client saves an ask exchange");
      expectDenied(await client.rpc("apply_lesson_digest", {
        p_nog_id: f.nog.id, p_owner_id: f.owner.id, p_idempotency_key: lesson.idempotency_key,
        p_ops: [createCardOp()], p_messages: [],
      }), "Client applies a lesson digest");
    }
  });

  it("rejects a foreign owner and invalid message lengths without inserting either message", async () => {
    const f = await fixture();
    const other = await f.db.createUser();
    const input = askArgs(f);
    expect(await f.db.admin.rpc("save_ask_exchange", { ...input, p_owner_id: other.id })).toMatchObject({
      ok: false, code: "P0001",
    });
    for (const invalid of [
      { p_question: "" }, { p_question: "q".repeat(401) },
      { p_answer: "" }, { p_answer: "a".repeat(601) }, { p_mood: "m".repeat(21) },
    ]) {
      expect(await f.db.admin.rpc("save_ask_exchange", { ...input, ...invalid })).toMatchObject({ ok: false });
    }
    expect(success(await f.db.admin.rows("nog_messages", { nog_id: eq(f.nog.id) }), "Read messages after rejected exchange"))
      .toEqual([]);

    success(await f.db.admin.rpc("save_ask_exchange", {
      ...askArgs(f, null), p_question: "q".repeat(400), p_answer: "a".repeat(600),
    }), "Save a maximum-length exchange with no mood");
  });
});
