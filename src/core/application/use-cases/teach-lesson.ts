import { normalizeText, textSimilarity } from "../../domain/card-similarity";
import { countWords, DEFAULT_LESSON_WORD_LIMIT } from "../../domain/lesson";
import { groundQuote } from "../../domain/quote-grounding";
import type { ThoughtCardStatus } from "../../domain/thought-card";
import type {
  ApplyDigestResult,
  CurrentUser,
  DigestMessageInput,
  DigestOperation,
  LessonKind,
  LessonPage,
  ListenerDigest,
  NogListener,
  NogRepository,
  NotebookRepository,
  ThoughtCardRecord,
  ThoughtCardRepository,
  TopicRepository,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

export const MAX_FOLLOW_UP_QUESTIONS = 2;
export const MAX_LISTENER_CARDS = 40;
export const CARD_DEDUPE_SIMILARITY_THRESHOLD = 0.85;

const STATUS_RANK: Record<ThoughtCardStatus, number> = {
  confused: 0,
  shaky: 1,
  understood: 2,
};

export interface TeachLessonDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  topics?: Pick<TopicRepository, "findById">;
  notebook: Pick<
    NotebookRepository,
    | "savePage"
    | "applyDigest"
    | "findPageByIdempotencyKey"
    | "findSavedDigest"
    | "countIssuedQuestions"
  > &
    Partial<Pick<NotebookRepository, "countFollowUps" | "listPages">>;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic">;
  usage: UsageRepository;
  listener: NogListener;
}

export interface TeachLessonInput {
  nogId: string;
  topicId: string;
  body: string;
  idempotencyKey: string;
  maxWords?: number;
}

export type TeachLessonResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "questions_pending" }
  | { status: "empty" }
  | { status: "overload"; wordCount: number; limit: number }
  | { status: "idempotency_conflict" }
  | { status: "already_taught"; pageId: string }
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

