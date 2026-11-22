import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CustomizeView } from "@/components/customize/customize-view";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Customize Nog",
};

export interface CustomizePageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomizePage({ params }: CustomizePageProps) {
  const { id } = await params;
  const container = await createContainer();
  const roomResult = await container.getNogRoom({ nogId: id });

  if (roomResult.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${id}/customize`)}`);
  }

  if (roomResult.status === "not_found") {
    notFound();
  }

  return <CustomizeView nog={roomResult.nog} />;
}
