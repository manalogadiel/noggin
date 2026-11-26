import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NotebookView } from "@/components/notebook/notebook-view";
import { createContainer } from "@/composition/container";
import type {
  LessonPage,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";

export const metadata: Metadata = {
  title: "Notebook",
};

export interface NogNotebookPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ topic?: string | string[] }>;
}

export default async function NogNotebookPage({
  params,
  searchParams,
}: NogNotebookPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const rawTopic = Array.isArray(resolvedSearchParams?.topic)
    ? resolvedSearchParams.topic[0]
    : resolvedSearchParams?.topic;
  const requestedTopicId =
    typeof rawTopic === "string" && rawTopic.trim().length > 0
      ? rawTopic.trim()
      : undefined;

  const container = await createContainer();
  const [roomResult, topicsResult] = await Promise.all([
    container.getNogRoom({ nogId: id }),
    container.listTopics({ nogId: id }),
  ]);

  const nextUrl = `/login?next=${encodeURIComponent(`/nogs/${id}/notebook`)}`;
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
  let selectedTopic: TopicSummary | null = null;
  let pages: LessonPage[] = [];
  let thoughtCards: ThoughtCardRecord[] = [];

  if (topics.length > 0) {
    const matched = requestedTopicId
      ? topics.find((topic) => topic.id === requestedTopicId)
      : undefined;
    const targetTopic = matched ?? topics[0];

    const notebookResult = await container.getTopicNotebook({
      nogId: id,
      topicId: targetTopic.id,
    });

    if (notebookResult.status === "unauthenticated") {
      redirect(nextUrl);
    }

    if (notebookResult.status === "ok") {
      selectedTopic = notebookResult.topic;
      pages = notebookResult.pages;
      thoughtCards = notebookResult.thoughtCards;
    } else {
      selectedTopic = targetTopic;
    }
  }

  return (
    <NotebookView
      nog={roomResult.nog}
      topics={topics}
      selectedTopic={selectedTopic}
      pages={pages}
      thoughtCards={thoughtCards}
      initialTopicExplicit={Boolean(requestedTopicId)}
    />
  );
}