export function selectListenerCards(
  existingCards: ReadonlyArray<ThoughtCardRecord>,
  lessonBody: string,
  maxCards: number = MAX_LISTENER_CARDS,
): ThoughtCardRecord[] {
  if (existingCards.length <= maxCards) {
    return [...existingCards];
  }

  return existingCards
    .map((card, index) => ({
      card,
      index,
      score: textSimilarity(`${card.label} ${card.paraphrase}`, lessonBody),
    }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .slice(0, maxCards)
    .map((entry) => entry.card);
}

export function dedupeCreateOperations(
  operations: ReadonlyArray<DigestOperation>,
  existingTopicCards: ReadonlyArray<
    Pick<ThoughtCardRecord, "id" | "label" | "paraphrase"> &
      Partial<Pick<ThoughtCardRecord, "status">>
  >,
  threshold: number = CARD_DEDUPE_SIMILARITY_THRESHOLD,
): DigestOperation[] {
  if (existingTopicCards.length === 0) {
    return [...operations];
  }

  return operations.map((operation) => {
    if (operation.type !== "create") {
      return operation;
    }

    const candidateText = `${operation.label} ${operation.paraphrase}`;
    let bestCard: (typeof existingTopicCards)[number] | null = null;
    let bestScore = -1;

    for (const card of existingTopicCards) {
      const score = textSimilarity(
        candidateText,
        `${card.label} ${card.paraphrase}`,
      );
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    if (bestCard !== null && bestScore >= threshold) {
      // A repeat lesson never lowers what the card already shows.
      const keepStatus =
        bestCard.status === undefined ||
        STATUS_RANK[operation.status] >= STATUS_RANK[bestCard.status];
      return {
        type: "reinforce",
        cardId: bestCard.id,
        quote: operation.quote,
        ...(keepStatus ? { status: operation.status } : {}),
      };
    }

    return operation;
  });
}

export function applyOffTopicStatus(
  operations: ReadonlyArray<DigestOperation>,
  offTopic?: boolean,
): DigestOperation[] {
  if (!offTopic) {
    return [...operations];
  }

  return operations.map((operation) => {
    if (operation.type === "create" || operation.type === "reinforce") {
      return { ...operation, status: "shaky" };
    }
    return operation;
  });
}

export function extractReinforcedCardIds(
  operations: ReadonlyArray<DigestOperation>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const operation of operations) {
    if (operation.type === "reinforce" && !seen.has(operation.cardId)) {
      seen.add(operation.cardId);
      ids.push(operation.cardId);
    }
  }
  return ids;
}

export function matchesReplayPage(
  page: LessonPage,
  expected: {
    topicId: string;
    kind: LessonKind;
    parentLessonId: string | null;
    body: string;
  },
): boolean {
  return (
    page.topicId === expected.topicId &&
    page.kind === expected.kind &&
    (page.parentLessonId ?? null) === expected.parentLessonId &&
    page.body === expected.body
  );
}

export function filterGroundedOperations(
  operations: ReadonlyArray<DigestOperation>,
  pageBody: string,
  existingTopicCards: ReadonlyArray<Pick<ThoughtCardRecord, "id">> = [],
): DigestOperation[] {
  const validTopicCardIds = new Set(existingTopicCards.map((card) => card.id));
  const grounded: DigestOperation[] = [];

  for (const operation of operations) {
    if (operation.type === "create") {
      const matchedQuote = groundQuote(pageBody, operation.quote);
      if (matchedQuote !== null) {
        grounded.push({ ...operation, quote: matchedQuote });
      }
      continue;
    }

    if (!validTopicCardIds.has(operation.cardId)) {
      continue;
    }

    if (operation.type === "reinforce") {
      const matchedQuote = groundQuote(pageBody, operation.quote);
      if (matchedQuote !== null) {
        grounded.push({ ...operation, quote: matchedQuote });
      }
      continue;
    }

    if (operation.quote === undefined) {
      grounded.push(operation);
      continue;
    }

    const matchedQuote = groundQuote(pageBody, operation.quote);
    if (matchedQuote !== null) {
      grounded.push({ ...operation, quote: matchedQuote });
    }
  }

  return grounded;
}

const threadDigestLocks = new Map<string, Promise<void>>();

export async function withThreadDigestLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = threadDigestLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  threadDigestLocks.set(key, chained);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (threadDigestLocks.get(key) === chained) {
      threadDigestLocks.delete(key);
    }
  }
}

export async function computeRootQuestionBudget(
  notebook: Pick<NotebookRepository, "countIssuedQuestions"> &
    Partial<Pick<NotebookRepository, "countFollowUps">>,
  nogId: string,
  rootLessonId: string,
  maxQuestions: number = MAX_FOLLOW_UP_QUESTIONS,
): Promise<number> {
  const issuedQuestions = notebook.countIssuedQuestions
    ? await notebook.countIssuedQuestions(nogId, rootLessonId)
    : 0;
  const savedFollowUps = notebook.countFollowUps
    ? await notebook.countFollowUps(nogId, rootLessonId)
    : 0;
  return Math.max(
    0,
    Math.min(maxQuestions - issuedQuestions, maxQuestions - savedFollowUps),
  );
}

export function buildDigestMessages(
  digest: ListenerDigest,
): DigestMessageInput[] {
  const messages: DigestMessageInput[] = [];
  if (digest.reply.trim().length > 0) {
    messages.push({
      role: "nog",
      kind: "reply",
      body: digest.reply,
      mood: digest.mood,
    });
  }
  for (const question of digest.followUpQuestions.slice(
    0,
    MAX_FOLLOW_UP_QUESTIONS,
  )) {
    if (question.trim().length > 0) {
      messages.push({
        role: "nog",
        kind: "question",
        body: question,
        mood: digest.mood,
      });
    }
  }
  return messages;
}

