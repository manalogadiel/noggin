import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { OwnedMessage } from "@/core/application/ports";
import { createCard, createLesson, eq, exactlyOne, expectDenied, localDb, success } from "../../../../tests/db/helpers";
import {
  attemptDraft, digestInput, followUpInput, observeRequests, ownerFixture,
  pageInput, repositoriesFor, seededQuestions,
} from "./fixtures";

it("creates a Nog, reads it by owner and subject, and persists petting", async () => {
  const db = localDb();
  const { subject } = await db.tcpTopic();
  const owner = await db.createUser();
  const { nogs } = await repositoriesFor(owner);
  const input = { ownerId: owner.id, subjectId: subject.id, name: "Sprocket" };

  expect(await nogs.listByOwner(owner.id)).toEqual([]);
  expect(await nogs.findByOwnerAndSubject(owner.id, subject.id)).toBeNull();
  const nog = await nogs.create(input);
  expect(nog).toMatchObject({ ...input, stage: "hatchling", happiness: 70, happinessToday: 0 });
  const petting = { nogId: nog.id, happiness: 73, happinessToday: 3, happinessDay: "2026-11-21" };
  const petted = await nogs.updatePetting(petting);
  expect(petted).toMatchObject({ ...input, id: nog.id, happiness: 73, happinessToday: 3, happinessDay: petting.happinessDay });
  expect(await nogs.findOwned(owner.id, nog.id)).toEqual(petted);
  expect(await nogs.listByOwner(owner.id)).toEqual([petted]);
  expect(await nogs.findByOwnerAndSubject(owner.id, subject.id)).toEqual(petted);
  expect(exactlyOne(await db.admin.rows("nogs", {
    id: eq(nog.id), select: "owner_id,happiness,happiness_today,happiness_day",
  }), "Read persisted petting")).toEqual({
    owner_id: owner.id, happiness: 73, happiness_today: 3, happiness_day: petting.happinessDay,
  });
});

it("saves a lesson, returns the original on retry, and reads it by both keys", async () => {
  const { owner, nog, topic } = await ownerFixture();
  const { notebook } = await repositoriesFor(owner);
  const input = pageInput(nog.id, topic.id);
  expect(await notebook.findPageByIdempotencyKey(nog.id, input.idempotencyKey)).toBeNull();

  const saved = await notebook.savePage(input);
  expect(saved).toMatchObject(input);
  expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
  expect(Number.isFinite(Date.parse(saved.updatedAt))).toBe(true);
  expect(await notebook.savePage(input)).toEqual(saved);
  expect(await notebook.findPage(nog.id, saved.id)).toEqual(saved);
  expect(await notebook.findPageByIdempotencyKey(nog.id, input.idempotencyKey)).toEqual(saved);
  expect(await notebook.listPages(nog.id, topic.id)).toEqual([saved]);
  expect(await notebook.findPage(nog.id, randomUUID())).toBeNull();
  expect(await notebook.listPages(nog.id, randomUUID())).toEqual([]);
});

it("counts only questions issued on the root lesson and its follow-ups", async () => {
  const { db, owner, nog, topic } = await ownerFixture();
  const { notebook } = await repositoriesFor(owner);
  const root = await notebook.savePage(pageInput(nog.id, topic.id));
  const unrelated = await notebook.savePage(pageInput(nog.id, topic.id));
  const followUp = await notebook.saveFollowUpPage(followUpInput(root));
  expect(followUp.status).toBe("saved");
  if (followUp.status !== "saved") throw new Error("Expected a saved follow-up");
  for (const page of [root, unrelated, followUp.page]) {
    await notebook.applyDigest(digestInput(page));
  }
  expect(await notebook.countFollowUps(nog.id, root.id)).toBe(1);
  expect(await notebook.countIssuedQuestions(nog.id, root.id)).toBe(2);
  expect(await notebook.countIssuedQuestions(nog.id, unrelated.id)).toBe(1);

  const message = exactlyOne(await db.admin.rows<{ id: string; body: string }>("nog_messages", {
    lesson_id: eq(followUp.page.id), kind: eq("question"), select: "id,body",
  }), "Read the follow-up question ID");
  expect(await notebook.findOwnedMessage(owner.id, message.id)).toMatchObject({
    ...message, nogId: nog.id, lessonId: followUp.page.id, role: "nog", kind: "question",
  } satisfies OwnedMessage);
});

