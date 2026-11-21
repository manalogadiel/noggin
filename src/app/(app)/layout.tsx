import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { createContainer } from "@/composition/container";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const container = await createContainer();
  const displayName = await container.getDisplayName();

  return <AppShell displayName={displayName}>{children}</AppShell>;
}
