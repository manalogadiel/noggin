import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WaterView } from "@/components/care/water-view";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Water",
};

export interface NogWaterPageProps {
  params: Promise<{ id: string }>;
}

export default async function NogWaterPage({ params }: NogWaterPageProps) {
  const { id } = await params;
  const container = await createContainer();
  const [roomResult, topicsResult, dueResult] = await Promise.all([
    container.getNogRoom({ nogId: id }),
    container.listTopics({ nogId: id }),
    container.listDueCards({ nogId: id }),
  ]);

  const nextUrl = `/login?next=${encodeURIComponent(`/nogs/${id}/water`)}`;
  if (
    roomResult.status === "unauthenticated" ||
    topicsResult.status === "unauthenticated" ||
    dueResult.status === "unauthenticated"
  ) {
    redirect(nextUrl);
  }

  if (
    roomResult.status === "not_found" ||
    topicsResult.status === "not_found" ||
    dueResult.status === "not_found"
  ) {
    notFound();
  }

  return (
    <WaterView
      nog={roomResult.nog}
      topics={topicsResult.topics}
      dueCards={dueResult.cards}
    />
  );
}
