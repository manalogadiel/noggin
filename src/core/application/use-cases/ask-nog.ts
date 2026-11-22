import {
  ASK_MAX_PAGES,
  ASK_SEARCH_LIMIT,
  boundAnswer,
  boundMood,
  checkQuestion,
  clampHistoryLimit,
  DEFAULT_ASK_MOOD,
  NOT_TAUGHT_ANSWER,
} from "../../domain/ask";
import type {
  AskExchangeRecord,
  AskHistoryRepository,
  AskOutput,
  CardEvidenceLink,
  CurrentUser,
  LessonPage,
  NogAsker,
  NogRepository,
  ThoughtCardRecord,
  TopicRepository,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

export interface AskNogDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  topics?: Pick<TopicRepository, "findById">;
  thoughtCards: {
    search(
      nogId: string,
      topicId: string | null,
      query: string,
      limit: number,
    ): Promise<ThoughtCardRecord[]>;
    listEvidenceLessonIds?(cardIds: string[]): Promise<CardEvidenceLink[]>;
  };
  notebook: {
    findPagesByIds(nogId: string, lessonIds: string[]): Promise<LessonPage[]>;
  };
  usage: UsageRepository;
  asker: NogAsker;
  askHistory: Pick<AskHistoryRepository, "save">;
}

export interface AskNogInput {
  nogId: string;
  question: string;
  topicId?: string | null;
}

export interface CitedCard {
  id: string;
  label: string;
  quote?: string;
}

export type AskNogResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "empty" }
  | { status: "too_long" }
  | { status: "tired_for_today" }
  | { status: "brain_fog" }
  | {
      status: "ok";
      knows: boolean;
      answer: string;
      mood: string;
      citedCards: CitedCard[];
      answerMessageId: string;
    };

function inScope(
  item: { nogId: string; topicId: string },
  nogId: string,
  topicId: string | null,
): boolean {
  return item.nogId === nogId && (topicId === null || item.topicId === topicId);
}

/** Lesson ids behind the retrieved cards, best-ranked card first, at most ASK_MAX_PAGES. */
async function collectLessonIds(
  deps: AskNogDeps,
  cards: ThoughtCardRecord[],
): Promise<string[]> {
  const byCard = new Map<string, string[]>();
  if (deps.thoughtCards.listEvidenceLessonIds) {
    const links = await deps.thoughtCards.listEvidenceLessonIds(
      cards.map((card) => card.id),
    );
    for (const link of links) {
      const list = byCard.get(link.cardId) ?? [];
      list.push(link.lessonId);
      byCard.set(link.cardId, list);
    }
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    const evidence = byCard.get(card.id);
    const candidates =
      evidence && evidence.length > 0
        ? evidence
        : card.sourceLessonId
          ? [card.sourceLessonId]
          : [];
    for (const id of candidates) {
      if (ids.length >= ASK_MAX_PAGES) {
        return ids;
      }
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export async function askNog(
  deps: AskNogDeps,
  input: AskNogInput,
): Promise<AskNogResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const topicId =
    typeof input.topicId === "string" && input.topicId.length > 0
      ? input.topicId
      : null;
  if (topicId !== null) {
    if (!deps.topics) {
      return { status: "not_found" };
    }
    const topic = await deps.topics.findById(topicId);
    if (
      !topic ||
      topic.subjectId !== nog.subjectId ||
      (topic.ownerId !== null && topic.ownerId !== user.id)
    ) {
      return { status: "not_found" };
    }
  }

  const checked = checkQuestion(input.question);
  if (checked.status !== "ok") {
    return checked;
  }
  const question = checked.question;

  const hits = await deps.thoughtCards.search(
    nog.id,
    topicId,
    question,
    ASK_SEARCH_LIMIT,
  );
  const cards: ThoughtCardRecord[] = [];
  const seenCards = new Set<string>();
  for (const card of hits) {
    if (cards.length >= ASK_SEARCH_LIMIT) {
      break;
    }
    if (!inScope(card, nog.id, topicId) || seenCards.has(card.id)) {
      continue;
    }
    seenCards.add(card.id);
    cards.push(card);
  }

  const save = async (
    answer: string,
    mood: string,
    knows: boolean,
    citedCards: CitedCard[],
  ): Promise<AskNogResult> => {
    const saved = await deps.askHistory.save({
      ownerId: user.id,
      nogId: nog.id,
      question,
      answer,
      mood,
    });
    return {
      status: "ok",
      knows,
      answer,
      mood,
      citedCards,
      answerMessageId: saved.answerMessageId,
    };
  };

  // Nothing taught matches: answer honestly without spending AI or quota.
  if (cards.length === 0) {
    return save(NOT_TAUGHT_ANSWER, boundMood(undefined), false, []);
  }

  const quota = await new EntitlementService(deps.usage).consume(
    user.id,
    "ask",
    1,
  );
  if (!quota.allowed) {
    return { status: "tired_for_today" };
  }

  let output: Partial<AskOutput> | null | undefined;
  try {
    const lessonIds = await collectLessonIds(deps, cards);
    const pages =
      lessonIds.length === 0
        ? []
        : (await deps.notebook.findPagesByIds(nog.id, lessonIds))
            .filter((page) => inScope(page, nog.id, topicId))
            .slice(0, ASK_MAX_PAGES);
    output = await deps.asker.ask({ nogId: nog.id, question, cards, pages });
  } catch {
    return { status: "brain_fog" };
  }

  // Only citations of cards we actually retrieved count; the answer must rest on them.
  const byId = new Map(cards.map((card) => [card.id, card]));
  const citedCards: CitedCard[] = [];
  const citedIds = new Set<string>();
  const rawCitations: unknown[] = Array.isArray(output?.citedCardIds)
    ? output.citedCardIds
    : [];
  for (const id of rawCitations) {
    if (typeof id !== "string" || citedIds.has(id)) {
      continue;
    }
    const card = byId.get(id);
    if (!card) {
      continue;
    }
    citedIds.add(id);
    citedCards.push({ id: card.id, label: card.label, quote: card.quote });
  }

  const mood = boundMood(output?.mood);
  const answer = boundAnswer(output?.answer);
  if (output?.knows !== true || citedCards.length === 0 || answer === null) {
    // Keep the model's mood only when it admitted not knowing; an overridden claim resets it.
    return save(
      NOT_TAUGHT_ANSWER,
      output?.knows === false ? mood : DEFAULT_ASK_MOOD,
      false,
      [],
    );
  }
  return save(answer, mood, true, citedCards);
}

export interface ListAskHistoryDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  askHistory: Pick<AskHistoryRepository, "listRecent">;
}

export type ListAskHistoryResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; exchanges: AskExchangeRecord[] };

export async function listAskHistory(
  deps: ListAskHistoryDeps,
  input: { nogId: string; limit?: number },
): Promise<ListAskHistoryResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }
  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const limit = clampHistoryLimit(input.limit);
  const rows = await deps.askHistory.listRecent(user.id, nog.id, limit);
  const exchanges = rows
    .filter((row) => row.nogId === nog.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
  return { status: "ok", exchanges };
}
