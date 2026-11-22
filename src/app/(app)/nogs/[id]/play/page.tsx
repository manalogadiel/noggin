import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayView } from "@/components/check/play-view";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Practice Quiz",
};

interface PlaySearchParams {
  topic?: string | string[];
}

export interface NogPlayPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<PlaySearchParams>;
}

function readParam(value: string | string[] | undefined): string | undefined {
  const scalar = Array.isArray(value) ? value[0] : value;
  if (typeof scalar !== "string") {
    return undefined;
  }
  const trimmed = scalar.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default async function NogPlayPage({
  params,
  searchParams,
}: NogPlayPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<PlaySearchParams>({}),
  ]);

  const requestedTopicId = readParam(resolvedSearchParams?.topic);

  const container = await createContainer();
  const [roomResult, topicsResult] = await Promise.all([
    container.getNogRoom({ nogId: id }),
    container.listTopics({ nogId: id }),
  ]);

  const nextUrl = `/login?next=${encodeURIComponent(`/nogs/${id}/play`)}`;
  if (
    roomResult.status === "unauthenticated" ||
    topicsResult.status === "unauthenticated"
  ) {
    redirect(nextUrl);
  }

  if (
    roomResult.status === "not_found" ||
    topicsResult.status === "not_found"
  ) {
    notFound();
  }

  const topics = topicsResult.topics;
  const requestedReadyTopic = requestedTopicId
    ? topics.find(
        (topic) => topic.id === requestedTopicId && topic.status === "ready",
      )
    : undefined;
  const firstReadyTopic = topics.find((topic) => topic.status === "ready");
  const initialTopicId = requestedReadyTopic?.id ?? firstReadyTopic?.id ?? null;

  return (
    <PlayView
      nog={roomResult.nog}
      topics={topics}
      initialTopicId={initialTopicId}
    />
  );
}
