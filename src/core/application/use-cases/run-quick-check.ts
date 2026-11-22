import { countWords } from "../../domain/lesson";
import { isConceptCovered, isQuestionCorrect } from "../../domain/quiz";
import {
  cardFreshness,
  nextReviewIntervalDays,
} from "../../domain/thought-card";
import { growthStage, trainingMeter } from "../../domain/training";
import type {
  AnswerGrader,
  AttemptRepository,
  CardCheckUpdate,
  CheckAttemptDraft,
  Clock,
  CurrentUser,
  LessonPage,
  NogBrain,
  NogRepository,
  NogStageSlug,
  NotebookRepository,
  QuestionBank,
  QuickCheckAttempt,
  ThoughtCardRecord,
  ThoughtCardRepository,
  TopicRepository,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

export const MAX_CHECK_CONTEXT_PAGES = 10;
export const MAX_CHECK_CONTEXT_WORDS = 1500;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const checkLocks = new Map<string, Promise<void>>();

async function withLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = checkLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  checkLocks.set(key, chained);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (checkLocks.get(key) === chained) {
      checkLocks.delete(key);
    }
  }
}

export interface RunQuickCheckDeps {
  currentUser: CurrentUser;
  clock: Clock;
  nogs: Pick<NogRepository, "findOwned">;
  topics?: Pick<TopicRepository, "findById">;
  notebook: Pick<NotebookRepository, "listPages">;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic">;
  questions: QuestionBank;
  attempts: Pick<
    AttemptRepository,
    "findLatest" | "recordCheck" | "listByNog" | "withCheckReservation"
  >;
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
  | { status: "questions_pending" }
  | { status: "not_taught" }
  | { status: "no_questions" }
  | { status: "tired_for_today" }
  | { status: "sleepy" }
  | {
      status: "ok";
      reused: boolean;
      attempts: QuickCheckAttempt[];
      meterBefore: number;
      meterAfter: number;
      stage: NogStageSlug;
    };

export function computeNotebookFingerprint(
  pages: ReadonlyArray<Pick<LessonPage, "id" | "updatedAt">>,
): string {
  return pages
    .map(
      (page) =>
        `${page.id.length}:${page.id}@${page.updatedAt.length}:${page.updatedAt}`,
    )
    .sort()
    .join("|");
}

export function selectContextPages(
  pages: ReadonlyArray<LessonPage>,
  maxPages: number = MAX_CHECK_CONTEXT_PAGES,
  maxWords: number = MAX_CHECK_CONTEXT_WORDS,
): LessonPage[] {
  const ordered = [...pages].sort((a, b) => {
    const timeCmp = a.createdAt.localeCompare(b.createdAt);
    return timeCmp !== 0 ? timeCmp : a.id.localeCompare(b.id);
  });

  const selected: LessonPage[] = [];
  let totalWords = 0;

  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (selected.length >= maxPages) {
      break;
    }
    const page = ordered[i];
    const words =
      page.wordCount > 0 ? page.wordCount : Math.max(1, countWords(page.body));
    if (selected.length > 0 && totalWords + words > maxWords) {
      continue;
    }
    selected.push(page);
    totalWords += words;
  }

  return selected.reverse();
}

export function computeNogStageFromAttempts(
  allAttempts: ReadonlyArray<{
    questionId: string;
    topicId?: string;
    attemptedAt: string;
    correct: boolean;
  }>,
  topicQuestionCounts: ReadonlyMap<string, number> = new Map(),
): NogStageSlug {
  const masteredCount = trainingMeter(allAttempts);
  const byTopic = new Map<
    string,
    Array<{ questionId: string; attemptedAt: string; correct: boolean }>
  >();

  for (const attempt of allAttempts) {
    const topicKey = attempt.topicId ?? "__default__";
    const list = byTopic.get(topicKey) ?? [];
    list.push({
      questionId: attempt.questionId,
      attemptedAt: attempt.attemptedAt,
      correct: attempt.correct,
    });
    byTopic.set(topicKey, list);
  }

  const topicMasteryRatios: number[] = [];
  for (const [topicKey, topicAttempts] of byTopic.entries()) {
    const distinctQuestions = new Set(topicAttempts.map((a) => a.questionId));
    const configuredTotal = topicQuestionCounts.get(topicKey) ?? 0;
    const denominator = Math.max(configuredTotal, distinctQuestions.size);
    if (denominator > 0) {
      topicMasteryRatios.push(trainingMeter(topicAttempts) / denominator);
    }
  }

  return growthStage(
    masteredCount,
    topicMasteryRatios,
  ).toLowerCase() as NogStageSlug;
}

