import { describe, expect, it } from "vitest";
import * as quizDomain from "@/core/domain/quiz";

interface SelectableQuestion {
  id: string;
  position?: number;
  prompt: string;
}

interface SelectableAttempt {
  questionId: string;
  correct: boolean;
  createdAt?: Date | string;
  attemptedAt?: Date | string;
}

type QuizExports = typeof quizDomain & {
  QUICK_CHECK_SIZE?: number;
  pickCheckQuestions?: <Q extends { id: string; position?: number }>(
    questions: ReadonlyArray<Q>,
    latestAttempts: ReadonlyArray<SelectableAttempt>,
    size?: number,
  ) => Q[];
};

const quiz = quizDomain as QuizExports;

function makeQuestions(count: number): SelectableQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `q-${index + 1}`,
    position: index + 1,
    prompt: `Question ${index + 1}?`,
  }));
}

describe("pickCheckQuestions and QUICK_CHECK_SIZE", () => {
  it("exports QUICK_CHECK_SIZE = 5 and selects the first 5 questions when none have attempts yet", () => {
    expect(quiz.QUICK_CHECK_SIZE).toBe(5);
    expect(quiz.pickCheckQuestions).toBeTypeOf("function");

    const questions = makeQuestions(8);
    const picked = quiz.pickCheckQuestions!(questions, []);

    expect(picked.map((q) => q.id)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);
  });

  it("orders unattempted questions first, then wrong latest attempts, then right latest attempts from oldest to newest", () => {
    expect(quiz.pickCheckQuestions).toBeTypeOf("function");

    const questions = makeQuestions(8);
    const latestAttempts: SelectableAttempt[] = [
      {
        questionId: "q-1",
        correct: true,
        createdAt: "2026-11-21T02:00:00.000Z",
      },
      {
        questionId: "q-2",
        correct: false,
        createdAt: "2026-11-21T03:30:00.000Z",
      },
      {
        questionId: "q-3",
        correct: true,
        createdAt: "2026-11-21T03:00:00.000Z",
      },
      {
        questionId: "q-4",
        correct: false,
        createdAt: "2026-11-21T04:00:00.000Z",
      },
      {
        questionId: "q-5",
        correct: true,
        createdAt: "2026-11-21T01:00:00.000Z",
      },
      {
        questionId: "q-7",
        correct: true,
        createdAt: "2026-11-21T04:30:00.000Z",
      },
    ];

    // Unattempted: q-6, q-8 (2)
    // Wrong: q-2, q-4 (2)
    // Right (oldest first): q-5 (01:00), q-1 (02:00), q-3 (03:00), q-7 (04:30)
    const picked5 = quiz.pickCheckQuestions!(questions, latestAttempts, 5);
    expect(picked5.map((q) => q.id)).toEqual([
      "q-6",
      "q-8",
      "q-2",
      "q-4",
      "q-5",
    ]);

    const pickedAll8 = quiz.pickCheckQuestions!(questions, latestAttempts, 8);
    expect(pickedAll8.map((q) => q.id)).toEqual([
      "q-6",
      "q-8",
      "q-2",
      "q-4",
      "q-5",
      "q-1",
      "q-3",
      "q-7",
    ]);
  });

  it("uses all questions when a topic has 5 or fewer questions", () => {
    expect(quiz.pickCheckQuestions).toBeTypeOf("function");

    const threeQuestions = makeQuestions(3);
    const attempts: SelectableAttempt[] = [
      {
        questionId: "q-1",
        correct: true,
        attemptedAt: "2026-11-21T01:00:00.000Z",
      },
      {
        questionId: "q-2",
        correct: false,
        attemptedAt: "2026-11-21T02:00:00.000Z",
      },
    ];

    const picked3 = quiz.pickCheckQuestions!(threeQuestions, attempts, 5);
    expect(picked3.map((q) => q.id)).toEqual(["q-3", "q-2", "q-1"]);

    const fiveQuestions = makeQuestions(5);
    const picked5 = quiz.pickCheckQuestions!(fiveQuestions, [], 5);
    expect(picked5.map((q) => q.id)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
      "q-5",
    ]);
  });

  it("breaks ties within each priority bucket by question position, then by id", () => {
    expect(quiz.pickCheckQuestions).toBeTypeOf("function");

    const questions: SelectableQuestion[] = [
      { id: "q-unattempted-b", position: 2, prompt: "Unattempted B" },
      { id: "q-unattempted-a", position: 2, prompt: "Unattempted A" },
      { id: "q-unattempted-first", position: 1, prompt: "Unattempted First" },
      { id: "q-wrong-b", position: 3, prompt: "Wrong B" },
      { id: "q-wrong-a", position: 3, prompt: "Wrong A" },
      { id: "q-right-b", position: 4, prompt: "Right B" },
      { id: "q-right-a", position: 4, prompt: "Right A" },
      { id: "q-right-first", position: 1, prompt: "Right First" },
    ];

    const sameTime = "2026-11-21T02:00:00.000Z";
    const latestAttempts: SelectableAttempt[] = [
      { questionId: "q-wrong-b", correct: false, createdAt: sameTime },
      { questionId: "q-wrong-a", correct: false, createdAt: sameTime },
      { questionId: "q-right-b", correct: true, createdAt: sameTime },
      { questionId: "q-right-a", correct: true, createdAt: sameTime },
      { questionId: "q-right-first", correct: true, createdAt: sameTime },
    ];

    const picked = quiz.pickCheckQuestions!(questions, latestAttempts, 8);
    expect(picked.map((q) => q.id)).toEqual([
      "q-unattempted-first",
      "q-unattempted-a",
      "q-unattempted-b",
      "q-wrong-a",
      "q-wrong-b",
      "q-right-first",
      "q-right-a",
      "q-right-b",
    ]);
  });
});
