import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
  birthDate, createCard, createLesson, createNog, credentials, eq, exactlyOne,
  expectDenied, expectNoRows, expectResetFiles, lessonInput, localDb, success,
  type Question, type Row,
} from "./helpers";

vi.setConfig({ testTimeout: 25_000, hookTimeout: 15_000 });

describe("Supabase reset inputs and seed", () => {
  it("ships the local config, both migrations and seed for a clean reset", () => {
    expectResetFiles();
  });

  it("seeds Networking, the official TCP reference, and eight complete questions", async () => {
    const db = localDb();
    const { subject, topic } = await db.tcpTopic();
    expect(subject.name).toBe("Networking");
    expect(topic).toMatchObject({ title: "TCP handshake", visibility: "public", trust_level: "official" });

    const source = exactlyOne(await db.admin.rows<Row & { body: string }>("sources", {
      topic_id: eq(topic.id), kind: eq("official"),
    }), "Read official TCP source");
    expect(source.body.trim().length).toBeGreaterThan(0);

    const questions = success(await db.admin.rows<Question>("questions", {
      topic_id: eq(topic.id), order: "position.asc",
    }), "Read seeded TCP questions");
    expect(questions.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const question of questions) {
      const label = `Question ${question.position}`;
      expect(question.source_id, label).toBe(source.id);
      expect(question.prompt.trim().length, label).toBeGreaterThan(0);
      expect(question.reference_answer.trim().length, label).toBeGreaterThan(0);
      expect(question.source_excerpt.trim().length, label).toBeGreaterThan(0);
      expect(source.body.includes(question.source_excerpt), label).toBe(true);
      expect(question.key_concepts.length, label).toBeGreaterThanOrEqual(2);
      expect(question.key_concepts.length, label).toBeLessThanOrEqual(4);
      expect(question.key_concepts.every((concept) => concept.trim().length > 0), label).toBe(true);
    }
  });
});

describe("profile creation and signup", () => {
  it("creates a profile for a new Auth user", async () => {
    const db = localDb();
    const user = await db.createUser();
    const profile = await db.profile(user.id);
    expect(profile.id).toBe(user.id);
    expect(profile.birth_date === user.date, "Profile birth date matches signup metadata").toBe(true);
    expect(profile.guardian_consent_status).toBe("not_required");
    expect(profile.plan_code).toBe("free");
  });

  it.each(["underage", "missing birth date"] as const)("rejects direct signup with %s and leaves no account", async (scenario) => {
    const db = localDb();
    const account = credentials();
    const reply = await db.signUp(account, scenario === "underage" ? birthDate(15) : undefined);
    if (reply.ok) throw new Error("Signup unexpectedly succeeded");
    expect(reply.status).toBe(500);
    expect(reply.code).toBe("unexpected_failure");

    // A successful retry with the same email demonstrates the failed signup rolled back.
    const user = await db.createUser(account);
    const profile = await db.profile(user.id);
    expect(profile.birth_date === user.date, "Only the valid signup created a profile").toBe(true);
  });

  it("creates a pending-consent profile for a 17-year-old using direct signup", async () => {
    const db = localDb();
    const { id } = success(await db.signUp(credentials(), birthDate(17)), "Sign up 17-year-old test user");
    expect(Boolean(id), "Signup returns a user ID").toBe(true);
    expect((await db.profile(id)).guardian_consent_status).toBe("pending");
  });
});