export async function teachLesson(
  deps: TeachLessonDeps,
  input: TeachLessonInput,
): Promise<TeachLessonResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  let topicTitle: string | undefined;
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
    topicTitle = topic.title;
  }

  const limit = input.maxWords ?? DEFAULT_LESSON_WORD_LIMIT;
  const wordCount = countWords(input.body);
  if (wordCount === 0) {
    return { status: "empty" };
  }
  if (wordCount > limit) {
    return { status: "overload", wordCount, limit };
  }

  const existingPage = deps.notebook.findPageByIdempotencyKey
    ? await deps.notebook.findPageByIdempotencyKey(
        input.nogId,
        input.idempotencyKey,
      )
    : null;

  if (existingPage) {
    if (
      !matchesReplayPage(existingPage, {
        topicId: input.topicId,
        kind: "lesson",
        parentLessonId: null,
        body: input.body,
      })
    ) {
      return { status: "idempotency_conflict" };
    }

    const savedDigest = deps.notebook.findSavedDigest
      ? await deps.notebook.findSavedDigest(input.nogId, input.idempotencyKey)
      : null;
    if (savedDigest) {
      return {
        status: "ok",
        page: existingPage,
        digest: savedDigest.digest,
        applied: {
          applied: false,
          cardIds: savedDigest.cardIds,
          savedDigest: savedDigest.digest,
        },
        reinforcedCardIds: extractReinforcedCardIds(
          savedDigest.digest.operations,
        ),
        ...(savedDigest.digest.offTopic ? { offTopic: true } : {}),
      };
    }
  }

  if (!existingPage && deps.notebook.listPages) {
    const normalizedBody = normalizeText(input.body);
    if (normalizedBody.length > 0) {
      const priorPages = await deps.notebook.listPages(
        input.nogId,
        input.topicId,
      );
      for (const priorPage of priorPages) {
        if (
          priorPage.kind !== "lesson" ||
          priorPage.idempotencyKey === input.idempotencyKey
        ) {
          continue;
        }
        if (normalizeText(priorPage.body) !== normalizedBody) {
          continue;
        }
        if (deps.notebook.findSavedDigest) {
          const priorDigest = await deps.notebook.findSavedDigest(
            input.nogId,
            priorPage.idempotencyKey,
          );
          if (!priorDigest) {
            continue;
          }
        }
        return { status: "already_taught", pageId: priorPage.id };
      }
    }
  }

  const entitlement = new EntitlementService(deps.usage);
  const quota = await entitlement.consume(user.id, "listener", 1);
  if (!quota.allowed) {
    return { status: "tired_for_today" };
  }

  const page =
    existingPage ??
    (await deps.notebook.savePage({
      nogId: input.nogId,
      topicId: input.topicId,
      body: input.body,
      wordCount,
      kind: "lesson",
      parentLessonId: null,
      idempotencyKey: input.idempotencyKey,
    }));

  if (
    !matchesReplayPage(page, {
      topicId: input.topicId,
      kind: "lesson",
      parentLessonId: null,
      body: input.body,
    })
  ) {
    return { status: "idempotency_conflict" };
  }

  const existingCards = await deps.thoughtCards.listByTopic(
    input.nogId,
    input.topicId,
  );
  const listenerCards = selectListenerCards(existingCards, page.body);

  let rawDigest: ListenerDigest;
  try {
    rawDigest = await deps.listener.listen({
      nogId: input.nogId,
      topicId: input.topicId,
      ...(topicTitle !== undefined ? { topicTitle } : {}),
      page,
      existingCards: listenerCards,
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
    `${input.nogId}:${page.id}`,
    async () => {
      const remainingQuestionBudget = await computeRootQuestionBudget(
        deps.notebook,
        input.nogId,
        page.id,
        MAX_FOLLOW_UP_QUESTIONS,
      );
      const followUpQuestions = rawDigest.followUpQuestions
        .filter((question) => question.trim().length > 0)
        .slice(0, remainingQuestionBudget);
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
