import { describe, expect, it, vi } from "vitest";
import {
  createCard, createCardOp, createLesson, createNog, eq, exactlyOne, expectDenied,
  localDb, success, type Lesson, type LocalDb, type Row,
} from "./helpers";

vi.setConfig({ testTimeout: 25_000, hookTimeout: 15_000 });

type DigestResult = { applied: boolean; card_ids: string[] };
type QuotaResult = { allowed: boolean; used: number; cap: number };
const message = { role: "nog", kind: "reply", body: "I can explain SYN now.", mood: "happy" };

async function lessonFixture() {
  const db = localDb();
  const { subject, topic } = await db.tcpTopic();
  const owner = await db.createUser();
  const nog = await createNog(db, owner.id, subject.id);
  const lesson = await createLesson(db, nog.id, topic.id);
  const args = {
    p_nog_id: nog.id,
    p_idempotency_key: lesson.idempotency_key,
    p_ops: [createCardOp()],
    p_messages: [message],
  };
  return { db, owner, subject, topic, nog, lesson, args };
}

function quotaArgs(userId: string, amount: number) {
  return { p_user_id: userId, p_kind: "listener", p_amount: amount };
}

async function listenerCap(db: LocalDb, userId: string) {
  const profile = await db.profile(userId);
  const plan = exactlyOne(await db.admin.rows<{ caps: { listener: number } }>("plans", {
    code: eq(profile.plan_code), select: "caps",
  }), "Read test user's plan caps");
  const cap = plan.caps.listener;
  expect(Number.isInteger(cap)).toBe(true);
  expect(cap).toBeGreaterThan(1);
  return cap;
}

async function usageAmounts(db: LocalDb, userId: string) {
  const rows = success(await db.admin.rows<{ amount: number }>("usage_events", {
    user_id: eq(userId), kind: eq("listener"), select: "amount", order: "id.asc",
  }), "Read usage events");
  return rows.map(({ amount }) => amount);
}

describe("service-only RPCs", () => {
  it("denies authenticated and anon execution of all three RPCs", async () => {
    const { db, owner, nog, args } = await lessonFixture();
    const client = await db.signIn(owner);
    const calls = [
      ["apply_lesson_digest", args],
      ["record_check_attempt", { p_nog_id: nog.id, p_attempts: [], p_card_updates: [], p_stage: "hatchling" }],
      ["consume_usage_quota", quotaArgs(owner.id, 1)],
    ] as const;
    for (const [name, input] of calls) {
      expectDenied(await client.rpc(name, input), `Authenticated calls ${name}`);
      expectDenied(await db.anon.rpc(name, input), `Anon calls ${name}`);
    }
  });

  it("records an attempt, updates the card and advances the Nog as service role", async () => {
    const { db, topic, nog, lesson } = await lessonFixture();
    const card = await createCard(db, nog.id, topic.id, lesson.id);
    const question = exactlyOne(await db.admin.rows<Row>("questions", {
      topic_id: eq(topic.id), position: eq(1), select: "id",
    }), "Read first TCP question");
    success(await db.admin.rpc("record_check_attempt", {
      p_nog_id: nog.id,
      p_attempts: [{
        question_id: question.id, nog_answer: "The client starts with SYN.", concepts: [],
        correct: true, notebook_fingerprint: "db-test", model: "db-test", prompt_version: "1",
      }],
      p_card_updates: [{ card_id: card.id, strength: 2, status: "understood", interval_days: 3 }],
      p_stage: "sprout",
    }), "Record check attempt");

    expect(exactlyOne(await db.admin.rows("check_attempts", {
      nog_id: eq(nog.id), select: "question_id,correct",
    }), "Read recorded attempt")).toEqual({ question_id: question.id, correct: true });
    expect(exactlyOne(await db.admin.rows("thought_cards", {
      id: eq(card.id), select: "strength,status,interval_days",
    }), "Read updated card")).toEqual({ strength: 2, status: "understood", interval_days: 3 });
    expect(exactlyOne(await db.admin.rows("nogs", {
      id: eq(nog.id), select: "stage",
    }), "Read updated Nog")).toEqual({ stage: "sprout" });
  });
});

