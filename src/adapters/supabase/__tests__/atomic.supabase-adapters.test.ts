import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { eq, success } from "../../../../tests/db/helpers";
import {
  digestInput, followUpInput, leases, observeRequests, ownerFixture, pageInput, repositoriesFor,
} from "./fixtures";

it("admits only one parallel follow-up at max minus one and distinguishes replays from conflicts", async () => {
  const { owner, nog, topic } = await ownerFixture();
  const requests = observeRequests();
  const { notebook } = await repositoriesFor(owner);
  const otherWorker = await repositoriesFor(owner);
  const root = await notebook.savePage(pageInput(nog.id, topic.id));
  const initial = followUpInput(root);

  requests.reset();
  const first = await notebook.saveFollowUpPage(initial);
  requests.expectOnlyRpcWrites("save_follow_up_page");
  expect(first.status).toBe("saved");
  expect(await notebook.countFollowUps(nog.id, root.id)).toBe(1);

  const candidates = [followUpInput(root), followUpInput(root)];
  const results = await Promise.all([
    notebook.saveFollowUpPage(candidates[0]),
    otherWorker.notebook.saveFollowUpPage(candidates[1]),
  ]);
  expect(results.map(({ status }) => status).sort()).toEqual(["limit_reached", "saved"]);
  const winner = results.find((result) => result.status === "saved");
  if (winner?.status !== "saved") throw new Error("Expected one saved follow-up");
  const { maxFollowUps, ...expectedPage } = candidates[results.indexOf(winner)];
  expect(winner.page).toMatchObject(expectedPage);
  expect(await notebook.saveFollowUpPage({ ...expectedPage, maxFollowUps })).toEqual({ status: "existing", page: winner.page });
  expect(await notebook.saveFollowUpPage({ ...expectedPage, maxFollowUps, body: "A changed answer." })).toEqual({ status: "conflict" });
  expect(await notebook.countFollowUps(nog.id, root.id)).toBe(2);
  const pages = await notebook.listPages(nog.id, topic.id);
  expect(pages).toHaveLength(3);
  expect(pages).toContainEqual(winner.page);
});

it("replays the first saved digest after parallel calls without duplicating cards or messages", async () => {
  const { db, owner, nog, topic } = await ownerFixture();
  const requests = observeRequests();
  const { notebook, thoughtCards } = await repositoriesFor(owner);
  const otherWorker = await repositoriesFor(owner);
  const page = await notebook.savePage(pageInput(nog.id, topic.id));
  const input = digestInput(page);
  const competing = digestInput(page);
  competing.digest.reply = "The first segment carries SYN.";
  competing.messages[0].body = competing.digest.reply;
  expect(await notebook.findSavedDigest(nog.id, page.idempotencyKey)).toBeNull();

  requests.reset();
  const results = await Promise.all([notebook.applyDigest(input), otherWorker.notebook.applyDigest(competing)]);
  requests.expectOnlyRpcWrites("apply_lesson_digest", 2);
  const winner = results.findIndex(({ applied }) => applied);
  expect(results.filter(({ applied }) => applied)).toHaveLength(1);
  const first = results[winner];
  const saved = [input, competing][winner].digest;
  expect(first.cardIds).toHaveLength(1);
  expect(first.replyMessageId).toBeTruthy();
  expect(first.followUpMessageIds).toHaveLength(1);
  expect(results[1 - winner]).toMatchObject({ applied: false, savedDigest: saved });
  expect(await notebook.findSavedDigest(nog.id, page.idempotencyKey)).toEqual({
    digest: saved,
    cardIds: first.cardIds,
    replyMessageId: first.replyMessageId,
    followUpMessageIds: first.followUpMessageIds,
  });

  requests.reset();
  expect(await notebook.applyDigest([input, competing][1 - winner])).toMatchObject({ applied: false, savedDigest: saved });
  requests.expectOnlyRpcWrites("apply_lesson_digest");
  const cards = await thoughtCards.listByTopic(nog.id, topic.id);
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    id: first.cardIds[0], nogId: nog.id, topicId: topic.id, label: "SYN", status: "understood",
    sourceLessonId: page.id, quote: page.body, paraphrase: "The client initiates the handshake.",
  });
  expect(await thoughtCards.listByNog(nog.id)).toEqual(cards);
  const messages = success(await db.admin.rows("nog_messages", {
    nog_id: eq(nog.id), select: "lesson_id,kind,body", order: "kind.asc",
  }), "Read messages after digest replay");
  expect(messages).toEqual([
    { lesson_id: page.id, kind: "question", body: saved.followUpQuestions[0] },
    { lesson_id: page.id, kind: "reply", body: saved.reply },
  ]);
});

