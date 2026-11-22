import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RestView } from "@/components/care/rest-view";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Rest",
};

export interface NogRestPageProps {
  params: Promise<{ id: string }>;
}

export default async function NogRestPage({ params }: NogRestPageProps) {
  const { id } = await params;
  const container = await createContainer();
  const roomResult = await container.getNogRoom({ nogId: id });

  if (roomResult.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${id}/rest`)}`);
  }

  if (roomResult.status === "not_found") {
    notFound();
  }

  return <RestView nog={roomResult.nog} />;
}
