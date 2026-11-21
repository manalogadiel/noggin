import { readFileSync } from "node:fs";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { repositoriesFor } from "../../src/adapters/supabase/__tests__/fixtures";
import {
  birthDate, createNog, credentials, eq, exactlyOne, expectDenied, expectNoRows, lessonInput, localDb, success,
  type LocalDb, type Row,
} from "./helpers";
import { insertFixture, privateTopic, topicUsers, uniqueSlug, type Subject, type Topic } from "./topics-data-fixtures";

vi.setConfig({ testTimeout: 25_000, hookTimeout: 15_000 });

const migration = new URL("../../supabase/migrations/20261121000005_custom_topics.sql", import.meta.url);
const seed = new URL("../../supabase/seed.sql", import.meta.url);

describe("custom topics schema and reset inputs", () => {
  it("ships migration 5 and reseeds official rows using their owner-scoped conflict targets", () => {
    const migrationSql = readFileSync(migration, "utf8");
    const sql = readFileSync(seed, "utf8");
    expect(sql).toMatch(/on\s+conflict\s*\(\s*owner_id\s*,\s*slug\s*\)|on\s+conflict\s+on\s+constraint\s+subjects_owner_id_slug_key/i);
    expect(sql).toMatch(/on\s+conflict\s*\(\s*subject_id\s*,\s*owner_id\s*,\s*slug\s*\)|on\s+conflict\s+on\s+constraint\s+topics_subject_id_owner_id_slug_key/i);
    expect(sql).not.toMatch(/on\s+conflict\s*\(\s*(?:subject_id\s*,\s*)?slug\s*\)/i);
    expect(migrationSql).toMatch(/public\.plans[^;]*\bgenerate\b/i);
    expect(sql).toMatch(/'free',\s*'[^']+',\s*'\{[^}]*"generate"\s*:\s*5\b/i);
    expect(sql).toMatch(/'plus',\s*'[^']+',\s*'\{[^}]*"generate"\s*:\s*20\b/i);
  });

  it("seeds the generate cap for both plans, and quota enforces each cap", async () => {
    const db = localDb();
    const plans = success(await db.admin.rows<{ code: string; caps: { generate: number } }>("plans", {
      select: "code,caps", code: "in.(free,plus)", order: "code",
    }), "Read seeded generation caps");
    expect(plans.map(({ code, caps }) => [code, caps.generate])).toEqual([["free", 5], ["plus", 20]]);

    for (const { code, caps: { generate } } of plans) {
      const user = await db.createUser();
      success(await db.admin.rows("profiles", { id: eq(user.id) }, "PATCH", { plan_code: code }), "Set fixture plan");
      const consume = (amount: number) => db.admin.rpc<{ allowed: boolean }>("consume_usage_quota", {
        p_user_id: user.id, p_kind: "generate", p_amount: amount,
      });
      expect(success(await consume(generate), "Consume generation allowance")).toMatchObject({ allowed: true });
      expect(success(await consume(1), "Check exhausted generation allowance")).toMatchObject({ allowed: false });
    }
  });

  it("serves ready TCP metadata and its count to a session with the question table locked down (SEC-T5)", async () => {
    const db = localDb();
    const { topic } = await db.tcpTopic();
    const session = await db.signIn(await db.createUser());
    const query = { topic_id: eq(topic.id), select: "reference_answer,key_concepts,source_excerpt" };
    expectDenied(await session.rows("questions", query), "Read TCP rubric as a session");
    expectDenied(await db.anon.rows("questions", query), "Read TCP rubric anonymously");
    expect(success(await db.admin.rows("questions", query), "Read seeded server-side questions")).toHaveLength(8);
    const row = exactlyOne(await session.rows<Topic>("topics", { id: eq(topic.id) }),
      "Read client-safe TCP topic metadata");
    expect(row).toMatchObject({
      id: topic.id, title: "TCP handshake", owner_id: null, status: "ready", question_count: 8,
    });
    for (const column of ["reference_answer", "key_concepts", "source_excerpt", "questions"]) {
      expect(row).not.toHaveProperty(column);
    }
  });

  it("allows the same subject and topic slug for different users, and makes NULL-owner slugs unique", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const slug = uniqueSlug("shared");
    const officialSubject = { slug, name: slug, owner_id: null };
    await insertFixture<Subject>(db, "subjects", officialSubject);
    for (const owner of [userA, userB]) {
      await insertFixture<Subject>(db, "subjects", { ...officialSubject, owner_id: owner.id });
      expect(await db.admin.rows("subjects", {}, "POST", {
        ...officialSubject, owner_id: owner.id, name: uniqueSlug("distinct-name"),
      })).toMatchObject({ ok: false, code: "23505" });
    }
    expect(await db.admin.rows("subjects", {}, "POST", {
      ...officialSubject, name: uniqueSlug("distinct-name"),
    })).toMatchObject({ ok: false, code: "23505" });

    const officialTopic = {
      subject_id: subject.id, owner_id: null, slug, title: slug, visibility: "public", trust_level: "official",
    };
    await insertFixture<Topic>(db, "topics", officialTopic);
    for (const owned of [privateTopic(subject.id, userA.id, slug), privateTopic(subject.id, userB.id, slug)]) {
      await insertFixture<Topic>(db, "topics", owned);
      expect(await db.admin.rows("topics", {}, "POST", { ...owned, title: "Another title" }))
        .toMatchObject({ ok: false, code: "23505" });
    }
    expect(await db.admin.rows("topics", {}, "POST", { ...officialTopic, title: "Another title" }))
      .toMatchObject({ ok: false, code: "23505" });
  });

  it("defaults an owned topic to private/community and rejects invalid official metadata and status", async () => {
    const { db, subject, userA } = await topicUsers();
    const slug = uniqueSlug("defaults");
    const row = await insertFixture<Topic>(db, "topics", {
      owner_id: userA.id, subject_id: subject.id, slug, title: slug,
    });
    expect(row).toMatchObject({ visibility: "private", trust_level: "community", question_count: 0 });

    for (const fields of [
      { owner_id: userA.id, visibility: "public", trust_level: "official" },
      { owner_id: null, visibility: "private", trust_level: "official" },
      { owner_id: null, visibility: "public", trust_level: "community" },
    ]) {
      expect(await db.admin.rows("topics", { id: eq(row.id) }, "PATCH", fields))
        .toMatchObject({ ok: false, code: "23514" });
    }
    for (const status of ["pending", "ready"]) {
      expect(exactlyOne(await db.admin.rows<Topic>("topics", { id: eq(row.id) }, "PATCH", { status }),
        `Set topic to ${status}`)).toMatchObject({ status });
    }
    for (const status of ["active", "unexpected"]) {
      expect(await db.admin.rows("topics", { id: eq(row.id) }, "PATCH", { status }))
        .toMatchObject({ ok: false, code: "23514" });
    }
    expect(await db.admin.rows("topics", { id: eq(row.id) }, "PATCH", { question_count: null }))
      .toMatchObject({ ok: false, code: "23502" });
  });

  it("backfills question counts from existing questions and indexes both owner columns", () => {
    const sql = readFileSync(migration, "utf8");
    expect(sql.split(";")).toEqual(expect.arrayContaining([
      expect.stringMatching(/(?=[\s\S]*\bupdate\s+public\.topics\b)(?=[\s\S]*\bquestion_count\b)(?=[\s\S]*\bpublic\.questions\b)/i),
    ]));
    for (const table of ["subjects", "topics"]) {
      expect(sql).toMatch(new RegExp(String.raw`create\s+index\b[^;]*\bon\s+public\.${table}\s*(?:using\s+btree\s*)?\(\s*owner_id\s*\)`, "i"));
    }
  });

  it("cascades subject and topic ownership on account deletion, including topics under an official subject", async () => {
    const db = localDb();
    const { subject } = await db.tcpTopic();
    const userB = await db.createUser();
    const userA = success(await db.admin.request<Row>("/auth/v1/admin/users", "POST", {
      ...credentials(), email_confirm: true, user_metadata: { birth_date: birthDate(24) },
    }), "Create owner for deletion");
    let deleted = false;
    onTestFinished(async () => {
      if (!deleted) success(await db.admin.request(`/auth/v1/admin/users/${userA.id}`, "DELETE"), "Remove fixture owner");
    });
    const slug = uniqueSlug("deleted-owner");
    const owned = await insertFixture<Subject>(db, "subjects", { owner_id: userA.id, slug, name: slug });
    const privateRow = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userA.id, slug));
    const remaining = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userB.id, slug));

    success(await db.admin.request(`/auth/v1/admin/users/${userA.id}`, "DELETE"), "Delete fixture owner");
    deleted = true;
    expect(success(await db.admin.rows("subjects", { id: eq(owned.id) }), "Read deleted owner's subject")).toEqual([]);
    expect(success(await db.admin.rows("topics", { id: eq(privateRow.id) }), "Read deleted owner's topic")).toEqual([]);
    expect(exactlyOne(await db.admin.rows<Topic>("topics", { id: eq(remaining.id) }), "Read other owner's topic"))
      .toMatchObject({ owner_id: userB.id, visibility: "private" });
  });
});

