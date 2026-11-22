import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  startRestAction,
  wakeNogAction,
} from "@/app/(app)/nogs/[id]/rest/actions";
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

  const { nog } = roomResult;
  const onStartRest = startRestAction.bind(null, nog.id);
  const onWake = wakeNogAction.bind(null, nog.id);

  return (
    <RestView
      nog={{ id: nog.id, name: nog.name }}
      restUntil={nog.restUntil ?? null}
      now={container.clock?.now() ?? new Date()}
      onStartRest={onStartRest}
      onWake={onWake}
    />
  );
}
