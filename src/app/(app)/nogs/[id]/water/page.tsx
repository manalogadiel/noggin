import type { Metadata } from "next";
import { renderComingNextSubpage } from "../_coming-next";

export const metadata: Metadata = {
  title: "Water",
};

export default async function NogWaterComingNextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderComingNextSubpage(id, "water", "Water");
}