describe("custom topic database authorization", () => {
  it("replaces the permissive subject and topic select policies (SEC-T1)", () => {
    const sql = readFileSync(migration, "utf8");
    expect(sql).toMatch(/drop\s+policy\s+(?:if\s+exists\s+)?"?subjects_select_available"?\s+on\s+public\.subjects/i);
    expect(sql).toMatch(/drop\s+policy\s+(?:if\s+exists\s+)?"?topics_select_visible"?\s+on\s+public\.topics/i);
  });

  it("hides A's available subject from B and anonymous readers (SEC-T1)", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const slug = uniqueSlug("owned-subject");
    const owned = await insertFixture<Subject>(db, "subjects", {
      owner_id: userA.id, slug, name: slug, available: true,
    });
    const a = await db.signIn(userA);
    const b = await db.signIn(userB);
    expect(exactlyOne(await a.rows<Row>("subjects", { id: eq(owned.id) }), "Read own subject").id).toBe(owned.id);
    for (const reader of [b, db.anon]) {
      expect(exactlyOne(await reader.rows<Row>("subjects", { id: eq(subject.id) }), "Read official subject").id)
        .toBe(subject.id);
      expect(success(await reader.rows("subjects", { id: eq(owned.id) }), "Query A's private subject")).toEqual([]);
    }
  });

  it("hides A's topics from B and anonymous readers on a shared subject (SEC-T1)", async () => {
    const { db, subject, topic, userA, userB } = await topicUsers();
    const privateRow = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userA.id));
    // A public/community row also needs to be owner-only under the replacement policy.
    const community = await insertFixture<Topic>(db, "topics", {
      ...privateTopic(subject.id, userA.id), visibility: "public",
    });
    const a = await db.signIn(userA);
    const b = await db.signIn(userB);
    const ids = { id: `in.(${privateRow.id},${community.id})` };
    expect(success(await a.rows<Row>("topics", ids), "Read own topics")).toHaveLength(2);
    for (const reader of [b, db.anon]) {
      expect(exactlyOne(await reader.rows<Row>("topics", { id: eq(topic.id) }), "Read official topic").id)
        .toBe(topic.id);
      expect.soft(success(await reader.rows("topics", ids), "Query A's topics")).toEqual([]);
    }
  });

  it("denies direct catalog writes to signed-in users and anonymous clients (SEC-T1)", async () => {
    const { db, subject, userA } = await topicUsers();
    const session = await db.signIn(userA);
    const slug = uniqueSlug("restricted");
    const owned = await insertFixture<Subject>(db, "subjects", { owner_id: userA.id, slug, name: slug });
    const topic = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userA.id));
    const questionInput = {
      topic_id: topic.id, position: 1, prompt: "What does a datagram carry?",
      reference_answer: "A payload.", key_concepts: ["datagram", "payload"], source_excerpt: "A datagram has a payload.",
    };
    const question = exactlyOne(await db.admin.rows<Row>("questions", {}, "POST", questionInput), "Create server rubric");
    const cases = [
      { table: "subjects", id: owned.id, create: { name: "Another subject", slug: uniqueSlug("another"), owner_id: userA.id }, update: { name: "Changed" } },
      { table: "topics", id: topic.id, create: privateTopic(subject.id, userA.id), update: { title: "Changed" } },
      { table: "questions", id: question.id, create: { ...questionInput, position: 2 }, update: { prompt: "Changed?" } },
    ];
    for (const client of [session, db.anon]) {
      for (const { table, id, create, update } of cases) {
        expectDenied(await client.rows(table, {}, "POST", create), `Insert into ${table} as a client`);
        expectNoRows(await client.rows(table, { id: eq(id) }, "PATCH", update), `Update ${table} as a client`);
        expectNoRows(await client.rows(table, { id: eq(id) }, "DELETE"), `Delete from ${table} as a client`);
      }
    }
  });

  it("joins mastery only to official topics and the Nog owner's topics even for the service role", async () => {
    const { db, subject, topic, userA, userB } = await topicUsers();
    const a = await createNog(db, userA.id, subject.id);
    const b = await createNog(db, userB.id, subject.id);
    const topicA = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userA.id));
    const topicB = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userB.id));
    for (const [nog, own] of [[a, topicA], [b, topicB]]) {
      const rows = success(await db.admin.rows<{ topic_id: string }>("topic_mastery", {
        nog_id: eq(nog.id), topic_id: `in.(${topic.id},${topicA.id},${topicB.id})`, select: "topic_id",
      }), "Read Nog topic mastery");
      expect(rows.map((row) => row.topic_id).sort()).toEqual([topic.id, own.id].sort());
    }
  });

  it("rejects direct lessons and follow-ups for a foreign topic or the wrong subject (SEC-T2)", async () => {
    const { db, subject, topic, userA, userB } = await topicUsers();
    const b = await db.signIn(userB);
    const nog = await createNog(db, userB.id, subject.id);
    const slug = uniqueSlug("other-subject");
    const other = await insertFixture<Subject>(db, "subjects", { slug, name: slug });
    const foreign = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userA.id));
    const wrongSubject = await insertFixture<Topic>(db, "topics", privateTopic(other.id, userB.id));
    const own = await insertFixture<Topic>(db, "topics", privateTopic(subject.id, userB.id));
    onTestFinished(async () => {
      success(await db.admin.rows("lessons", { nog_id: eq(nog.id), topic_id: eq(own.id) }, "DELETE"),
        "Remove lessons for private fixture");
    });

    for (const allowed of [topic, own]) {
      const root = exactlyOne(await b.rows<Row>("lessons", {}, "POST", lessonInput(nog.id, allowed.id)),
        "Insert authorized lesson");
      expect(success(await saveFollowUp(db, userB.id, root.id, nog.id, allowed.id), "Save authorized follow-up"))
        .toMatchObject({ status: "saved" });
    }

    for (const denied of [foreign, wrongSubject]) {
      // A historical row lets the follow-up test isolate its own authorization check.
      const root = await insertFixture<Row>(db, "lessons", lessonInput(nog.id, denied.id));
      onTestFinished(async () => {
        success(await db.admin.rows("lessons", { nog_id: eq(nog.id), topic_id: eq(denied.id) }, "DELETE"),
          "Remove lessons for historical fixture");
      });
      expect.soft(await b.rows("lessons", {}, "POST", lessonInput(nog.id, denied.id)))
        .toMatchObject({ ok: false, code: "42501" });
      expect.soft(await saveFollowUp(db, userB.id, root.id, nog.id, denied.id)).toMatchObject({ ok: false });
      expect.soft(await saveFollowUp(db, null, root.id, nog.id, denied.id)).toMatchObject({ ok: false });
      expect.soft(success(await db.admin.rows<Row>("lessons", {
        nog_id: eq(nog.id), topic_id: eq(denied.id), select: "id",
      }), "Check rejected writes left only the historical lesson")).toEqual([{ id: root.id }]);
    }
  });

  it("returns joined subject names for My Nogs from the real repository", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const slug = uniqueSlug("biology");
    const own = await insertFixture<Subject>(db, "subjects", {
      owner_id: userA.id, slug, name: "Marine Biology",
    });
    const officialNog = await createNog(db, userA.id, subject.id);
    const customNog = await createNog(db, userA.id, own.id);
    onTestFinished(async () => {
      success(await db.admin.rows("nogs", { id: eq(customNog.id) }, "DELETE"), "Remove Nog for private subject fixture");
    });
    await createNog(db, userB.id, subject.id);
    const { nogs } = await repositoriesFor(userA);
    const listed = await nogs.listByOwner(userA.id);
    expect(listed.map((row) => row.id).sort()).toEqual([officialNog.id, customNog.id].sort());
    expect(listed.find(({ id }) => id === officialNog.id)).toMatchObject({ subjectName: "Networking" });
    expect(listed.find(({ id }) => id === customNog.id)).toMatchObject({ subjectName: "Marine Biology" });
  });
});

function saveFollowUp(db: LocalDb, ownerId: string | null, parentId: string, nogId: string, topicId: string) {
  const page = lessonInput(nogId, topicId);
  return db.admin.rpc("save_follow_up_page", {
    p_owner_id: ownerId, p_parent_lesson_id: parentId, p_nog_id: nogId, p_topic_id: topicId,
    p_body: page.body, p_word_count: page.word_count, p_idempotency_key: page.idempotency_key, p_max: 2,
  });
}