function buildCardCheckUpdates(
  activeCards: ReadonlyArray<ThoughtCardRecord>,
  attemptDrafts: ReadonlyArray<CheckAttemptDraft>,
  now: Date,
): CardCheckUpdate[] {
  if (activeCards.length === 0 || attemptDrafts.length === 0) {
    return [];
  }

  const coveredTerms: string[] = [];
  const missedTerms: string[] = [];
  for (const draft of attemptDrafts) {
    for (const concept of draft.concepts) {
      const normalized = concept.concept.trim().toLowerCase();
      if (!normalized) continue;
      if (isConceptCovered(concept)) {
        coveredTerms.push(normalized);
      } else {
        missedTerms.push(normalized);
      }
    }
  }

  const updates: CardCheckUpdate[] = [];
  for (const card of activeCards) {
    const label = card.label.trim().toLowerCase();
    const haystack = `${label} ${card.paraphrase}`.toLowerCase();
    const matchesTerm = (term: string) =>
      haystack.includes(term) || (label.length >= 2 && term.includes(label));
    const matchedMissed = missedTerms.some(matchesTerm);
    const matchedCovered = coveredTerms.some(matchesTerm);

    if (!matchedMissed && !matchedCovered) {
      continue;
    }

    const currentStrength = card.strength ?? 1;
    const currentInterval = card.intervalDays ?? 1;

    if (matchedMissed) {
      const nextInterval = nextReviewIntervalDays(currentInterval, false);
      updates.push({
        cardId: card.id,
        strength: Math.max(1, currentStrength - 1),
        status: "confused",
        intervalDays: nextInterval,
        nextReviewAt: new Date(
          now.getTime() + nextInterval * DAY_IN_MS,
        ).toISOString(),
      });
    } else {
      const nextInterval = nextReviewIntervalDays(currentInterval, true);
      updates.push({
        cardId: card.id,
        strength: currentStrength + 1,
        status: "understood",
        intervalDays: nextInterval,
        nextReviewAt: new Date(
          now.getTime() + nextInterval * DAY_IN_MS,
        ).toISOString(),
      });
    }
  }

  return updates;
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

  if (deps.topics) {
    const topic = await deps.topics.findById(input.topicId);
    if (
      !topic ||
      topic.subjectId !== nog.subjectId ||
      (topic.ownerId !== null && topic.ownerId !== user.id)
    ) {
      return { status: "not_found" };
    }
    if (topic.status !== "ready") {
      return { status: "questions_pending" };
    }
  }

  const runReserved = async (): Promise<RunQuickCheckResult> => {
    const allPages = await deps.notebook.listPages(input.nogId, input.topicId);
    if (allPages.length === 0) {
      return { status: "not_taught" };
    }

    const contextPages = selectContextPages(allPages);
    const fingerprint = computeNotebookFingerprint(allPages);

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
      const topicQuestions = await deps.questions.listByTopic(input.topicId);
      const promptById = new Map(
        topicQuestions.map((question) => [question.id, question.prompt]),
      );
      const orderById = new Map(
        topicQuestions.map((question, index) => [question.id, index]),
      );
      const orderedPrevious = [...previousAttempts].sort((a, b) => {
        const orderA = orderById.get(a.questionId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = orderById.get(b.questionId) ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
      const currentNogAttempts = deps.attempts.listByNog
        ? await deps.attempts.listByNog(input.nogId)
        : previousAttempts;
      const mappedCurrent = currentNogAttempts.map((attempt) => ({
        questionId: attempt.questionId,
        topicId: attempt.topicId ?? input.topicId,
        attemptedAt: attempt.createdAt,
        correct: attempt.correct,
      }));
      const currentMeter = trainingMeter(mappedCurrent);
      const currentStage = computeNogStageFromAttempts(
        mappedCurrent,
        new Map([[input.topicId, topicQuestions.length]]),
      );
      return {
        status: "ok",
        reused: true,
        attempts: orderedPrevious.map((attempt) => ({
          ...attempt,
          prompt: promptById.get(attempt.questionId) ?? "",
        })),
        meterBefore: currentMeter,
        meterAfter: currentMeter,
        stage: currentStage,
      };
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

    const answerPrompts = questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
    }));

    let answerResult;
    try {
      answerResult = await deps.brain.answer({
        nogId: input.nogId,
        topicId: input.topicId,
        pages: contextPages,
        cards: activeCards,
        questions: answerPrompts,
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
        pages: contextPages,
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

    const cardUpdates = buildCardCheckUpdates(activeCards, attemptDrafts, now);

    const nowIso = deps.clock.now().toISOString();
    const priorNogAttempts = deps.attempts.listByNog
      ? await deps.attempts.listByNog(input.nogId)
      : previousAttempts;
    const mappedPrior = priorNogAttempts.map((attempt) => ({
      questionId: attempt.questionId,
      topicId: attempt.topicId ?? input.topicId,
      attemptedAt: attempt.createdAt,
      correct: attempt.correct,
    }));
    const meterBefore = trainingMeter(mappedPrior);
    const combinedAttempts = [
      ...mappedPrior,
      ...attemptDrafts.map((draft) => ({
        questionId: draft.questionId,
        topicId: input.topicId,
        attemptedAt: nowIso,
        correct: draft.correct,
      })),
    ];
    const meterAfter = trainingMeter(combinedAttempts);
    const nextStage = computeNogStageFromAttempts(
      combinedAttempts,
      new Map([[input.topicId, questions.length]]),
    );

    const recorded = await deps.attempts.recordCheck({
      nogId: input.nogId,
      topicId: input.topicId,
      attempts: attemptDrafts,
      cardUpdates,
      topicQuestionCount: questions.length,
      stage: nextStage,
      model: answerResult.model,
    });

    const promptById = new Map(
      questions.map((question) => [question.id, question.prompt]),
    );

    return {
      status: "ok",
      reused: false,
      attempts: recorded.map((attempt) => ({
        ...attempt,
        prompt: promptById.get(attempt.questionId) ?? "",
      })),
      meterBefore,
      meterAfter,
      stage: nextStage,
    };
  };

  if (deps.attempts.withCheckReservation) {
    return deps.attempts.withCheckReservation(
      { nogId: input.nogId },
      runReserved,
    );
  }

  return withLock(input.nogId, runReserved);
}
