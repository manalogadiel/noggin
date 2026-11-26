import type { ReactNode } from "react";
import { GameUiProvider } from "@/components/game-ui/game-ui-context";
import { ShellFrame } from "@/components/shell/shell-frame";

export interface AppShellProps {
  displayName: string | null;
  showArena?: boolean;
  children: ReactNode;
}

export function AppShell({
  displayName,
  showArena = true,
  children,
}: AppShellProps) {
  return (
    <GameUiProvider>
      <div className="min-h-[100dvh] overflow-x-clip bg-[var(--noggin-cream)]">
        <a
          href="#main"
          className="noggin-display sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[300] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-[var(--ng-c-2f5406)] focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <ShellFrame displayName={displayName} showArena={showArena}>
          {children}
        </ShellFrame>
      </div>
    </GameUiProvider>
  );
}
