import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { eq, exactlyOne, expectDenied, success, type LocalDb, type Row } from "./helpers";
import { insertFixture, privateTopic, topicUsers, uniqueSlug, type Subject, type Topic } from "./topics-data-fixtures";

vi.setConfig({ testTimeout: 25_000, hookTimeout: 15_000 });

const migration = new URL("../../supabase/migrations/20261121000005_custom_topics.sql", import.meta.url);
const rpcNames = ["create_user_subject", "create_user_topic", "save_generated_questions"] as const;

function subjectArgs(ownerId: string, name: string, slug = uniqueSlug("subject")) {
  return { p_owner_id: ownerId, p_name: name, p_slug: slug };
}

function topicArgs(ownerId: string, subjectId: string, title: string, slug = uniqueSlug("topic")) {
  return { p_owner_id: ownerId, p_subject_id: subjectId, p_title: title, p_slug: slug };
}

function questions(count = 8, concepts = ["datagram", "payload"]) {
  return Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    prompt: `What does datagram ${i + 1} carry?`,
    reference_answer: "A datagram carries a payload.",
    source_excerpt: "Each datagram has a payload.",
    key_concepts: concepts,
  }));
}

function questionArgs(ownerId: string, topicId: string, generated = questions()) {
  return { p_owner_id: ownerId, p_topic_id: topicId, p_questions: generated };
}

function readTopic(db: LocalDb, id: string) {
  return db.admin.rows<Topic>("topics", { id: eq(id) });
}

