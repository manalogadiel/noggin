import Link from "next/link";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/shell/wordmark";

export interface PublicHeaderAction {
  label: string;
  href: string;
}

export interface PublicHeaderProps {
  active?: "home" | "discover";
  action?: PublicHeaderAction;
}

const DEFAULT_ACTION: PublicHeaderAction = {
  label: "Log in",
  href: "/login",
};

const NAV_TABS = [
  { key: "home", label: "Home", href: "/" },
  { key: "discover", label: "Discover", href: "/discover" },
] as const;

export function PublicHeader({
  active,
  action = DEFAULT_ACTION,
}: PublicHeaderProps) {
  return (
    <header className="relative z-20 mx-auto w-full max-w-[1280px] px-4 pt-5 md:px-10 md:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-y-3 md:flex-nowrap md:gap-x-6">
        <Wordmark
          tone="forest"
          size="lg"
          href="/"
          className="order-1 text-[1.875rem] md:text-[clamp(2rem,4vw,3.3125rem)]"
        />

        <nav
          aria-label="Main"
          className="order-3 flex w-full justify-center md:order-2 md:w-auto"
        >
          <div className="noggin-glass-pill grid h-14 w-full max-w-[320px] grid-cols-2 items-center p-1.5 md:w-auto md:max-w-none">
            {NAV_TABS.map((tab) => {
              const isActive = active === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "noggin-display inline-flex h-full min-h-11 items-center justify-center rounded-[var(--noggin-radius-pill)] px-5 text-[1.0625rem] font-semibold transition-colors md:w-[140px] md:text-[1.1875rem]",
                    isActive
                      ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_4px_12px_var(--noggin-shadow),inset_0_-2px_8px_var(--noggin-shadow-inset)]"
                      : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-glass-hover)]",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <Link
          href={action.href}
          className="noggin-primary-pill noggin-display order-2 inline-flex h-11 min-h-11 items-center justify-center px-5 text-[1rem] font-bold whitespace-nowrap md:order-3 md:h-14 md:px-6 md:text-[1.1875rem]"
        >
          {action.label}
        </Link>
      </div>
    </header>
  );
}
