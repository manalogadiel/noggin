import type { Metadata } from "next";
import { HomeView, type HomeNogSummary } from "@/components/home/home-view";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Home",
};

function extractFirstName(displayName: string | null): string | null {
  if (!displayName) {
    return null;
  }
  const first = displayName.trim().split(/\s+/)[0];
  return first ? first : null;
}

export default async function HomePage() {
  const container = await createContainer();
  const displayName = await container.getDisplayName();
  const firstName = extractFirstName(displayName);

  let nogs: HomeNogSummary[] | null = null;
  let error = false;

  try {
    const result = await container.listNogs();
    if (result.status === "ok") {
      nogs = result.nogs.map((nog) => ({
        id: nog.id,
        name: nog.name,
        stage: nog.stage,
      }));
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  return <HomeView firstName={firstName} nogs={nogs} error={error} />;
}
