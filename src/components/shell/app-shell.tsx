import type { ReactNode } from "react";
import { ShellFrame } from "@/components/shell/shell-frame";

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

      <ShellFrame displayName={displayName} showArena={showArena}>
        {children}
      </ShellFrame>
    </div>
  );
}
