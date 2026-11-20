import { isQuestionCorrect } from "../../domain/quiz";
import { cardFreshness } from "../../domain/thought-card";
import type {
  AnswerGrader,
  AttemptRepository,
  CheckAttemptDraft,
  CheckAttemptRecord,
  Clock,
  CurrentUser,
  LessonPage,
  NogBrain,
  NogRepository,
  NotebookRepository,
  QuestionBank,
  ThoughtCardRepository,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

export interface RunQuickCheckDeps {
  currentUser: CurrentUser;
  clock: Clock;
  nogs: Pick<NogRepository, "findOwned">;
  notebook: Pick<NotebookRepository, "listPages">;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic">;
  questions: QuestionBank;
  attempts: Pick<AttemptRepository, "findLatest" | "recordCheck">;
  usage: UsageRepository;
  brain: NogBrain;
  grader: AnswerGrader;
}

export interface RunQuickCheckInput {
  nogId: string;
  topicId: string;
}

export type RunQuickCheckResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "not_taught" }
  | { status: "no_questions" }
  | { status: "tired_for_today" }
  | { status: "sleepy" }
  | { status: "ok"; reused: boolean; attempts: CheckAttemptRecord[] };

export function computeNotebookFingerprint(
  pages: ReadonlyArray<Pick<LessonPage, "id" | "updatedAt">>,
): string {
  return pages
    .map((page) => `${page.id.length}:${page.id}@${page.updatedAt.length}:${page.updatedAt}`)
    .sort()
    .join("|");
}

export async function runQuickCheck(
  deps: RunQuickCheckDeps,
  input: RunQuickCheckInput,
): Promise<RunQuickCheckResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const pages = await deps.notebook.listPages(input.nogId, input.topicId);
  if (pages.length === 0) {
    return { status: "not_taught" };
  }

  const fingerprint = computeNotebookFingerprint(pages);
  const previousAttempts = await deps.attempts.findLatest(
    input.nogId,
    input.topicId,
  );
  if (
    previousAttempts.length > 0 &&
    previousAttempts.every(
      (attempt) => attempt.notebookFingerprint === fingerprint,
    )
  ) {
    return { status: "ok", reused: true, attempts: previousAttempts };
  }

  const questions = await deps.questions.listByTopic(input.topicId);
  if (questions.length === 0) {
    return { status: "no_questions" };
  }

  const now = deps.clock.now();
  const allCards = await deps.thoughtCards.listByTopic(
    input.nogId,
    input.topicId,
  );
  const activeCards = allCards.filter((card) => {
    if (card.nextReviewAt === undefined || card.intervalDays === undefined) {
      return true;
    }
    return (
      cardFreshness(
        { nextReviewAt: card.nextReviewAt, intervalDays: card.intervalDays },
        now,
      ) !== "forgotten"
    );
  });

  const entitlement = new EntitlementService(deps.usage);
  const answerQuota = await entitlement.consume(user.id, "answer", 1);
  if (!answerQuota.allowed) {
    return { status: "tired_for_today" };
  }

  let answerResult;
  try {
    answerResult = await deps.brain.answer({
      nogId: input.nogId,
      topicId: input.topicId,
      pages,
      cards: activeCards,
      questions,
    });
  } catch {
    return { status: "sleepy" };
  }

  const gradeQuota = await entitlement.consume(user.id, "grade", 1);
  if (!gradeQuota.allowed) {
    return { status: "tired_for_today" };
  }

  let gradeResult;
  try {
    gradeResult = await deps.grader.grade({
      topicId: input.topicId,
      pages,
      questions,
      answers: answerResult.answers,
    });
  } catch {
    return { status: "sleepy" };
  }

  const answersByQuestion = new Map(
    answerResult.answers.map((item) => [item.questionId, item.nogAnswer]),
  );
  const gradesByQuestion = new Map(
    gradeResult.grades.map((item) => [item.questionId, item.concepts]),
  );

  const attemptDrafts: CheckAttemptDraft[] = questions.map((question) => {
    const nogAnswer = answersByQuestion.get(question.id) ?? "";
    const gradedConcepts = gradesByQuestion.get(question.id) ?? [];
    const conceptsByName = new Map(
      gradedConcepts.map((entry) => [entry.concept, entry]),
    );
    const normalizedConcepts = question.keyConcepts.map((concept) => {
      const match = conceptsByName.get(concept);
      return match
        ? {
            concept,
            inAnswer: Boolean(match.inAnswer),
            inPages: Boolean(match.inPages),
            consistentWithReference: Boolean(match.consistentWithReference),
          }
        : {
            concept,
            inAnswer: false,
            inPages: false,
            consistentWithReference: false,
          };
    });

    return {
      questionId: question.id,
      nogAnswer,
      concepts: normalizedConcepts,
      correct: isQuestionCorrect(normalizedConcepts),
      notebookFingerprint: fingerprint,
    };
  });

  const recorded = await deps.attempts.recordCheck({
    nogId: input.nogId,
    topicId: input.topicId,
    attempts: attemptDrafts,
    model: answerResult.model,
  });

  return { status: "ok", reused: false, attempts: recorded };
}
