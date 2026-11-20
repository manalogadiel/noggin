import { countWords, DEFAULT_LESSON_WORD_LIMIT } from "../../domain/lesson";
import type {
  ApplyDigestResult,
  CurrentUser,
  LessonPage,
  ListenerDigest,
  NogListener,
  NogRepository,
  NotebookRepository,
  ThoughtCardRepository,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";
import {
  buildDigestMessages,
  filterGroundedOperations,
  MAX_FOLLOW_UP_QUESTIONS,
} from "./teach-lesson";

export interface ReviseLessonDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  notebook: Pick<
    NotebookRepository,
    "findPage" | "findPageByIdempotencyKey" | "savePage" | "applyDigest"
  >;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic">;
  usage: UsageRepository;
  listener: NogListener;
}

export interface ReviseLessonInput {
  nogId: string;
  topicId: string;
  lessonId: string;
  body: string;
  idempotencyKey: string;
  maxWords?: number;
}

export type ReviseLessonResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "empty" }
  | { status: "overload"; wordCount: number; limit: number }
  | { status: "tired_for_today" }
  | { status: "brain_fog"; page: LessonPage }
  | {
      status: "ok";
      page: LessonPage;
      digest: ListenerDigest;
      applied: ApplyDigestResult;
    };

export async function reviseLesson(
  deps: ReviseLessonDeps,
  input: ReviseLessonInput,
): Promise<ReviseLessonResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const original = await deps.notebook.findPage(input.nogId, input.lessonId);
  if (!original || original.topicId !== input.topicId) {
    return { status: "not_found" };
  }

  const limit = input.maxWords ?? DEFAULT_LESSON_WORD_LIMIT;
  const wordCount = countWords(input.body);
  if (wordCount === 0) {
    return { status: "empty" };
  }
  if (wordCount > limit) {
    return { status: "overload", wordCount, limit };
  }

  const entitlement = new EntitlementService(deps.usage);
  const quota = await entitlement.consume(user.id, "listener", 1);
  if (!quota.allowed) {
    return { status: "tired_for_today" };
  }

  const existingPage = deps.notebook.findPageByIdempotencyKey
    ? await deps.notebook.findPageByIdempotencyKey(
        input.nogId,
        input.idempotencyKey,
      )
    : null;

  const page =
    existingPage ??
    (await deps.notebook.savePage({
      nogId: input.nogId,
      topicId: original.topicId,
      body: input.body,
      wordCount,
      kind: "lesson",
      parentLessonId: original.id,
      idempotencyKey: input.idempotencyKey,
    }));

  const existingCards = await deps.thoughtCards.listByTopic(
    input.nogId,
    original.topicId,
  );

  let rawDigest: ListenerDigest;
  try {
    rawDigest = await deps.listener.listen({
      nogId: input.nogId,
      topicId: original.topicId,
      page,
      existingCards,
    });
  } catch {
    return { status: "brain_fog", page };
  }

  const groundedOperations = filterGroundedOperations(
    rawDigest.operations,
    page.body,
    existingCards,
  );
  const followUpQuestions = rawDigest.followUpQuestions.slice(
    0,
    MAX_FOLLOW_UP_QUESTIONS,
  );
  const sanitizedDigest: ListenerDigest = {
    ...rawDigest,
    followUpQuestions,
    operations: groundedOperations,
  };

  const applied = await deps.notebook.applyDigest({
    nogId: input.nogId,
    lessonId: page.id,
    idempotencyKey: page.idempotencyKey,
    operations: groundedOperations,
    messages: buildDigestMessages(sanitizedDigest),
  });

  return {
    status: "ok",
    page,
    digest: sanitizedDigest,
    applied,
  };
}
