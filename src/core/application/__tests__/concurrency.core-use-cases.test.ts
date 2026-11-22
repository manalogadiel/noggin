import { describe, expect, it, vi } from "vitest";
import type {
  CheckReservationKey,
  LessonPage,
  QuestionRecord,
} from "../ports";
import { createInMemoryPorts } from "../testing/fakes";
import { answerFollowUp } from "../use-cases/answer-follow-up";
import { reviseLesson } from "../use-cases/revise-lesson";
import { runQuickCheck } from "../use-cases/run-quick-check";
import { teachLesson } from "../use-cases/teach-lesson";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeQuestions(topicId: string, prefix: string, count: number): QuestionRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const concept = `${prefix}-concept-${index + 1}`;
    return {
      id: `${prefix}-q-${index + 1}`,
      topicId,
      prompt: `Explain ${concept}.`,
      referenceAnswer: `Details about ${concept}.`,
      sourceExcerpt: `Notes covering ${concept}.`,
      keyConcepts: [concept],
    };
  });
}

function makePage(
  id: string,
  nogId: string,
  topicId: string,
  body: string,
  timestamp = "2026-11-21T03:00:00.000Z",
): LessonPage {
  return {
    id,
    nogId,
    topicId,
    body,
    wordCount: body.trim().split(/\s+/).length,
    kind: "lesson",
    parentLessonId: null,
    idempotencyKey: `key-${id}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("runQuickCheck reservation and snapshot ordering", () => {
  it("serializes concurrent checks across topics for the same Nog by nogId and persists sprout stage", async () => {
    const topicA = "topic-a";
    const topicB = "topic-b";
    const nogId = "nog-1";
    const questionsA = makeQuestions(topicA, "alpha", 3);
    const questionsB = makeQuestions(topicB, "beta", 3);
    const pageA = makePage(
      "page-a",
      nogId,
      topicA,
      "alpha-concept-1 alpha-concept-2 alpha-concept-3",
    );
    const pageB = makePage(
      "page-b",
      nogId,
      topicB,
      "beta-concept-1 beta-concept-2 beta-concept-3",
    );

    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
      pages: [pageA, pageB],
      questions: [...questionsA, ...questionsB],
    });

    const reservationKeys: CheckReservationKey[] = [];
    const worker1Started = createDeferred();
    const releaseWorker1 = createDeferred();
    let worker2BrainCalled = false;

    const sharedAttempts = {
      ...ports.deps.attempts,
      recordCheck: vi.fn(ports.deps.attempts.recordCheck),
      async withCheckReservation<T>(
        key: CheckReservationKey,
        work: () => Promise<T>,
      ): Promise<T> {
        reservationKeys.push(key);
        return ports.deps.attempts.withCheckReservation!(key, work);
      },
    };

    const worker1Deps = {
      ...ports.deps,
      attempts: sharedAttempts,
      brain: {
        answer: vi.fn(async (input) => {
          worker1Started.resolve();
          await releaseWorker1.promise;
          return ports.deps.brain.answer(input);
        }),
      },
    };

    const worker2Deps = {
      ...ports.deps,
      attempts: sharedAttempts,
      brain: {
        answer: vi.fn(async (input) => {
          worker2BrainCalled = true;
          return ports.deps.brain.answer(input);
        }),
      },
    };

    const firstCheck = runQuickCheck(worker1Deps, { nogId, topicId: topicA });
    await worker1Started.promise;

    const secondCheck = runQuickCheck(worker2Deps, { nogId, topicId: topicB });
    await Promise.resolve();
    await Promise.resolve();

    expect(worker2BrainCalled).toBe(false);

    releaseWorker1.resolve();
    const [firstResult, secondResult] = await Promise.all([
      firstCheck,
      secondCheck,
    ]);

    expect(firstResult).toMatchObject({ status: "ok", reused: false });
    expect(secondResult).toMatchObject({ status: "ok", reused: false });
    expect(reservationKeys).toEqual([{ nogId }, { nogId }]);
    expect(sharedAttempts.recordCheck).toHaveBeenCalledTimes(2);
    expect(sharedAttempts.recordCheck.mock.calls[0][0].stage).toBe("hatchling");
    expect(sharedAttempts.recordCheck.mock.calls[1][0].stage).toBe("sprout");
    expect(ports.stores.nogs[0].stage).toBe("sprout");
  });

  it("serializes same-Nog checks via process-local fallback when withCheckReservation is absent", async () => {
    const topicA = "topic-a";
    const topicB = "topic-b";
    const nogId = "nog-fallback";
    const questionsA = makeQuestions(topicA, "gamma", 3);
    const questionsB = makeQuestions(topicB, "delta", 3);
    const pageA = makePage(
      "page-a",
      nogId,
      topicA,
      "gamma-concept-1 gamma-concept-2 gamma-concept-3",
    );
    const pageB = makePage(
      "page-b",
      nogId,
      topicB,
      "delta-concept-1 delta-concept-2 delta-concept-3",
    );

    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
      pages: [pageA, pageB],
      questions: [...questionsA, ...questionsB],
    });

    const recordCheck = vi.fn(ports.deps.attempts.recordCheck);
    const attemptsWithoutReservation = {
      findLatest: ports.deps.attempts.findLatest,
      recordCheck,
      listByNog: ports.deps.attempts.listByNog,
    };

    const worker1Started = createDeferred();
    const releaseWorker1 = createDeferred();

    const firstCheck = runQuickCheck(
      {
        ...ports.deps,
        attempts: attemptsWithoutReservation,
        brain: {
          answer: vi.fn(async (input) => {
            worker1Started.resolve();
            await releaseWorker1.promise;
            return ports.deps.brain.answer(input);
          }),
        },
      },
      { nogId, topicId: topicA },
    );

    await worker1Started.promise;

    const secondCheck = runQuickCheck(
      {
        ...ports.deps,
        attempts: attemptsWithoutReservation,
      },
      { nogId, topicId: topicB },
    );

    releaseWorker1.resolve();
    const [firstResult, secondResult] = await Promise.all([
      firstCheck,
      secondCheck,
    ]);

    expect(firstResult).toMatchObject({ status: "ok", reused: false });
    expect(secondResult).toMatchObject({ status: "ok", reused: false });
    expect(recordCheck.mock.calls[0][0].stage).toBe("hatchling");
    expect(recordCheck.mock.calls[1][0].stage).toBe("sprout");
    expect(ports.stores.nogs[0].stage).toBe("sprout");
  });

  it("prevents an older in-flight check from overwriting a newer notebook snapshot", async () => {
    const nogId = "nog-snapshot";
    const topicId = "tcp-handshake";
    const questions = makeQuestions(topicId, "tcp", 2);
    const pageV1 = makePage(
      "page-1",
      nogId,
      topicId,
      "tcp-concept-1",
      "2026-11-21T03:00:00.000Z",
    );
    const pageV2 = makePage(
      "page-2",
      nogId,
      topicId,
      "tcp-concept-2",
      "2026-11-21T03:05:00.000Z",
    );

    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
      pages: [pageV1],
      questions,
    });

    const firstEnteredBrain = createDeferred();
    const releaseFirst = createDeferred();
    let brainCallCount = 0;

    const brain = {
      answer: vi.fn(async (input) => {
        brainCallCount += 1;
        if (brainCallCount === 1) {
          firstEnteredBrain.resolve();
          await releaseFirst.promise;
        }
        return ports.deps.brain.answer(input);
      }),
    };
    const grader = {
      grade: vi.fn(ports.deps.grader.grade),
    };

    const deps = { ...ports.deps, brain, grader };

    const olderCheck = runQuickCheck(deps, { nogId, topicId });
    await firstEnteredBrain.promise;

    ports.stores.pages.push(pageV2);
    const newerCheck = runQuickCheck(deps, { nogId, topicId });

    await Promise.resolve();
    await Promise.resolve();
    expect(brain.answer).toHaveBeenCalledTimes(1);

    releaseFirst.resolve();
    const [olderResult, newerResult] = await Promise.all([
      olderCheck,
      newerCheck,
    ]);

    expect(olderResult).toMatchObject({ status: "ok", reused: false });
    expect(newerResult).toMatchObject({ status: "ok", reused: false });
    expect(brain.answer).toHaveBeenCalledTimes(2);
    expect(grader.grade).toHaveBeenCalledTimes(2);

    const repeatCheck = await runQuickCheck(deps, { nogId, topicId });
    expect(repeatCheck).toMatchObject({ status: "ok", reused: true });
    expect(brain.answer).toHaveBeenCalledTimes(2);
    expect(grader.grade).toHaveBeenCalledTimes(2);
  });

  it("snapshots pages inside the reservation so a delayed earlier request reuses the newer result", async () => {
    const nogId = "nog-late-acquire";
    const topicId = "tcp-handshake";
    const questions = makeQuestions(topicId, "tcp", 1);
    const pageV1 = makePage(
      "page-1",
      nogId,
      topicId,
      "tcp-concept-1",
      "2026-11-21T03:00:00.000Z",
    );
    const pageV2 = makePage(
      "page-2",
      nogId,
      topicId,
      "tcp-concept-1 revised",
      "2026-11-21T03:10:00.000Z",
    );

    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
      pages: [pageV1],
      questions,
    });

    const delayedFindOwned = createDeferred();
    const releaseDelayed = createDeferred();
    const brain = { answer: vi.fn(ports.deps.brain.answer) };
    const grader = { grade: vi.fn(ports.deps.grader.grade) };

    const worker1Check = runQuickCheck(
      {
        ...ports.deps,
        nogs: {
          findOwned: vi.fn(async (userId, id) => {
            delayedFindOwned.resolve();
            await releaseDelayed.promise;
            return ports.deps.nogs.findOwned(userId, id);
          }),
        },
        brain,
        grader,
      },
      { nogId, topicId },
    );

    await delayedFindOwned.promise;
    ports.stores.pages.push(pageV2);

    const worker2Result = await runQuickCheck(
      { ...ports.deps, brain, grader },
      { nogId, topicId },
    );
    expect(worker2Result).toMatchObject({ status: "ok", reused: false });
    expect(brain.answer).toHaveBeenCalledTimes(1);

    releaseDelayed.resolve();
    const worker1Result = await worker1Check;

    expect(worker1Result).toMatchObject({ status: "ok", reused: true });
    expect(brain.answer).toHaveBeenCalledTimes(1);
    expect(grader.grade).toHaveBeenCalledTimes(1);
  });
});

describe("thread follow-up question budget on root digest retries", () => {
  it("deducts questions already issued on the root lesson thread when retrying teachLesson after brain_fog", async () => {
    const nogId = "nog-thread";
    const topicId = "tcp-handshake";
    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
    });

    const listen = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({
        reply: "Nice follow-up!",
        mood: "curious",
        followUpQuestions: ["Follow-up question 1?"],
        operations: [],
      })
      .mockResolvedValueOnce({
        reply: "Got the original lesson now!",
        mood: "happy",
        followUpQuestions: ["Root question 1?", "Root question 2?"],
        operations: [],
      });

    const deps = { ...ports.deps, listener: { listen } };

    const firstAttempt = await teachLesson(deps, {
      nogId,
      topicId,
      body: "The client sends SYN first.",
      idempotencyKey: "root-lesson-1",
    });
    expect(firstAttempt.status).toBe("brain_fog");
    if (firstAttempt.status !== "brain_fog") {
      throw new Error("Expected brain_fog on initial teachLesson");
    }

    const followUpResult = await answerFollowUp(deps, {
      nogId,
      topicId,
      lessonId: firstAttempt.page.id,
      body: "Then the server responds with SYN-ACK.",
      idempotencyKey: "follow-up-1",
    });
    expect(followUpResult.status).toBe("ok");
    if (followUpResult.status !== "ok") {
      throw new Error("Expected ok on follow-up");
    }
    expect(followUpResult.digest.followUpQuestions).toEqual([
      "Follow-up question 1?",
    ]);

    const retriedRoot = await teachLesson(deps, {
      nogId,
      topicId,
      body: "The client sends SYN first.",
      idempotencyKey: "root-lesson-1",
    });
    expect(retriedRoot.status).toBe("ok");
    if (retriedRoot.status !== "ok") {
      throw new Error("Expected ok on retried teachLesson");
    }

    expect(retriedRoot.digest.followUpQuestions).toEqual(["Root question 1?"]);
    const totalQuestions = await ports.deps.notebook.countIssuedQuestions!(
      nogId,
      firstAttempt.page.id,
    );
    expect(totalQuestions).toBe(2);
    expect(
      ports.stores.messages.filter((m) => m.kind === "question"),
    ).toHaveLength(2);
  });

  it("saves zero follow-up questions on root retry when two follow-up answers already filled the thread", async () => {
    const nogId = "nog-full-thread";
    const topicId = "tcp-handshake";
    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
    });

    const listen = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({
        reply: "Answer 1 noted.",
        mood: "curious",
        followUpQuestions: ["Question from follow-up 1?"],
        operations: [],
      })
      .mockResolvedValueOnce({
        reply: "Answer 2 noted.",
        mood: "happy",
        followUpQuestions: ["Question from follow-up 2?"],
        operations: [],
      })
      .mockResolvedValueOnce({
        reply: "Root recovered.",
        mood: "happy",
        followUpQuestions: ["Root Q1?", "Root Q2?"],
        operations: [],
      });

    const deps = { ...ports.deps, listener: { listen } };

    const firstAttempt = await teachLesson(deps, {
      nogId,
      topicId,
      body: "TCP uses a three-way handshake.",
      idempotencyKey: "root-1",
    });
    if (firstAttempt.status !== "brain_fog") {
      throw new Error("Expected brain_fog");
    }

    await answerFollowUp(deps, {
      nogId,
      topicId,
      lessonId: firstAttempt.page.id,
      body: "Step 1 is SYN.",
      idempotencyKey: "fu-1",
    });
    await answerFollowUp(deps, {
      nogId,
      topicId,
      lessonId: firstAttempt.page.id,
      body: "Step 2 is SYN-ACK and Step 3 is ACK.",
      idempotencyKey: "fu-2",
    });

    const retriedRoot = await teachLesson(deps, {
      nogId,
      topicId,
      body: "TCP uses a three-way handshake.",
      idempotencyKey: "root-1",
    });
    expect(retriedRoot.status).toBe("ok");
    if (retriedRoot.status !== "ok") {
      throw new Error("Expected ok");
    }

    expect(retriedRoot.digest.followUpQuestions).toEqual([]);
    const totalQuestions = await ports.deps.notebook.countIssuedQuestions!(
      nogId,
      firstAttempt.page.id,
    );
    expect(totalQuestions).toBeLessThanOrEqual(2);
  });

  it("deducts thread questions when retrying reviseLesson after brain_fog", async () => {
    const nogId = "nog-revise-thread";
    const topicId = "tcp-handshake";
    const original = makePage(
      "orig-1",
      nogId,
      topicId,
      "The client starts with SYN.",
    );
    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
      pages: [original],
    });

    const listen = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({
        reply: "Follow-up saved.",
        mood: "curious",
        followUpQuestions: ["Follow-up question on revision?"],
        operations: [],
      })
      .mockResolvedValueOnce({
        reply: "Revision recovered.",
        mood: "happy",
        followUpQuestions: ["Revision Q1?", "Revision Q2?"],
        operations: [],
      });

    const deps = { ...ports.deps, listener: { listen } };

    const firstRevise = await reviseLesson(deps, {
      nogId,
      topicId,
      lessonId: original.id,
      body: "The client sends SYN and waits for SYN-ACK.",
      idempotencyKey: "rev-1",
    });
    expect(firstRevise.status).toBe("brain_fog");
    if (firstRevise.status !== "brain_fog") {
      throw new Error("Expected brain_fog on initial reviseLesson");
    }

    const followUpResult = await answerFollowUp(deps, {
      nogId,
      topicId,
      lessonId: firstRevise.page.id,
      body: "Then the client sends ACK.",
      idempotencyKey: "rev-fu-1",
    });
    expect(followUpResult.status).toBe("ok");

    const retriedRevise = await reviseLesson(deps, {
      nogId,
      topicId,
      lessonId: original.id,
      body: "The client sends SYN and waits for SYN-ACK.",
      idempotencyKey: "rev-1",
    });
    expect(retriedRevise.status).toBe("ok");
    if (retriedRevise.status !== "ok") {
      throw new Error("Expected ok on retried reviseLesson");
    }

    expect(retriedRevise.digest.followUpQuestions).toEqual(["Revision Q1?"]);
    const totalQuestions = await ports.deps.notebook.countIssuedQuestions!(
      nogId,
      firstRevise.page.id,
    );
    expect(totalQuestions).toBe(2);
  });

  it("does not exceed two thread questions when teachLesson retry and answerFollowUp save concurrently", async () => {
    const nogId = "nog-concurrent-thread";
    const topicId = "tcp-handshake";
    const ports = createInMemoryPorts({
      nogs: [
        {
          id: nogId,
          ownerId: "student-1",
          subjectId: "networking",
          name: "Pingu",
          stage: "hatchling",
        },
      ],
    });

    const initialOutage = await teachLesson(
      {
        ...ports.deps,
        listener: {
          listen: vi.fn(async () => {
            throw new Error("temporary outage");
          }),
        },
      },
      {
        nogId,
        topicId,
        body: "The client sends SYN first.",
        idempotencyKey: "concurrent-root-1",
      },
    );
    expect(initialOutage.status).toBe("brain_fog");
    if (initialOutage.status !== "brain_fog") {
      throw new Error("Expected brain_fog");
    }

    const bothListening = createDeferred();
    let inListener = 0;
    const markListening = () => {
      inListener += 1;
      if (inListener === 2) {
        bothListening.resolve();
      }
    };

    const [retryResult, followUpResult] = await Promise.all([
      teachLesson(
        {
          ...ports.deps,
          listener: {
            listen: vi.fn(async () => {
              markListening();
              await bothListening.promise;
              return {
                reply: "Root recovered.",
                mood: "happy",
                followUpQuestions: ["Root Q1?", "Root Q2?"],
                operations: [],
              };
            }),
          },
        },
        {
          nogId,
          topicId,
          body: "The client sends SYN first.",
          idempotencyKey: "concurrent-root-1",
        },
      ),
      answerFollowUp(
        {
          ...ports.deps,
          listener: {
            listen: vi.fn(async () => {
              markListening();
              await bothListening.promise;
              return {
                reply: "Follow-up noted.",
                mood: "curious",
                followUpQuestions: ["Follow-up Q1?", "Follow-up Q2?"],
                operations: [],
              };
            }),
          },
        },
        {
          nogId,
          topicId,
          lessonId: initialOutage.page.id,
          body: "Then the server sends SYN-ACK.",
          idempotencyKey: "concurrent-fu-1",
        },
      ),
    ]);

    expect(retryResult.status).toBe("ok");
    expect(followUpResult.status).toBe("ok");
    const totalQuestions = await ports.deps.notebook.countIssuedQuestions!(
      nogId,
      initialOutage.page.id,
    );
    expect(totalQuestions).toBeLessThanOrEqual(2);
    expect(
      ports.stores.messages.filter((m) => m.kind === "question").length,
    ).toBeLessThanOrEqual(2);
  });
});
