import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AskView } from "@/components/ask/ask-view";
import { createContainer } from "@/composition/container";
import type { MicMode } from "@/core/application/ports";

export const metadata: Metadata = {
  title: "Ask",
};

export interface NogAskPageProps {
  params: Promise<{ id: string }>;
}

const HISTORY_LIMIT = 20;

export default async function NogAskPage({ params }: NogAskPageProps) {
  const { id } = await params;

  const container = await createContainer();
  const [roomResult, topicsResult, historyResult, settingsResult] =
    await Promise.all([
      container.getNogRoom({ nogId: id }),
      container.listTopics({ nogId: id }),
      container.listAskHistory({ nogId: id, limit: HISTORY_LIMIT }),
      typeof container.getProfileSettings === "function"
        ? container.getProfileSettings()
        : Promise.resolve(null),
    ]);

  if (
    roomResult.status === "unauthenticated" ||
    topicsResult.status === "unauthenticated" ||
    historyResult.status === "unauthenticated"
  ) {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${id}/ask`)}`);
  }

  if (
    roomResult.status === "not_found" ||
    topicsResult.status === "not_found" ||
    historyResult.status === "not_found"
  ) {
    notFound();
  }

  const micMode: MicMode =
    settingsResult?.status === "ok" ? settingsResult.settings.micMode : "tap";

  return (
    <AskView
      nog={{ id: roomResult.nog.id, name: roomResult.nog.name }}
      topics={topicsResult.topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
      }))}
      history={historyResult.exchanges.map((exchange) => ({
        id: exchange.answerMessageId,
        question: exchange.question,
        answer: exchange.answer,
        createdAt: exchange.createdAt,
      }))}
      micMode={micMode}
    />
  );
}
