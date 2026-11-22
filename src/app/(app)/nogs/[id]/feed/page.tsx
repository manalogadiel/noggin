import type { Metadata } from "next";
import { renderComingNextSubpage } from "../_coming-next";

export const metadata: Metadata = {
  title: "Feed",
};

export default async function NogFeedComingNextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderComingNextSubpage(id, "feed", "Feed");
}
