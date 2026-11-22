import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { createContainer } from "@/composition/container";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const container = await createContainer();
  const [displayName, features] = await Promise.all([
    container.getDisplayName(),
    typeof container.getFeatures === "function"
      ? container.getFeatures().catch((): Record<string, boolean> => ({}))
      : Promise.resolve<Record<string, boolean>>({}),
  ]);
  const showArena = Boolean(features.arena);

  return (
    <AppShell displayName={displayName} showArena={showArena}>
      {children}
    </AppShell>
  );
}
