import { notFound, redirect } from "next/navigation";
import { RoomComingNext } from "@/components/room/room-coming-next";
import { createContainer } from "@/composition/container";

export async function renderComingNextSubpage(
  nogId: string,
  subpath: string,
  title: string,
) {
  const container = await createContainer();
  const result = await container.getNogRoom({ nogId });

  if (result.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${nogId}/${subpath}`)}`);
  }

  if (result.status === "not_found") {
    notFound();
  }

  return <RoomComingNext nogId={result.nog.id} title={title} />;
}
