import { describe, expect, it } from "vitest";
import { answerFollowUp } from "../use-cases/answer-follow-up";
import { reviseLesson } from "../use-cases/revise-lesson";
import { teachLesson } from "../use-cases/teach-lesson";
import { createOperation, digest, lesson, makeFixture, ownerId, savedPage, scope } from "./fixtures";

const followUp = {
  ...scope,
  lessonId: savedPage.id,
  body: "The server responds with SYN-ACK.",
  idempotencyKey: "follow-up-1",
};

describe("teachLesson", () => {
  it("saves the exact page before listening and keeps it when the listener fails", async () => {
    const { deps, pages } = makeFixture();
    const body = "  The client sends SYN.\nThe server sends SYN-ACK.  ";
    let savedBodiesWhenListening: string[] = [];
    deps.listener.listen.mockImplementationOnce(async () => {
      savedBodiesWhenListening = pages.map((page) => page.body);
      throw new Error("Listener unavailable");
    });

    const result = await teachLesson(deps, { ...lesson, body });

    expect(result).toMatchObject({ status: "brain_fog" });
    expect(deps.listener.listen).toHaveBeenCalledTimes(1);
    expect(savedBodiesWhenListening).toEqual([body]);
    expect(pages).toEqual([expect.objectContaining({ ...scope, body })]);
    expect(deps.notebook.applyDigest).not.toHaveBeenCalled();
  });

  it("saves and listens to a page with exactly 120 words", async () => {
    const { deps, pages } = makeFixture();
    const body = Array(120).fill("pakete").join(" ");
    deps.listener.listen.mockResolvedValueOnce({ ...digest, operations: [] });

    await expect(teachLesson(deps, { ...lesson, body })).resolves.toMatchObject({ status: "ok" });

    expect(pages).toEqual([expect.objectContaining({ body, wordCount: 120 })]);
    expect(deps.listener.listen).toHaveBeenCalledTimes(1);
    expect(deps.usage.consumeQuota).toHaveBeenCalledBefore(deps.listener.listen);
  });

  it("reports overload for 121 words without saving, consuming quota, or listening", async () => {
    const { deps, pages } = makeFixture();
    const body = Array(121).fill("pakete").join(" ");

    await expect(teachLesson(deps, { ...lesson, body })).resolves.toMatchObject({ status: "overload" });

    expect(pages).toHaveLength(0);
    expect(deps.notebook.savePage).not.toHaveBeenCalled();
    expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
    expect(deps.listener.listen).not.toHaveBeenCalled();
  });

  it("applies the grounded operation and drops operations quoting text outside the new page", async () => {
    const { deps } = makeFixture([savedPage]);
    const grounded = { ...createOperation, label: "ACK", quote: "The client finishes with ACK." };
    const fromOlderPage = createOperation;
    const nearMatch = { ...grounded, quote: "The client finishes with ack." };
    deps.listener.listen.mockResolvedValueOnce({
      ...digest,
      operations: [fromOlderPage, grounded, nearMatch],
    });

    await expect(teachLesson(deps, {
      ...lesson,
      body: "The client finishes with ACK. The connection is ready.",
      idempotencyKey: "feed-2",
    })).resolves.toMatchObject({ status: "ok" });

    expect(deps.notebook.applyDigest).toHaveBeenCalledTimes(1);
    expect(deps.notebook.applyDigest).toHaveBeenCalledWith(expect.objectContaining({
      operations: [expect.objectContaining(grounded)],
    }));
  });
});

describe("answerFollowUp", () => {
  it("stores two answers as separate pages and refuses a third for the same lesson", async () => {
    const { deps, pages } = makeFixture([savedPage]);
    const second = {
      ...followUp,
      body: "The client acknowledges with ACK.",
      idempotencyKey: "follow-up-2",
    };

    await expect(answerFollowUp(deps, followUp)).resolves.toMatchObject({ status: "ok" });
    await expect(answerFollowUp(deps, second)).resolves.toMatchObject({ status: "ok" });
    await expect(answerFollowUp(deps, {
      ...followUp,
      body: "This would be a third answer.",
      idempotencyKey: "follow-up-3",
    })).resolves.toMatchObject({ status: "follow_up_limit" });

    expect(pages).toEqual([
      savedPage,
      expect.objectContaining({ body: followUp.body, parentLessonId: savedPage.id, kind: "follow_up_answer" }),
      expect.objectContaining({ body: second.body, parentLessonId: savedPage.id, kind: "follow_up_answer" }),
    ]);
    expect(new Set(pages.map((page) => page.id)).size).toBe(3);
    expect(deps.listener.listen).toHaveBeenCalledTimes(2);
  });

  it("keeps the two-answer limit when the caller submits a follow-up page ID", async () => {
    const firstAnswer = {
      ...savedPage,
      ...followUp,
      id: "first-answer",
      wordCount: 6,
      kind: "follow_up_answer" as const,
      parentLessonId: savedPage.id,
    };
    const secondAnswer = { ...firstAnswer, id: "second-answer", idempotencyKey: "follow-up-2" };
    const { deps } = makeFixture([savedPage, firstAnswer, secondAnswer]);

    await expect(answerFollowUp(deps, {
      ...followUp,
      lessonId: secondAnswer.id,
      idempotencyKey: "follow-up-3",
    })).resolves.not.toMatchObject({ status: "ok" });

    expect(deps.notebook.savePage).not.toHaveBeenCalled();
    expect(deps.listener.listen).not.toHaveBeenCalled();
  });
});

describe("listener quota", () => {
  type Dependencies = ReturnType<typeof makeFixture>["deps"];
  it.each([
    ["teachLesson", (deps: Dependencies) => teachLesson(deps, lesson)],
    ["answerFollowUp", (deps: Dependencies) => answerFollowUp(deps, followUp)],
    ["reviseLesson", (deps: Dependencies) => reviseLesson(deps, { ...followUp, idempotencyKey: "revision-1" })],
  ] as const)("blocks %s before calling the listener when its quota is exhausted", async (_name, run) => {
    const { deps, exhausted } = makeFixture([savedPage]);
    exhausted.add("listener");

    await expect(run(deps)).resolves.toMatchObject({ status: "tired_for_today" });

    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "listener", 1);
    expect(deps.listener.listen).not.toHaveBeenCalled();
  });
});
