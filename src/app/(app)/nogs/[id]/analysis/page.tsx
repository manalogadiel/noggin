import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NogAnalysisView } from "@/components/analysis/nog-analysis-view";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Nog Analysis",
};

export interface NogAnalysisPageProps {
  params: Promise<{ id: string }>;
}

export default async function NogAnalysisPage({ params }: NogAnalysisPageProps) {
  const { id } = await params;
  const container = await createContainer();
  const result = await container.getNogAnalysis({ nogId: id });

  if (result.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${id}/analysis`)}`);
  }

  if (result.status === "not_found") {
    notFound();
  }

  return (
    <NogAnalysisView
      nog={result.nog}
      vitals={result.vitals}
      cards={result.cards}
      stage={result.stage}
    />
  );
}
