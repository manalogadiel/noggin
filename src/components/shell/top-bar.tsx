import type { ReactNode } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { Wordmark } from "@/components/shell/wordmark";
import { cn } from "@/lib/utils";

export interface TopBarProps {
  displayName: string | null;
  focusMode?: boolean;
  leading?: ReactNode;
}

export function TopBar({
  displayName,
  focusMode = false,
  leading,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[60px] w-full items-center justify-between rounded-b-[28px] bg-[color-mix(in_srgb,var(--noggin-panel)_94%,transparent)] px-4 shadow-[0_6px_20px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] backdrop-blur-md md:h-[72px] md:rounded-b-[45px] md:px-8",
        !focusMode && "md:justify-end",
      )}
    >
      {focusMode ? (
        <div className="flex items-center">{leading}</div>
      ) : (
        <div className="md:hidden">
          <Wordmark tone="forest" size="sm" href="/home" />
        </div>
      )}

      <AccountMenu displayName={displayName} />
    </header>
  );
}
