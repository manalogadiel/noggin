import { describe, expect, it, vi } from "vitest";
import type {
  CheckAttemptRecord,
  LessonPage,
  NogRecord,
  QuestionRecord,
} from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { runQuickCheck } from "@/core/application/use-cases/run-quick-check";

const userId = "student-1";
const nogId = "nog-1";
const topicId = "tcp-handshake";

const nog: NogRecord = {
  id: nogId,
  ownerId: userId,
  subjectId: "networking",
  name: "Pingu",
  stage: "hatchling",
};

const eightQuestions: QuestionRecord[] = Array.from({ length: 8 }, (_, index) => {
  const num = index + 1;
  const concept = `concept-${num}`;
  return {
    id: `q-${num}`,
    topicId,
    prompt: `Question ${num}: explain ${concept}?`,
    referenceAnswer: `Reference explanation for ${concept}.`,
    sourceExcerpt: `Source excerpt for ${concept}.`,
    keyConcepts: [concept],
  };
});

function makePage(
  id: string,
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

describe("runQuickCheck 5-question selection and per-selection reuse", () => {
  it("sends exactly 5 selected questions to the answerer and grader when a topic has 8 questions", async () => {
    const page = makePage(
      "page-1",
      "concept-1 concept-2 concept-3 concept-4 concept-5",
    );
    const { deps } = createInMemoryPorts({
      userId,
      nogs: [nog],
      pages: [page],
      questions: eightQuestions,
    });

    const answerSpy = vi.spyOn(deps.brain, "answer");
    const gradeSpy = vi.spyOn(deps.grader, "grade");
    const recordSpy = vi.spyOn(deps.attempts, "recordCheck");

    const result = await runQuickCheck(deps, { nogId, topicId });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected runQuickCheck to succeed");
    }

    expect(result.reused).toBe(false);
    expect(result.attempts).toHaveLength(5);
    expect(result.attempts.map((a) => a.questionId)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);

    expect(answerSpy).toHaveBeenCalledTimes(1);
    expect(answerSpy.mock.calls[0][0].questions.map((q) => q.id)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);

    expect(gradeSpy).toHaveBeenCalledTimes(1);
    expect(gradeSpy.mock.calls[0][0].questions.map((q) => q.id)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0][0].attempts).toHaveLength(5);
    expect(recordSpy.mock.calls[0][0].topicQuestionCount).toBe(8);
  });

  it("rotates to the remaining unattempted and wrong questions on the next check with a different reuse key even when the notebook is unchanged", async () => {
    // Page covers concepts 1, 3, 4, 6, 7, 8 (leaves q-2 and q-5 wrong on Run 1)
    const page = makePage(
      "page-1",
      "concept-1 concept-3 concept-4 concept-6 concept-7 concept-8",
    );
    const { deps } = createInMemoryPorts({
      userId,
      nogs: [nog],
      pages: [page],
      questions: eightQuestions,
    });

    const answerSpy = vi.spyOn(deps.brain, "answer");
    const gradeSpy = vi.spyOn(deps.grader, "grade");
    const recordSpy = vi.spyOn(deps.attempts, "recordCheck");

    const first = await runQuickCheck(deps, { nogId, topicId });
    expect(first.status).toBe("ok");
    if (first.status !== "ok") {
      throw new Error("Expected first check to succeed");
    }
    expect(first.reused).toBe(false);
    expect(first.attempts.map((a) => [a.questionId, a.correct])).toEqual([
      ["q-1", true],
      ["q-2", false],
      ["q-3", true],
      ["q-4", true],
      ["q-5", false],
    ]);

    // Second check on the same unchanged notebook:
    // Unattempted q-6, q-7, q-8 + wrong q-2, q-5 -> [q-6, q-7, q-8, q-2, q-5]
    const second = await runQuickCheck(deps, { nogId, topicId });
    expect(second.status).toBe("ok");
    if (second.status !== "ok") {
      throw new Error("Expected second check to succeed");
    }

    expect(second.reused).toBe(false);
    expect(answerSpy).toHaveBeenCalledTimes(2);
    expect(gradeSpy).toHaveBeenCalledTimes(2);
    expect(recordSpy).toHaveBeenCalledTimes(2);

    expect(answerSpy.mock.calls[1][0].questions.map((q) => q.id)).toEqual([
      "q-6",
      "q-7",
      "q-8",
      "q-2",
      "q-5",
    ]);
    expect(second.attempts.map((a) => a.questionId)).toEqual([
      "q-6",
      "q-7",
      "q-8",
      "q-2",
      "q-5",
    ]);

    const firstKey = recordSpy.mock.calls[0][0].attempts[0].notebookFingerprint;
    const secondKey = recordSpy.mock.calls[1][0].attempts[0].notebookFingerprint;
    expect(firstKey).toEqual(expect.any(String));
    expect(secondKey).toEqual(expect.any(String));
    expect(secondKey).not.toBe(firstKey);
  });

  it("reuses the previous 5-question result without calling AI when the selected question set and notebook are unchanged", async () => {
    const page = makePage("page-1", "unrelated notes without the first five concepts");
    const priorCorrectAttempts: CheckAttemptRecord[] = ["q-6", "q-7", "q-8"].map(
      (questionId, idx) => ({
        id: `prior-${idx + 1}`,
        nogId,
        topicId,
        questionId,
        nogAnswer: `Mastered ${questionId}`,
        concepts: [
          {
            concept: `concept-${idx + 6}`,
            inAnswer: true,
            inPages: true,
            consistentWithReference: true,
          },
        ],
        correct: true,
        notebookFingerprint: "older-fingerprint",
        createdAt: `2026-11-21T01:0${idx}:00.000Z`,
      }),
    );

    const { deps } = createInMemoryPorts({
      userId,
      nogs: [nog],
      pages: [page],
      questions: eightQuestions,
      attempts: priorCorrectAttempts,
    });

    const answerSpy = vi.spyOn(deps.brain, "answer");
    const gradeSpy = vi.spyOn(deps.grader, "grade");
    const quotaSpy = vi.spyOn(deps.usage, "consumeQuota");

    // Run 1 picks unattempted [q-1, q-2, q-3, q-4, q-5]; all 5 are graded wrong (correct: false)
    const first = await runQuickCheck(deps, { nogId, topicId });
    expect(first.status).toBe("ok");
    if (first.status !== "ok") {
      throw new Error("Expected first check to succeed");
    }
    expect(first.reused).toBe(false);
    expect(first.attempts.map((a) => a.questionId)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);
    expect(answerSpy).toHaveBeenCalledTimes(1);
    expect(gradeSpy).toHaveBeenCalledTimes(1);

    quotaSpy.mockClear();

    // Run 2 on the unchanged notebook: q-1..q-5 are wrong and q-6..q-8 are right,
    // so pickCheckQuestions selects [q-1, q-2, q-3, q-4, q-5] again and reuses Run 1.
    const second = await runQuickCheck(deps, { nogId, topicId });
    expect(second.status).toBe("ok");
    if (second.status !== "ok") {
      throw new Error("Expected second check to succeed");
    }
    expect(second.reused).toBe(true);
    expect(second.attempts).toHaveLength(5);
    expect(second.attempts.map((a) => a.questionId)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);
    expect(answerSpy).toHaveBeenCalledTimes(1);
    expect(gradeSpy).toHaveBeenCalledTimes(1);
    expect(quotaSpy).not.toHaveBeenCalled();
  });

  it("accumulates trainingMeter and growthStage across all 8 distinct topic questions over multiple 5-question checks", async () => {
    const page1 = makePage(
      "page-1",
      "concept-1 concept-2 concept-3 concept-4",
      "2026-11-21T03:00:00.000Z",
    );
    const ports = createInMemoryPorts({
      userId,
      now: new Date("2026-11-21T03:00:00.000Z"),
      nogs: [{ ...nog }],
      pages: [page1],
      questions: eightQuestions,
    });

    // Check 1 selects q-1..q-5: q-1..q-4 are correct (4 mastered), q-5 is wrong
    const first = await ports.deps.attempts
      ? await runQuickCheck(ports.deps, { nogId, topicId })
      : null;
    expect(first).toMatchObject({
      status: "ok",
      reused: false,
      meterBefore: 0,
      meterAfter: 4,
      stage: "hatchling",
    });

    // Learner teaches a second page covering the remaining concepts
    ports.setNow(new Date("2026-11-21T03:10:00.000Z"));
    ports.stores.pages.push(
      makePage(
        "page-2",
        "concept-5 concept-6 concept-7 concept-8",
        "2026-11-21T03:10:00.000Z",
      ),
    );

    // Check 2 selects unattempted [q-6, q-7, q-8], wrong [q-5], and oldest right [q-1]
    const second = await runQuickCheck(ports.deps, { nogId, topicId });
    expect(second.status).toBe("ok");
    if (second.status !== "ok") {
      throw new Error("Expected second check to succeed");
    }

    expect(second.reused).toBe(false);
    expect(second.attempts.map((a) => a.questionId)).toEqual([
      "q-6",
      "q-7",
      "q-8",
      "q-5",
      "q-1",
    ]);
    expect(second.meterBefore).toBe(4);
    expect(second.meterAfter).toBe(8);
    expect(second.stage).toBe("sprout");
  });
});