it("serializes parallel reservations on one Nog through database leases", async () => {
  const { db, owner, nog } = await ownerFixture();
  const requests = observeRequests();
  const firstWorker = await repositoriesFor(owner);
  const secondWorker = await repositoriesFor(owner);
  const key = { nogId: nog.id };
  const events: string[] = [];
  const gate = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const first = firstWorker.attempts.withCheckReservation(key, async () => {
    events.push("first entered");
    entered.resolve();
    await gate.promise;
    events.push("first finished work");
    return "first result";
  });
  const pending = [first];

  try {
    await Promise.race([entered.promise, first]);
    expect(events).toEqual(["first entered"]);
    const active = await leases(db, nog.id);
    expect(active).toHaveLength(1);
    expect(Date.parse(active[0].expires_at)).toBeGreaterThan(Date.now());

    const second = secondWorker.attempts.withCheckReservation(key, async () => {
      events.push("second entered");
      const takeover = await leases(db, nog.id);
      expect(takeover).toHaveLength(1);
      expect(takeover[0].holder).not.toBe(active[0].holder);
      return "second result";
    });
    pending.push(second);
    // Keep the first worker inside its callback until the second acquire attempt completes.
    await Promise.race([
      expect.poll(() => requests.rpcCount("acquire_check_reservation"), { timeout: 5_000 }).toBeGreaterThanOrEqual(2),
      second,
    ]);
    expect(events).toEqual(["first entered"]);
    expect(await leases(db, nog.id)).toEqual(active);
    gate.resolve();

    expect(await Promise.all(pending)).toEqual(["first result", "second result"]);
    expect(events).toEqual(["first entered", "first finished work", "second entered"]);
    expect(requests.rpcCount("release_check_reservation")).toBe(2);
    expect(await leases(db, nog.id)).toEqual([]);
  } finally {
    gate.resolve();
    await Promise.allSettled(pending);
  }
});

it("takes over an expired lease and releases the replacement even when work throws", async () => {
  const { db, owner, nog } = await ownerFixture();
  const requests = observeRequests();
  const { attempts } = await repositoriesFor(owner);
  const expired = { holder: randomUUID(), expires_at: "2000-01-01T00:00:00Z" };
  success(await db.admin.rows("check_reservations", {}, "POST", { nog_id: nog.id, ...expired }), "Seed an expired reservation");
  const workError = new Error("Check work interrupted");
  let replacementHolder: string | undefined;

  await expect(attempts.withCheckReservation({ nogId: nog.id }, async () => {
    const renewed = await leases(db, nog.id);
    expect(renewed).toHaveLength(1);
    replacementHolder = renewed[0].holder;
    expect(replacementHolder).not.toBe(expired.holder);
    expect(Date.parse(renewed[0].expires_at)).toBeGreaterThan(Date.now());
    throw workError;
  })).rejects.toBe(workError);
  expect(replacementHolder).toBeDefined();
  expect(requests.rpcCount("acquire_check_reservation")).toBe(1);
  expect(requests.rpcCount("release_check_reservation")).toBe(1);
  expect(await leases(db, nog.id)).toEqual([]);
});