describe("custom catalog RPC boundaries (SEC-T3)", () => {
  it.each(rpcNames)("%s is security definer with an empty search path", (name) => {
    const sql = readFileSync(migration, "utf8");
    const header = sql.match(new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+public\.${name}\s*\([\s\S]*?\bas\s+\$\w*\$`, "i"))?.[0];
    expect(header, `Missing SQL definition for ${name}`).toBeDefined();
    expect(header).toMatch(/\bsecurity\s+definer\b/i);
    expect(header).toMatch(/\bset\s+search_path\s*(?:=|to)\s*''/i);
  });

  it("denies all three RPCs to anonymous clients and even the topic owner", async () => {
    const { db, subject, userA } = await topicUsers();
    const a = await db.signIn(userA);
    const topic = await insertFixture<Topic>(db, "topics", {
      ...privateTopic(subject.id, userA.id), status: "pending",
    });
    const args = [
      subjectArgs(userA.id, "New subject"),
      topicArgs(userA.id, subject.id, "New topic"),
      questionArgs(userA.id, topic.id),
    ];
    for (const client of [a, db.anon]) {
      for (const [index, name] of rpcNames.entries()) {
        expect.soft(await client.rpc(name, args[index]), `Client execute on ${name}`)
          .toMatchObject({ ok: false, code: "42501" });
      }
    }
  });

  it("validates subject ownership, length, and case-insensitive uniqueness per owner", async () => {
    const { db, userA, userB } = await topicUsers();
    const title = "Physical Chemistry";
    const first = subjectArgs(userA.id, title);
    for (const name of ["", " ".repeat(5), "x".repeat(41)]) {
      expect.soft(await db.admin.rpc("create_user_subject", subjectArgs(userA.id, name))).toMatchObject({ ok: false });
    }
    expect.soft(await db.admin.rpc("create_user_subject", subjectArgs(randomUUID(), title))).toMatchObject({ ok: false });
    expect.soft(await db.admin.rpc("create_user_subject", { ...first, p_owner_id: null })).toMatchObject({ ok: false });
    success(await db.admin.rpc("create_user_subject", first), "Create user A's subject");
    expect(await db.admin.rpc("create_user_subject", subjectArgs(userA.id, title.toUpperCase())))
      .toMatchObject({ ok: false });
    success(await db.admin.rpc("create_user_subject", subjectArgs(userB.id, title.toUpperCase(), first.p_slug)),
      "Create user B's subject with the same slug");
    success(await db.admin.rpc("create_user_subject", subjectArgs(userA.id, "x".repeat(40))),
      "Create a subject at the 40-character limit");
    const rows = success(await db.admin.rows<Subject>("subjects", {
      slug: eq(first.p_slug), owner_id: `in.(${userA.id},${userB.id})`,
    }), "Read both created subjects");
    expect(rows.map((row) => row.owner_id).sort()).toEqual([userA.id, userB.id].sort());
  });

  it("validates topic titles and subject ownership, and rejects official slug collisions", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const slug = uniqueSlug("private-subject");
    const owned = await insertFixture<Subject>(db, "subjects", { owner_id: userA.id, slug, name: slug });
    for (const title of ["", " ".repeat(5), "x".repeat(61)]) {
      expect.soft(await db.admin.rpc("create_user_topic", topicArgs(userA.id, subject.id, title)))
        .toMatchObject({ ok: false });
    }
    expect.soft(await db.admin.rpc("create_user_topic", topicArgs(userB.id, owned.id, "Datagrams")))
      .toMatchObject({ ok: false });
    expect.soft(await db.admin.rpc("create_user_topic", {
      ...topicArgs(userA.id, subject.id, "Datagrams"), p_owner_id: null,
    })).toMatchObject({ ok: false });
    expect.soft(await db.admin.rpc("create_user_topic", topicArgs(userA.id, subject.id, "TCP handshake", "tcp-handshake")))
      .toMatchObject({ ok: false });
    const valid = topicArgs(userA.id, owned.id, "x".repeat(60));
    success(await db.admin.rpc("create_user_topic", valid), "Create a 60-character topic under own subject");
    expect(await createdTopic(db, valid)).toMatchObject({ status: "pending", title: valid.p_title });
    expect(success(await db.admin.rows("topics", { subject_id: eq(owned.id), owner_id: eq(userB.id) }),
      "Check user B created no topic on user A's subject")).toEqual([]);
  });

  it("reuses the owner's pending row, lets another owner use its slug, and refuses the ready duplicate", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const first = topicArgs(userA.id, subject.id, "Datagrams");
    const second = { ...first, p_owner_id: userB.id };
    success(await db.admin.rpc("create_user_topic", first), "Create pending topic");
    const pending = await createdTopic(db, first);
    expect(pending).toMatchObject({
      owner_id: userA.id, visibility: "private", trust_level: "community", status: "pending", question_count: 0,
    });
    const retry = success(await db.admin.rpc<Row>("create_user_topic", first), "Retry pending topic creation");
    expect(retry).toMatchObject({ id: pending.id });
    expect((await createdTopic(db, first)).id).toBe(pending.id);

    success(await db.admin.rpc("create_user_topic", second), "Create another user's topic with the same slug");
    expect((await createdTopic(db, second)).id).not.toBe(pending.id);

    success(await db.admin.rpc("save_generated_questions", questionArgs(userA.id, pending.id)), "Finalize first topic");
    expect(await db.admin.rpc("create_user_topic", first)).toMatchObject({ ok: false });
    expect(exactlyOne(await readTopic(db, pending.id), "Read finalized topic")).toMatchObject({ status: "ready" });
  });

  it("refuses B's write to A's pending topic and rejects malformed batches without changing topic state", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const slug = uniqueSlug("official");
    const official = await insertFixture<Topic>(db, "topics", {
      subject_id: subject.id, slug, title: slug, owner_id: null, visibility: "public", trust_level: "official",
    });
    const args = topicArgs(userA.id, subject.id, "UDP payloads");
    success(await db.admin.rpc("create_user_topic", args), "Create A's pending topic");
    const pending = await createdTopic(db, args);
    for (const invalid of [
      questionArgs(userB.id, pending.id),
      { ...questionArgs(userA.id, pending.id), p_owner_id: null },
      questionArgs(userA.id, official.id),
      questionArgs(userA.id, pending.id, questions(7)),
      questionArgs(userA.id, pending.id, questions(9)),
      questionArgs(userA.id, pending.id, questions(8, ["datagram"])),
      questionArgs(userA.id, pending.id, questions(8, ["datagram", "payload", "header", "length", "checksum"])),
    ]) {
      expect.soft(await db.admin.rpc("save_generated_questions", invalid)).toMatchObject({ ok: false });
    }
    expect(exactlyOne(await readTopic(db, pending.id), "Read pending topic after rejected writes"))
      .toMatchObject({ status: "pending", question_count: 0 });
    expect(success(await db.admin.rows("questions", { topic_id: eq(pending.id) }), "Read any generated questions"))
      .toEqual([]);
    expect(success(await db.admin.rows("questions", { topic_id: eq(official.id) }), "Check official rubric for writes"))
      .toEqual([]);
  });

  it("stores eight complete questions server-side and exposes only ready topic metadata (SEC-T5)", async () => {
    const { db, subject, userA, userB } = await topicUsers();
    const args = topicArgs(userA.id, subject.id, "UDP headers");
    success(await db.admin.rpc("create_user_topic", args), "Create pending topic");
    const pending = await createdTopic(db, args);
    const batch = questions();
    batch[7].key_concepts = ["datagram", "payload", "header", "length"];
    success(await db.admin.rpc("save_generated_questions", questionArgs(userA.id, pending.id, batch)), "Save generated questions");

    const query = {
      topic_id: eq(pending.id), select: "position,prompt,reference_answer,source_excerpt,key_concepts", order: "position",
    };
    expect(success(await db.admin.rows("questions", query), "Read persisted server rubric")).toEqual(batch);

    const a = await db.signIn(userA);
    const b = await db.signIn(userB);
    const metadata = { id: eq(pending.id), select: "id,slug,title,status,question_count" };
    expect(exactlyOne(await a.rows<Topic>("topics", metadata), "Read generated topic via owner session")).toEqual({
      id: pending.id, slug: args.p_slug, title: args.p_title, status: "ready", question_count: 8,
    });
    expect(success(await b.rows("topics", metadata), "Read generated topic via other session")).toEqual([]);
    expectDenied(await a.rows("questions", query), "Read generated rubric as owner");
    expectDenied(await b.rows("questions", query), "Read generated rubric as another user");
  });
});

async function createdTopic(db: LocalDb, args: ReturnType<typeof topicArgs>) {
  return exactlyOne(await db.admin.rows<Topic>("topics", {
    owner_id: eq(args.p_owner_id), subject_id: eq(args.p_subject_id), slug: eq(args.p_slug),
  }), "Read topic created by RPC");
}
