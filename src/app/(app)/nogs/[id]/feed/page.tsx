import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FeedView } from "@/components/feed/feed-view";
import { createContainer } from "@/composition/container";
import type {
  LessonPage,
  MicMode,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";

export const metadata: Metadata = {
  title: "Feed",
};

interface FeedSearchParams {
  topic?: string | string[];
  card?: string | string[];
  lesson?: string | string[];
}

export interface NogFeedPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<FeedSearchParams>;
}

function readParam(value: string | string[] | undefined): string | undefined {
  const scalar = Array.isArray(value) ? value[0] : value;
  if (typeof scalar !== "string") {
    return undefined;
  }
  const trimmed = scalar.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default async function NogFeedPage({
  params,
  searchParams,
}: NogFeedPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<FeedSearchParams>({}),
  ]);

  const requestedTopicId = readParam(resolvedSearchParams?.topic);
  const requestedCardId = readParam(resolvedSearchParams?.card);
  const requestedLessonId = readParam(resolvedSearchParams?.lesson);

  const container = await createContainer();
  const [roomResult, topicsResult, settingsResult] = await Promise.all([
    container.getNogRoom({ nogId: id }),
    container.listTopics({ nogId: id }),
    typeof container.getProfileSettings === "function"
      ? container.getProfileSettings()
      : Promise.resolve(null),
  ]);

  const micMode: MicMode =
    settingsResult?.status === "ok" ? settingsResult.settings.micMode : "tap";

  const nextUrl = `/login?next=${encodeURIComponent(`/nogs/${id}/feed`)}`;
  if (
    roomResult.status === "unauthenticated" ||
    topicsResult.status === "unauthenticated"
  ) {
    redirect(nextUrl);
  }

  if (roomResult.status === "not_found" || topicsResult.status === "not_found") {
    notFound();
  }

  const topics = topicsResult.topics;
  let fixingCard: ThoughtCardRecord | null = requestedCardId
    ? roomResult.cards.find((card) => card.id === requestedCardId) ?? null
    : null;

  let selectedTopic: TopicSummary | null = null;
  if (requestedTopicId) {
    selectedTopic =
      topics.find((topic) => topic.id === requestedTopicId) ?? null;
  } else if (fixingCard) {
    selectedTopic =
      topics.find((topic) => topic.id === fixingCard?.topicId) ?? null;
  }

  let pages: LessonPage[] = [];
  let thoughtCards: ThoughtCardRecord[] = [];

  if (selectedTopic) {
    const notebookResult = await container.getTopicNotebook({
      nogId: id,
      topicId: selectedTopic.id,
    });

    if (notebookResult.status === "unauthenticated") {
      redirect(nextUrl);
    }

    if (notebookResult.status === "ok") {
      selectedTopic = notebookResult.topic;
      pages = notebookResult.pages;
      thoughtCards = notebookResult.thoughtCards;

      if (!fixingCard && requestedCardId) {
        fixingCard =
          thoughtCards.find((card) => card.id === requestedCardId) ?? null;
      }
    }
  }

  let initialDraft = "";
  let reviseLessonId: string | null = null;

  if (fixingCard) {
    const sourcePage = fixingCard.sourceLessonId
      ? pages.find((page) => page.id === fixingCard?.sourceLessonId)
      : undefined;
    initialDraft = fixingCard.quote ?? sourcePage?.body ?? "";
    reviseLessonId = fixingCard.sourceLessonId ?? sourcePage?.id ?? null;
  } else if (requestedLessonId) {
    const targetPage = pages.find((page) => page.id === requestedLessonId);
    if (targetPage) {
      initialDraft = targetPage.body;
      reviseLessonId = targetPage.id;
    }
  }

  return (
    <FeedView
      nog={roomResult.nog}
      topics={topics}
      selectedTopic={selectedTopic}
      pages={pages}
      thoughtCards={thoughtCards}
      fixingCard={fixingCard}
      initialDraft={initialDraft}
      reviseLessonId={reviseLessonId}
      micMode={micMode}
    />
  );
}