describe("apply_lesson_digest", () => {
  it("applies a digest only once when the same idempotency key is replayed", async () => {
    const { db, nog, lesson, args } = await lessonFixture();
    const first = success(await db.admin.rpc<DigestResult>("apply_lesson_digest", args), "Apply lesson digest");
    expect(first.applied).toBe(true);
    expect(first.card_ids).toHaveLength(1);
    const second = success(await db.admin.rpc<DigestResult>("apply_lesson_digest", args), "Replay lesson digest");
    expect(second.applied).toBe(false);

    const cards = success(await db.admin.rows<Row>("thought_cards", {
      nog_id: eq(nog.id), select: "id,source_lesson_id,label",
    }), "Read cards after replay");
    expect(cards).toEqual([{ id: first.card_ids[0], source_lesson_id: lesson.id, label: "SYN" }]);
    const messages = success(await db.admin.rows("nog_messages", {
      nog_id: eq(nog.id), select: "lesson_id,role,kind",
    }), "Read messages after replay");
    expect(messages).toEqual([{ lesson_id: lesson.id, role: "nog", kind: "reply" }]);
    expect(exactlyOne(await db.admin.rows<Lesson>("lessons", {
      id: eq(lesson.id), select: "digest_status",
    }), "Read digested lesson").digest_status).toBe("done");
  });

  it("updates an existing card when it belongs to the lesson's Nog", async () => {
    const { db, topic, nog, lesson, args } = await lessonFixture();
    const card = await createCard(db, nog.id, topic.id, lesson.id);
    const result = success(await db.admin.rpc<DigestResult>("apply_lesson_digest", {
      ...args,
      p_ops: [{ type: "update", card_id: card.id, label: "SYN revisited", status: "shaky" }],
    }), "Apply digest to an owned card");
    expect(result.applied).toBe(true);
    const updated = exactlyOne(await db.admin.rows("thought_cards", {
      id: eq(card.id), select: "label,status",
    }), "Read card after same-Nog update");
    expect(updated).toEqual({ label: "SYN revisited", status: "shaky" });
  });

  it.each(["another Nog's card", "unknown operation"] as const)("rolls the entire digest back for %s", async (scenario) => {
    const { db, subject, topic, nog, lesson, args } = await lessonFixture();
    const otherOwner = await db.createUser();
    const otherNog = await createNog(db, otherOwner.id, subject.id);
    const otherLesson = await createLesson(db, otherNog.id, topic.id);
    const otherCard = await createCard(db, otherNog.id, topic.id, otherLesson.id);
    const op = scenario === "another Nog's card"
      ? { type: "update", card_id: otherCard.id, label: "Wrong owner", status: "confused" }
      : { type: "unsupported" };

    const reply = await db.admin.rpc("apply_lesson_digest", { ...args, p_ops: [...args.p_ops, op] });
    if (reply.ok) throw new Error("Invalid digest unexpectedly succeeded");
    expect(reply.code).toBe("P0001");
    const ownRows = { nog_id: eq(nog.id), select: "id" };
    for (const table of ["thought_cards", "nog_messages"]) {
      expect(success(await db.admin.rows(table, ownRows), `Check rollback of ${table}`).length).toBe(0);
    }
    expect(exactlyOne(await db.admin.rows("thought_cards", {
      id: eq(otherCard.id), select: "label,status",
    }), "Read unchanged card")).toEqual({ label: "SYN", status: "understood" });
    expect(exactlyOne(await db.admin.rows<Lesson>("lessons", {
      id: eq(lesson.id), select: "digest_status",
    }), "Read unchanged lesson").digest_status).toBe("pending");
  });
});

describe("consume_usage_quota", () => {
  it("allows usage up to the daily plan cap and records no rejected usage", async () => {
    const db = localDb();
    const user = await db.createUser();
    const cap = await listenerCap(db, user.id);
    const allowed = exactlyOne(await db.admin.rpc<QuotaResult[]>("consume_usage_quota", quotaArgs(user.id, cap)), "Consume daily cap");
    expect(allowed).toMatchObject({ allowed: true, cap });
    const denied = exactlyOne(await db.admin.rpc<QuotaResult[]>("consume_usage_quota", quotaArgs(user.id, 1)), "Check exhausted quota");
    expect(denied).toEqual({ allowed: false, used: cap, cap });
    expect(await usageAmounts(db, user.id)).toEqual([cap]);
  });

  it("admits exactly one of two concurrent requests competing for the final unit", async () => {
    const db = localDb();
    const user = await db.createUser();
    const cap = await listenerCap(db, user.id);
    const initial = exactlyOne(await db.admin.rpc<QuotaResult[]>("consume_usage_quota", quotaArgs(user.id, cap - 1)), "Leave one quota unit");
    expect(initial).toMatchObject({ allowed: true, cap });

    const args = quotaArgs(user.id, 1);
    const replies = await Promise.all([
      db.admin.rpc<QuotaResult[]>("consume_usage_quota", args),
      db.admin.rpc<QuotaResult[]>("consume_usage_quota", args),
    ]);
    const results = replies.map((reply) => exactlyOne(reply, "Consume final quota unit"));
    expect(results.filter(({ allowed }) => allowed)).toHaveLength(1);
    expect(results.find(({ allowed }) => !allowed)).toEqual({ allowed: false, used: cap, cap });
    expect(await usageAmounts(db, user.id)).toEqual([cap - 1, 1]);
  });
});
