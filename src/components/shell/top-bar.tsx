import { AccountMenu } from "@/components/shell/account-menu";
import { Wordmark } from "@/components/shell/wordmark";

export interface TopBarProps {
  displayName: string | null;
}

export function TopBar({ displayName }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] w-full items-center justify-between rounded-b-[28px] bg-[color-mix(in_srgb,var(--noggin-panel)_94%,transparent)] px-4 shadow-[0_6px_20px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] backdrop-blur-md md:h-[72px] md:justify-end md:rounded-b-[45px] md:px-8">
      <div className="md:hidden">
        <Wordmark tone="forest" size="sm" href="/home" />
      </div>

      <AccountMenu displayName={displayName} />
    </header>
  );
}
