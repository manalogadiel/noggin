import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { createContainer } from "@/composition/container";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const container = await createContainer();
  const [displayName, features, ageTier] = await Promise.all([
    container.getDisplayName(),
    typeof container.getFeatures === "function"
      ? container.getFeatures().catch((): Record<string, boolean> => ({}))
      : Promise.resolve<Record<string, boolean>>({}),
    typeof container.getAgeTier === "function"
      ? container.getAgeTier().catch((): "under_13" | "standard" => "standard")
      : Promise.resolve<"under_13" | "standard">("standard"),
  ]);
  const showArena = Boolean(features.arena) && ageTier !== "under_13";

  return (
    <AppShell displayName={displayName} showArena={showArena}>
      {children}
    </AppShell>
  );
}
