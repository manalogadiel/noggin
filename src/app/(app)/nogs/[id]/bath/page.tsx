import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { type BathItem, BathView } from "@/components/care/bath-view";
import { createContainer } from "@/composition/container";
import type { CheckAttemptRecord, LessonPage } from "@/core/application/ports";

export const metadata: Metadata = {
  title: "Bath",
};

interface BathSearchParams {
  card?: string | string[];
  topic?: string | string[];
}

export interface NogBathPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<BathSearchParams>;
}

function readParam(value: string | string[] | undefined): string | undefined {
  const scalar = Array.isArray(value) ? value[0] : value;
  if (typeof scalar !== "string") {
    return undefined;
  }
  const trimmed = scalar.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractMissedConceptNames(attempt: CheckAttemptRecord): string[] {
  const missed = attempt.concepts
    .filter(
      (item) =>
        !(item.inAnswer && item.inPages && item.consistentWithReference),
    )
    .map((item) => item.concept.trim())
    .filter((name) => name.length > 0);

  if (missed.length > 0) {
    return missed;
  }

  return attempt.concepts
    .map((item) => item.concept.trim())
    .filter((name) => name.length > 0);
}

export default async function NogBathPage({
  params,
  searchParams,
}: NogBathPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<BathSearchParams>({}),
  ]);

  const requestedCardId = readParam(resolvedSearchParams?.card);
  const requestedTopicId = readParam(resolvedSearchParams?.topic);

  const container = await createContainer();
  const [analysisResult, topicsResult] = await Promise.all([
    container.getNogAnalysis({ nogId: id }),
    container.listTopics({ nogId: id }),
  ]);

  const nextUrl = `/login?next=${encodeURIComponent(`/nogs/${id}/bath`)}`;
  if (
    analysisResult.status === "unauthenticated" ||
    topicsResult.status === "unauthenticated"
  ) {
    redirect(nextUrl);
  }

  if (
    analysisResult.status === "not_found" ||
    topicsResult.status === "not_found"
  ) {
    notFound();
  }

  const topicTitleById = new Map(
    topicsResult.topics.map((topic) => [topic.id, topic.title]),
  );

  const shakyOrConfusedCards = analysisResult.cards.filter(
    (card) => card.status === "shaky" || card.status === "confused",
  );

  const latestByQuestion = new Map<string, CheckAttemptRecord>();
  for (const attempt of analysisResult.attempts ?? []) {
    const existing = latestByQuestion.get(attempt.questionId);
    if (
      !existing ||
      Date.parse(attempt.createdAt) >= Date.parse(existing.createdAt)
    ) {
      latestByQuestion.set(attempt.questionId, attempt);
    }
  }
  const failedAttempts = Array.from(latestByQuestion.values()).filter(
    (attempt) => !attempt.correct,
  );

  const missedConceptsByTopic = new Map<string, string[]>();
  for (const attempt of failedAttempts) {
    const topicId = attempt.topicId;
    if (!topicId) {
      continue;
    }
    const existing = missedConceptsByTopic.get(topicId) ?? [];
    for (const conceptName of extractMissedConceptNames(attempt)) {
      if (!existing.includes(conceptName)) {
        existing.push(conceptName);
      }
    }
    missedConceptsByTopic.set(topicId, existing);
  }

  const topicIdsToLoad = Array.from(
    new Set<string>([
      ...shakyOrConfusedCards.map((card) => card.topicId),
      ...failedAttempts
        .map((attempt) => attempt.topicId)
        .filter((topicId): topicId is string => Boolean(topicId)),
    ]),
  );

  const notebookResults = await Promise.all(
    topicIdsToLoad.map((topicId) =>
      container.getTopicNotebook({ nogId: id, topicId }),
    ),
  );

  const pagesById = new Map<string, LessonPage>();
  const latestPageByTopic = new Map<string, LessonPage>();
  for (const notebookResult of notebookResults) {
    if (notebookResult.status === "unauthenticated") {
      redirect(nextUrl);
    }
    if (notebookResult.status === "ok") {
      for (const page of notebookResult.pages) {
        pagesById.set(page.id, page);
        latestPageByTopic.set(page.topicId, page);
      }
    }
  }

  const cardTopicIds = new Set(
    shakyOrConfusedCards.map((card) => card.topicId),
  );

  const items: BathItem[] = [];

  for (const card of shakyOrConfusedCards) {
    const sourcePage =
      (card.sourceLessonId ? pagesById.get(card.sourceLessonId) : undefined) ??
      latestPageByTopic.get(card.topicId);
    items.push({
      id: card.id,
      kind: "card",
      topicId: card.topicId,
      topicTitle: topicTitleById.get(card.topicId) ?? "Topic",
      title: card.label,
      statusLabel: card.status === "confused" ? "Confused" : "Shaky",
      nogAnswer: card.paraphrase,
      missedConcepts: missedConceptsByTopic.get(card.topicId) ?? [],
      cardId: card.id,
      lessonId: sourcePage?.id ?? card.sourceLessonId ?? null,
      originalLessonBody: sourcePage?.body ?? card.quote ?? "",
    });
  }

  for (const attempt of failedAttempts) {
    const topicId = attempt.topicId ?? "";
    if (topicId && cardTopicIds.has(topicId)) {
      continue;
    }
    const latestPage = topicId ? latestPageByTopic.get(topicId) : undefined;
    items.push({
      id: attempt.id,
      kind: "attempt",
      topicId,
      topicTitle: (topicId && topicTitleById.get(topicId)) || "Topic",
      title:
        (topicId && topicTitleById.get(topicId))
          ? `${topicTitleById.get(topicId)} miss`
          : "Missed question",
      statusLabel: "Missed check",
      nogAnswer: attempt.nogAnswer,
      missedConcepts: extractMissedConceptNames(attempt),
      cardId: null,
      lessonId: latestPage?.id ?? null,
      originalLessonBody: latestPage?.body ?? "",
    });
  }

  let initialSelectedId: string | null = items[0]?.id ?? null;
  if (requestedCardId) {
    const match = items.find((item) => item.cardId === requestedCardId);
    if (match) {
      initialSelectedId = match.id;
    }
  } else if (requestedTopicId) {
    const match = items.find((item) => item.topicId === requestedTopicId);
    if (match) {
      initialSelectedId = match.id;
    }
  }

  return (
    <BathView
      nog={analysisResult.nog}
      items={items}
      initialSelectedId={initialSelectedId}
    />
  );
}
