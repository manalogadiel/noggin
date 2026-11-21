import type { Metadata } from "next";
import { renderComingNextSubpage } from "../_coming-next";

export const metadata: Metadata = {
  title: "Bath",
};

export default async function NogBathComingNextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderComingNextSubpage(id, "bath", "Bath");
}
