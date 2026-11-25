import { countWords, DEFAULT_LESSON_WORD_LIMIT } from "../../domain/lesson";
import type {
  ApplyDigestResult,
  CurrentUser,
  LessonPage,
  ListenContext,
  ListenerDigest,
  NogListener,
  NogRepository,
  NotebookRepository,
  ThoughtCardRepository,
  TopicRepository,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";
import {
  applyOffTopicStatus,
  buildDigestMessages,
  dedupeCreateOperations,
  extractReinforcedCardIds,
  filterGroundedOperations,
  matchesReplayPage,
  MAX_FOLLOW_UP_QUESTIONS,
  selectListenerCards,
  withThreadDigestLock,
} from "./teach-lesson";

export const MAX_FOLLOW_UPS_PER_LESSON = 2;

export interface AnswerFollowUpDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  topics?: Pick<TopicRepository, "findById">;
  notebook: Pick<
    NotebookRepository,
    | "findPage"
    | "findPageByIdempotencyKey"
    | "findSavedDigest"
    | "countFollowUps"
    | "countIssuedQuestions"
    | "savePage"
    | "applyDigest"
  > &
    Partial<Pick<NotebookRepository, "saveFollowUpPage">>;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic">;
  usage: UsageRepository;
  listener: NogListener;
}

export interface AnswerFollowUpInput {
  nogId: string;
  topicId: string;
  lessonId: string;
  body: string;
  idempotencyKey: string;
  maxWords?: number;
  maxFollowUps?: number;
}

export type AnswerFollowUpResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "empty" }
  | { status: "overload"; wordCount: number; limit: number }
  | { status: "follow_up_limit" }
  | { status: "idempotency_conflict" }
  | { status: "tired_for_today" }
  | { status: "brain_fog"; page: LessonPage }
  | {
      status: "ok";
      page: LessonPage;
      digest: ListenerDigest;
      applied: ApplyDigestResult;
      reinforcedCardIds?: string[];
      offTopic?: boolean;
    };

const followUpSaveLocks = new Map<string, Promise<void>>();

async function withFollowUpLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = followUpSaveLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  followUpSaveLocks.set(key, chained);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (followUpSaveLocks.get(key) === chained) {
      followUpSaveLocks.delete(key);
    }
  }
}

async function resolveRootLesson(
  notebook: Pick<NotebookRepository, "findPage">,
  nogId: string,
  lessonId: string,
): Promise<LessonPage | null> {
  const visited = new Set<string>();
  let current = await notebook.findPage(nogId, lessonId);
  while (
    current &&
    current.kind === "follow_up_answer" &&
    current.parentLessonId
  ) {
    if (visited.has(current.id)) {
      return null;
    }
    visited.add(current.id);
    current = await notebook.findPage(nogId, current.parentLessonId);
  }
  return current;
}

