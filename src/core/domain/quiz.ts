export const QUICK_CHECK_SIZE = 5;

export interface ConceptCheck {
  inAnswer: boolean;
  inPages: boolean;
  consistentWithReference: boolean;
}

export interface CheckAttemptSummary {
  questionId: string;
  correct: boolean;
  createdAt?: Date | string;
  attemptedAt?: Date | string;
}

export function isConceptCovered(concept: ConceptCheck): boolean {
  return (
    concept.inAnswer &&
    concept.inPages &&
    concept.consistentWithReference
  );
}

export function isQuestionCorrect(
  concepts: ReadonlyArray<ConceptCheck>,
): boolean {
  if (concepts.length === 0) {
    return false;
  }
  // Two-thirds of the key ideas (rounded up) count as correct; missed ideas still go to Bath.
  const covered = concepts.filter(isConceptCovered).length;
  return covered >= Math.ceil((concepts.length * 2) / 3);
}

function toTimestampMs(value: Date | string | undefined): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

export function pickCheckQuestions<Q extends { id: string; position?: number }>(
  questions: ReadonlyArray<Q>,
  latestAttempts: ReadonlyArray<CheckAttemptSummary>,
  size: number = QUICK_CHECK_SIZE,
): Q[] {
  const limit = Math.max(0, Math.floor(size));
  if (limit === 0 || questions.length === 0) {
    return [];
  }

  const latestByQuestion = new Map<
    string,
    { correct: boolean; timeMs: number }
  >();
  for (const attempt of latestAttempts) {
    const timeMs = toTimestampMs(attempt.createdAt ?? attempt.attemptedAt);
    const existing = latestByQuestion.get(attempt.questionId);
    if (!existing || timeMs >= existing.timeMs) {
      latestByQuestion.set(attempt.questionId, {
        correct: attempt.correct,
        timeMs,
      });
    }
  }

  const decorated = questions.map((question, index) => {
    const attempt = latestByQuestion.get(question.id);
    const bucket = !attempt ? 0 : !attempt.correct ? 1 : 2;
    const position =
      typeof question.position === "number" && Number.isFinite(question.position)
        ? question.position
        : index;
    return {
      question,
      bucket,
      timeMs: attempt?.timeMs ?? 0,
      position,
    };
  });

  decorated.sort((a, b) => {
    if (a.bucket !== b.bucket) {
      return a.bucket - b.bucket;
    }
    if (a.bucket === 2 && a.timeMs !== b.timeMs) {
      return a.timeMs - b.timeMs;
    }
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    return a.question.id < b.question.id
      ? -1
      : a.question.id > b.question.id
        ? 1
        : 0;
  });

  return decorated.slice(0, limit).map((item) => item.question);
}
