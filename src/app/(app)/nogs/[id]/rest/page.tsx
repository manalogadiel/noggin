import type { Metadata } from "next";
import { renderComingNextSubpage } from "../_coming-next";

export const metadata: Metadata = {
  title: "Rest",
};

export default async function NogRestComingNextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderComingNextSubpage(id, "rest", "Rest");
}