it("returns protected question data through the question bank", async () => {
  const db = localDb();
  const { topic } = await db.tcpTopic();
  const owner = await db.createUser();
  const session = await db.signIn(owner);
  expectDenied(await session.rows("questions", { topic_id: eq(topic.id) }), "Session reads questions");

  const { questions } = await repositoriesFor(owner);
  const seeded = await seededQuestions(db, topic.id);
  expect(await questions.listByTopic(topic.id)).toEqual(seeded.map((question) => ({
    id: question.id, topicId: topic.id, prompt: question.prompt,
    referenceAnswer: question.reference_answer, sourceExcerpt: question.source_excerpt,
    keyConcepts: question.key_concepts,
  })));
  expect(await questions.listByTopic(randomUUID())).toEqual([]);
});

it("records check attempts, card updates and stage through one RPC, then reads back the latest attempts", async () => {
  const { db, owner, nog, topic } = await ownerFixture();
  const lesson = await createLesson(db, nog.id, topic.id);
  const card = await createCard(db, nog.id, topic.id, lesson.id);
  const [firstQuestion, secondQuestion] = await seededQuestions(db, topic.id);
  const requests = observeRequests();
  const { attempts, nogs, thoughtCards } = await repositoriesFor(owner);
  const scope = { nogId: nog.id, topicId: topic.id, topicQuestionCount: 8, model: "supabase-test" };
  expect(await attempts.findLatest(nog.id, topic.id)).toEqual([]);
  const oldDrafts = [attemptDraft(firstQuestion), attemptDraft(secondQuestion)];
  const older = await attempts.recordCheck({ ...scope, attempts: oldDrafts });
  expect(older).toHaveLength(2);
  expect(older).toEqual(expect.arrayContaining(oldDrafts.map((draft) => expect.objectContaining(draft))));
  const draft = { ...attemptDraft(firstQuestion), correct: false };
  const nextReviewAt = "2030-01-01T00:00:00.000Z";
  const cardUpdate = { cardId: card.id, status: "shaky" as const, strength: 2, intervalDays: 3, nextReviewAt };

  requests.reset();
  const recorded = await attempts.recordCheck({ ...scope, attempts: [draft], cardUpdates: [cardUpdate], stage: "sprout" });
  requests.expectOnlyRpcWrites("record_check_attempt");
  expect(recorded).toHaveLength(1);
  const [latest] = recorded;
  expect(latest).toMatchObject({ ...draft, nogId: nog.id });
  expect(Number.isFinite(Date.parse(latest.createdAt))).toBe(true);
  const other = older.find(({ questionId }) => questionId === secondQuestion.id);
  const latestForTopic = await attempts.findLatest(nog.id, topic.id);
  expect(latestForTopic).toHaveLength(2);
  expect(latestForTopic).toEqual(expect.arrayContaining([latest, other]));
  expect(await attempts.findLatest(nog.id, randomUUID())).toEqual([]);
  const history = await attempts.listByNog(nog.id);
  expect(history).toHaveLength(3);
  expect(history.map(({ id }) => id)).toEqual(expect.arrayContaining([...older, latest].map(({ id }) => id)));
  expect(await attempts.findOwned(owner.id, latest.id)).toMatchObject({
    id: latest.id, nogId: nog.id, nogAnswer: draft.nogAnswer,
  });
  expect(await nogs.findOwned(owner.id, nog.id)).toMatchObject({ stage: "sprout" });
  const cards = await thoughtCards.listByTopic(nog.id, topic.id);
  expect(cards).toHaveLength(1);
  const [updated] = cards;
  expect(updated).toMatchObject({ id: card.id, status: "shaky", strength: 2, intervalDays: 3 });
  expect(new Date(updated.nextReviewAt!).toISOString()).toBe(nextReviewAt);
});

it("consumes quota through the usage RPC and persists only allowed usage", async () => {
  const db = localDb();
  const owner = await db.createUser();
  const profile = await db.profile(owner.id);
  const { caps: { listener: cap } } = exactlyOne(await db.admin.rows<{ caps: { listener: number } }>("plans", {
    code: eq(profile.plan_code), select: "caps",
  }), "Read the test user's listener cap");
  const requests = observeRequests();
  const { usage } = await repositoriesFor(owner);

  requests.reset();
  expect(await usage.consumeQuota(owner.id, "listener", cap)).toEqual({ allowed: true, used: cap, cap });
  requests.expectOnlyRpcWrites("consume_usage_quota");
  expect(await usage.consumeQuota(owner.id, "listener", 1)).toEqual({ allowed: false, used: cap, cap });
  expect(success(await db.admin.rows("usage_events", {
    user_id: eq(owner.id), kind: eq("listener"), select: "amount",
  }), "Read persisted usage")).toEqual([{ amount: cap }]);
});