describe("row and column access", () => {
  it("keeps another user's Nogs and learning records private and unchanged", async () => {
    const db = localDb();
    const { subject, topic } = await db.tcpTopic();
    const alice = await db.createUser();
    const bob = await db.createUser();
    const owner = await db.signIn(alice);
    const otherUser = await db.signIn(bob);

    const nog = await createNog(db, alice.id, subject.id);
    const lesson = await createLesson(db, nog.id, topic.id);
    const card = await createCard(db, nog.id, topic.id, lesson.id);
    const message = exactlyOne(await db.admin.rows<Row>("nog_messages", {}, "POST", {
      nog_id: nog.id, lesson_id: lesson.id, role: "nog", kind: "reply", body: "Ready to learn!",
    }), "Create test message");
    const question = exactlyOne(await db.admin.rows<Row>("questions", {
      topic_id: eq(topic.id), position: eq(1),
    }), "Read first TCP question");
    const attempt = exactlyOne(await db.admin.rows<Row>("check_attempts", {}, "POST", {
      nog_id: nog.id, question_id: question.id, nog_answer: "SYN starts the handshake.",
      concepts: [], correct: false, notebook_fingerprint: "db-test",
    }), "Create test check attempt");

    const rows = [
      { table: "lessons", id: lesson.id, patch: { word_count: 5 } },
      { table: "thought_cards", id: card.id, patch: { strength: 2 } },
      { table: "nog_messages", id: message.id, patch: { kind: "reaction" } },
      { table: "check_attempts", id: attempt.id, patch: { correct: true } },
      { table: "nogs", id: nog.id, patch: { name: "Changed name" } },
    ];
    for (const { table, id, patch } of rows) {
      const query = { id: eq(id), select: "id" };
      const snapshot = { ...query, select: ["id", ...Object.keys(patch)].join(",") };
      expect(exactlyOne(await owner.rows<Row>(table, query), `Owner reads ${table}`).id).toBe(id);
      const read = await otherUser.rows<Row>(table, query);
      expect(success(read, `Other user selects ${table}`).length, table).toBe(0);
      const original = exactlyOne(await db.admin.rows<Row>(table, snapshot), `Read original ${table}`);

      const update = await otherUser.rows(table, query, "PATCH", patch);
      if (table === "nogs") {
        expect(success(update, "Other user updates Nog").length).toBe(0);
      } else {
        expectNoRows(update, `Other user updates ${table}`);
      }
      expectNoRows(await otherUser.rows(table, query, "DELETE"), `Other user deletes ${table}`);
      expect(exactlyOne(await db.admin.rows<Row>(table, snapshot), `Re-read ${table}`)).toEqual(original);
    }
  });

  it("allows profile and Nog customization while protecting plan, consent and progress", async () => {
    const db = localDb();
    const user = await db.createUser();
    const client = await db.signIn(user);
    const { subject } = await db.tcpTopic();
    const profile = { id: eq(user.id) };
    const nog = exactlyOne(await client.rows<Row & { owner_id: string }>("nogs", {}, "POST", {
      subject_id: subject.id, name: "Owner Nog",
    }), "Owner adopts a Nog");
    expect(nog.owner_id).toBe(user.id);
    const query = { id: eq(nog.id) };

    const updated = exactlyOne(await client.rows("profiles", { ...profile, select: "display_name" }, "PATCH", {
      display_name: "Updated",
    }), "Edit display name");
    expect(updated).toEqual({ display_name: "Updated" });
    const renamed = exactlyOne(await client.rows("nogs", query, "PATCH", { name: "Renamed Nog" }), "Rename Nog");
    expect(renamed).toMatchObject({ name: "Renamed Nog" });
    for (const patch of [{ plan_code: "plus" }, { guardian_consent_status: "granted" }]) {
      expectDenied(await client.rows("profiles", profile, "PATCH", patch), "Write protected profile column");
    }
    for (const patch of [{ stage: "genius" }, { happiness: 100 }]) {
      expectDenied(await client.rows("nogs", query, "PATCH", patch), "Write protected Nog column");
    }
  });

  it("lets owners insert lessons while preventing edits, deletes and stranger inserts", async () => {
    const db = localDb();
    const { subject, topic } = await db.tcpTopic();
    const user = await db.createUser();
    const owner = await db.signIn(user);
    const otherUser = await db.signIn(await db.createUser());
    const nog = await createNog(db, user.id, subject.id);
    const lesson = exactlyOne(await owner.rows<Row>("lessons", {}, "POST", lessonInput(nog.id, topic.id)), "Owner inserts lesson");
    const query = { id: eq(lesson.id) };

    expectDenied(await otherUser.rows("lessons", {}, "POST", lessonInput(nog.id, topic.id)), "Other user inserts lesson");
    expectNoRows(await owner.rows("lessons", query, "PATCH", { word_count: 5 }), "Owner edits lesson");
    expectNoRows(await owner.rows("lessons", query, "DELETE"), "Owner deletes lesson");
    const rows = success(await db.admin.rows<Row>("lessons", { nog_id: eq(nog.id), select: "id,word_count" }), "Verify immutable lesson");
    expect(rows).toEqual([{ id: lesson.id, word_count: 6 }]);
  });

  it("hides answer keys, official source text, usage events and voice cache from clients", async () => {
    const db = localDb();
    const { topic } = await db.tcpTopic();
    const user = await db.createUser();
    const client = await db.signIn(user);
    const textHash = randomBytes(32).toString("hex");
    const cache = { text_hash: eq(textHash) };

    success(await db.admin.rows("usage_events", {}, "POST", { user_id: user.id, kind: "listener", amount: 1 }), "Create usage fixture");
    success(await db.admin.rows("voice_cache", {}, "POST", {
      text_hash: textHash, storage_path: `test/${textHash}.ogg`, voice_model: "db-test",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    }), "Create cache fixture");
    onTestFinished(async () => {
      success(await db.admin.rows("voice_cache", cache, "DELETE"), "Remove cache fixture");
    });

    const targets = [
      ["questions", { topic_id: eq(topic.id), select: "reference_answer,key_concepts,source_excerpt" }],
      ["sources", { topic_id: eq(topic.id), select: "body" }],
      ["usage_events", { user_id: eq(user.id) }],
      ["voice_cache", cache],
    ] as const;
    for (const [table, query] of targets) {
      expect(success(await db.admin.rows(table, query), `Read ${table} as service role`).length).toBeGreaterThan(0);
      expectNoRows(await client.rows(table, query), `Read ${table} as authenticated`);
      expectNoRows(await db.anon.rows(table, query), `Read ${table} as anon`);
    }
  });

  it("prevents authenticated inserts, updates and deletes on app config", async () => {
    const db = localDb();
    const client = await db.signIn(await db.createUser());
    const key = `db-test-${randomUUID()}`;
    const otherKey = `${key}-insert`;
    const query = { key: eq(key) };
    const value = { enabled: false };
    onTestFinished(async () => {
      success(await db.admin.rows("app_config", { key: `in.(${key},${otherKey})` }, "DELETE"), "Remove config fixtures");
    });
    success(await db.admin.rows("app_config", {}, "POST", { key, value }), "Create config fixture");

    expectDenied(await client.rows("app_config", {}, "POST", { key: otherKey, value }), "Client inserts app config");
    expectNoRows(await client.rows("app_config", query, "PATCH", { value: { enabled: true } }), "Client updates app config");
    expectNoRows(await client.rows("app_config", query, "DELETE"), "Client deletes app config");
    expect(exactlyOne(await db.admin.rows("app_config", query), "Read unchanged config")).toMatchObject({ value });
  });
});
