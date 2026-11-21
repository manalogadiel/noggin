import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createCard,
  createLesson,
  createNog,
  eq,
  exactlyOne,
  expectDenied,
  localDb,
  success,
  type LocalDb,
  type Row,
} from "./helpers";

vi.setConfig({ testTimeout: 25_000, hookTimeout: 15_000 });

const migration = new URL(
  "../../supabase/migrations/20261121000006_review_cards.sql",
  import.meta.url,
);

type ThoughtCardRow = Row & {
  nog_id: string;
  status: "understood" | "shaky" | "confused";
  strength: number;
  interval_days: number;
  next_review_at: string;
};

async function cardReviewFixture() {
  const db = localDb();
  const { subject, topic } = await db.tcpTopic();
  const ownerA = await db.createUser();
  const ownerB = await db.createUser();
  const nogA = await createNog(db, ownerA.id, subject.id);
  const lessonA = await createLesson(db, nogA.id, topic.id);
  const cardA = await createCard(db, nogA.id, topic.id, lessonA.id);
  return { db, subject, topic, ownerA, ownerB, nogA, lessonA, cardA };
}

async function readCard(db: LocalDb, cardId: string) {
  return exactlyOne(
    await db.admin.rows<ThoughtCardRow>("thought_cards", {
      id: eq(cardId),
      select: "id,nog_id,status,strength,interval_days,next_review_at",
    }),
    "Read thought card",
  );
}

describe("review_thought_card RPC (plan W3)", () => {
  it("defines review_thought_card as security definer with an empty search_path in migration 20261121000006", () => {
    expect(
      existsSync(migration),
      "Missing migration supabase/migrations/20261121000006_review_cards.sql",
    ).toBe(true);
    const sql = readFileSync(migration, "utf8");
    const header = sql.match(
      /create\s+(?:or\s+replace\s+)?function\s+public\.review_thought_card\s*\([\s\S]*?\bas\s+\$\w*\$/i,
    )?.[0];
    expect(header, "Missing SQL definition for review_thought_card").toBeDefined();
    expect(header).toMatch(/\bsecurity\s+definer\b/i);
    expect(header).toMatch(/\bset\s+search_path\s*(?:=|to)\s*''/i);
  });

  it("denies anonymous and authenticated execution of review_thought_card", async () => {
    const { db, ownerA, cardA } = await cardReviewFixture();
    const sessionA = await db.signIn(ownerA);
    const args = {
      p_owner_id: ownerA.id,
      p_card_id: cardA.id,
      p_outcome: "remembered",
    };

    expectDenied(
      await sessionA.rpc("review_thought_card", args),
      "Authenticated owner calls review_thought_card",
    );
    expectDenied(
      await db.anon.rpc("review_thought_card", args),
      "Anonymous client calls review_thought_card",
    );
  });

  it("enforces Nog ownership and outcome validation inside review_thought_card", async () => {
    const { db, ownerA, ownerB, cardA } = await cardReviewFixture();
    const before = await readCard(db, cardA.id);

    for (const invalidArgs of [
      { p_owner_id: ownerB.id, p_card_id: cardA.id, p_outcome: "remembered" },
      { p_owner_id: randomUUID(), p_card_id: cardA.id, p_outcome: "remembered" },
      { p_owner_id: null, p_card_id: cardA.id, p_outcome: "remembered" },
      { p_owner_id: ownerA.id, p_card_id: randomUUID(), p_outcome: "remembered" },
      { p_owner_id: ownerA.id, p_card_id: cardA.id, p_outcome: "guessed" },
      { p_owner_id: ownerA.id, p_card_id: cardA.id, p_outcome: "" },
    ]) {
      expect.soft(
        await db.admin.rpc("review_thought_card", invalidArgs),
      ).toMatchObject({ ok: false });
    }

    const after = await readCard(db, cardA.id);
    expect(after).toEqual(before);
  });

  it("steps through the [1, 3, 7, 14, 30] interval ladder on remembered and resets to 1 day shaky on forgot", async () => {
    const { db, ownerA, cardA } = await cardReviewFixture();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const [index, expectedDays] of [3, 7, 14, 30, 30].entries()) {
      const startedAt = Date.now();
      success(
        await db.admin.rpc("review_thought_card", {
          p_owner_id: ownerA.id,
          p_card_id: cardA.id,
          p_outcome: "remembered",
        }),
        `Review card remembered step ${index + 1}`,
      );

      const updated = await readCard(db, cardA.id);
      expect(updated.interval_days).toBe(expectedDays);
      expect(updated.strength).toBe(2 + index);

      const reviewDeltaDays =
        (Date.parse(updated.next_review_at) - startedAt) / dayMs;
      expect(reviewDeltaDays).toBeGreaterThan(expectedDays - 0.1);
      expect(reviewDeltaDays).toBeLessThan(expectedDays + 0.1);
    }

    const forgotStartedAt = Date.now();
    success(
      await db.admin.rpc("review_thought_card", {
        p_owner_id: ownerA.id,
        p_card_id: cardA.id,
        p_outcome: "forgot",
      }),
      "Review card forgot",
    );

    const reset = await readCard(db, cardA.id);
    expect(reset.interval_days).toBe(1);
    expect(reset.status).toBe("shaky");
    const resetDeltaDays =
      (Date.parse(reset.next_review_at) - forgotStartedAt) / dayMs;
    expect(resetDeltaDays).toBeGreaterThan(0.9);
    expect(resetDeltaDays).toBeLessThan(1.1);
  });
});
