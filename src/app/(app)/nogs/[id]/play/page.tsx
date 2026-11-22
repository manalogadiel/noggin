import type { Metadata } from "next";
import { renderComingNextSubpage } from "../_coming-next";

export const metadata: Metadata = {
  title: "Play",
};

export default async function NogPlayComingNextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderComingNextSubpage(id, "play", "Play");
}
