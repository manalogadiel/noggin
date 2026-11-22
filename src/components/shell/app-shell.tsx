import type { ReactNode } from "react";
import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";

export interface AppShellProps {
  displayName: string | null;
  showArena?: boolean;
  children: ReactNode;
}

export function AppShell({
  displayName,
  showArena = false,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,var(--noggin-cream)_0%,var(--noggin-mint)_100%)] overflow-x-clip">
      <a
        href="#main"
        className="noggin-display sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-[var(--noggin-radius-pill)] focus:bg-[var(--noggin-leaf-strong)] focus:px-5 focus:py-2.5 focus:text-[0.9375rem] focus:font-semibold focus:text-[var(--noggin-white)] focus:shadow-[0_8px_20px_var(--noggin-shadow)]"
      >
        Skip to content
      </a>

      <div className="grid min-h-[100dvh] grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <Sidebar showArena={showArena} />

        <div className="flex min-w-0 flex-col">
          <TopBar displayName={displayName} />

          <main
            id="main"
            className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-6 pb-[calc(88px+env(safe-area-inset-bottom))] md:px-8 md:py-8"
          >
            {children}
          </main>
        </div>

        <BottomBar showArena={showArena} />
      </div>
    </div>
  );
}
