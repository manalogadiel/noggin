import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArenaPreview } from "@/components/arena/arena-preview";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Arena",
};

export default async function ArenaPage() {
  const container = await createContainer();
  const features = await container.getFeatures();

  if (!features.arena) {
    redirect("/home");
  }

  return <ArenaPreview />;
}