export async function answerFollowUp(
  deps: AnswerFollowUpDeps,
  input: AnswerFollowUpInput,
): Promise<AnswerFollowUpResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const rootLesson = await resolveRootLesson(
    deps.notebook,
    input.nogId,
    input.lessonId,
  );
  if (!rootLesson || rootLesson.topicId !== input.topicId) {
    return { status: "not_found" };
  }

  const maxFollowUps = input.maxFollowUps ?? MAX_FOLLOW_UPS_PER_LESSON;
  const limit = input.maxWords ?? DEFAULT_LESSON_WORD_LIMIT;
  const wordCount = countWords(input.body);
  if (wordCount === 0) {
    return { status: "empty" };
  }
  if (wordCount > limit) {
    return { status: "overload", wordCount, limit };
  }

  const expectedReplay = {
    topicId: rootLesson.topicId,
    kind: "follow_up_answer" as const,
    parentLessonId: rootLesson.id,
    body: input.body,
  };

  const lockKey = `${input.nogId}:${rootLesson.id}`;
  const saveOutcome = await withFollowUpLock<
    | { status: "tired_for_today" }
    | { status: "follow_up_limit" }
    | { status: "idempotency_conflict" }
    | {
        status: "replayed";
        page: LessonPage;
        digest: ListenerDigest;
        applied: ApplyDigestResult;
      }
    | { status: "ready"; page: LessonPage }
  >(lockKey, async () => {
    const existingByKey = deps.notebook.findPageByIdempotencyKey
      ? await deps.notebook.findPageByIdempotencyKey(
          input.nogId,
          input.idempotencyKey,
        )
      : null;

    if (existingByKey) {
      if (!matchesReplayPage(existingByKey, expectedReplay)) {
        return { status: "idempotency_conflict" };
      }
      const savedDigest = deps.notebook.findSavedDigest
        ? await deps.notebook.findSavedDigest(input.nogId, input.idempotencyKey)
        : null;
      if (savedDigest) {
        return {
          status: "replayed",
          page: existingByKey,
          digest: savedDigest.digest,
          applied: {
            applied: false,
            cardIds: savedDigest.cardIds,
            savedDigest: savedDigest.digest,
          },
        };
      }

      const entitlement = new EntitlementService(deps.usage);
      const quota = await entitlement.consume(user.id, "listener", 1);
      if (!quota.allowed) {
        return { status: "tired_for_today" };
      }
      return { status: "ready", page: existingByKey };
    }

    const existingFollowUps = await deps.notebook.countFollowUps(
      input.nogId,
      rootLesson.id,
    );
    if (existingFollowUps >= maxFollowUps) {
      return { status: "follow_up_limit" };
    }

    const entitlement = new EntitlementService(deps.usage);
    const quota = await entitlement.consume(user.id, "listener", 1);
    if (!quota.allowed) {
      return { status: "tired_for_today" };
    }

    if (deps.notebook.saveFollowUpPage) {
      const atomic = await deps.notebook.saveFollowUpPage({
        nogId: input.nogId,
        topicId: rootLesson.topicId,
        body: input.body,
        wordCount,
        kind: "follow_up_answer",
        parentLessonId: rootLesson.id,
        idempotencyKey: input.idempotencyKey,
        maxFollowUps,
      });
      if (atomic.status === "limit_reached") {
        return { status: "follow_up_limit" };
      }
      if (
        atomic.status === "conflict" ||
        !matchesReplayPage(atomic.page, expectedReplay)
      ) {
        return { status: "idempotency_conflict" };
      }
      if (atomic.status === "existing" && deps.notebook.findSavedDigest) {
        const savedDigest = await deps.notebook.findSavedDigest(
          input.nogId,
          input.idempotencyKey,
        );
        if (savedDigest) {
          return {
            status: "replayed",
            page: atomic.page,
            digest: savedDigest.digest,
            applied: {
              applied: false,
              cardIds: savedDigest.cardIds,
              savedDigest: savedDigest.digest,
            },
          };
        }
      }
      return { status: "ready", page: atomic.page };
    }

    const saved = await deps.notebook.savePage({
      nogId: input.nogId,
      topicId: rootLesson.topicId,
      body: input.body,
      wordCount,
      kind: "follow_up_answer",
      parentLessonId: rootLesson.id,
      idempotencyKey: input.idempotencyKey,
    });
    if (!matchesReplayPage(saved, expectedReplay)) {
      return { status: "idempotency_conflict" };
    }
    return { status: "ready", page: saved };
  });

  if (saveOutcome.status === "replayed") {
    return {
      status: "ok",
      page: saveOutcome.page,
      digest: saveOutcome.digest,
      applied: saveOutcome.applied,
      reinforcedCardIds: extractReinforcedCardIds(
        saveOutcome.digest.operations,
      ),
      ...(saveOutcome.digest.offTopic ? { offTopic: true } : {}),
    };
  }

  if (saveOutcome.status !== "ready") {
    return saveOutcome;
  }

  const page = saveOutcome.page;
  const existingCards = await deps.thoughtCards.listByTopic(
    input.nogId,
    rootLesson.topicId,
  );
  const listenerCards = selectListenerCards(existingCards, page.body);

  let topicTitle: string | undefined;
  if (deps.topics) {
    const topic = await deps.topics.findById(rootLesson.topicId);
    if (topic) {
      topicTitle = topic.title;
    }
  }

  const rootSavedDigest = deps.notebook.findSavedDigest
    ? await deps.notebook.findSavedDigest(input.nogId, rootLesson.idempotencyKey)
    : null;
  const rootQuestions = (rootSavedDigest?.digest.followUpQuestions ?? [])
    .map((question) => question.trim())
    .filter((question) => question.length > 0);
  const context: ListenContext = {
    rootLesson: rootLesson.body,
    ...(rootQuestions.length > 0
      ? { nogQuestion: rootQuestions.join("\n") }
      : {}),
  };

  let rawDigest: ListenerDigest;
  try {
    rawDigest = await deps.listener.listen({
      nogId: input.nogId,
      topicId: rootLesson.topicId,
      ...(topicTitle !== undefined ? { topicTitle } : {}),
      page,
      existingCards: listenerCards,
      context,
    });
  } catch {
    return { status: "brain_fog", page };
  }

  const dedupedOperations = dedupeCreateOperations(
    rawDigest.operations,
    existingCards,
  );
  const groundedOperations = applyOffTopicStatus(
    filterGroundedOperations(dedupedOperations, page.body, existingCards),
    rawDigest.offTopic,
  );

  const { sanitizedDigest, applied } = await withThreadDigestLock(
    `${input.nogId}:${rootLesson.id}`,
    async () => {
      const issuedQuestions = deps.notebook.countIssuedQuestions
        ? await deps.notebook.countIssuedQuestions(input.nogId, rootLesson.id)
        : maxFollowUps;
      const savedAnswers = await deps.notebook.countFollowUps(
        input.nogId,
        rootLesson.id,
      );
      const remainingQuestionBudget = Math.max(
        0,
        Math.min(maxFollowUps - issuedQuestions, maxFollowUps - savedAnswers),
      );
      const followUpQuestions = rawDigest.followUpQuestions
        .filter((question) => question.trim().length > 0)
        .slice(0, Math.min(MAX_FOLLOW_UP_QUESTIONS, remainingQuestionBudget));
      const digestToSave: ListenerDigest = {
        ...rawDigest,
        followUpQuestions,
        operations: groundedOperations,
      };

      const digestResult = await deps.notebook.applyDigest({
        nogId: input.nogId,
        lessonId: page.id,
        idempotencyKey: page.idempotencyKey,
        operations: groundedOperations,
        messages: buildDigestMessages(digestToSave),
        digest: digestToSave,
      });
      return { sanitizedDigest: digestToSave, applied: digestResult };
    },
  );

  if (!applied.applied) {
    const saved =
      applied.savedDigest ??
      (deps.notebook.findSavedDigest
        ? (
            await deps.notebook.findSavedDigest(
              input.nogId,
              page.idempotencyKey,
            )
          )?.digest
        : undefined);
    if (saved) {
      return {
        status: "ok",
        page,
        digest: saved,
        applied,
        reinforcedCardIds: extractReinforcedCardIds(saved.operations),
        ...(saved.offTopic ? { offTopic: true } : {}),
      };
    }
    return {
      status: "ok",
      page,
      digest: {
        reply: "",
        mood: sanitizedDigest.mood,
        followUpQuestions: [],
        operations: [],
      },
      applied,
      reinforcedCardIds: [],
    };
  }

  return {
    status: "ok",
    page,
    digest: sanitizedDigest,
    applied,
    reinforcedCardIds: extractReinforcedCardIds(sanitizedDigest.operations),
    ...(sanitizedDigest.offTopic ? { offTopic: true } : {}),
  };
}
