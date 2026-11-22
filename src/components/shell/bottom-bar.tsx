"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Egg, House, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  NAV_ITEMS,
  PRIMARY_ACTION,
  type NavItem,
} from "@/components/shell/nav-items";

function BottomNavIcon({ icon }: { icon: NavItem["icon"] }) {
  if (icon === "egg") {
    return <Egg className="h-5 w-5" aria-hidden="true" />;
  }
  return <House className="h-5 w-5" aria-hidden="true" />;
}

export function BottomBar() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="App"
      className="fixed right-4 bottom-[calc(12px+env(safe-area-inset-bottom))] left-4 z-40 flex h-16 items-center justify-between rounded-[var(--noggin-radius-pill)] bg-[color-mix(in_srgb,var(--noggin-white)_92%,transparent)] px-3 shadow-[0_8px_24px_var(--noggin-shadow)] backdrop-blur-md md:hidden"
    >
      <div className="flex items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full transition-colors",
                active
                  ? "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]"
                  : "text-[var(--noggin-ink)] hover:bg-[var(--noggin-mint)]",
              )}
            >
              <BottomNavIcon icon={item.icon} />
            </Link>
          );
        })}
      </div>

      <Link
        href={PRIMARY_ACTION.href}
        aria-label={PRIMARY_ACTION.label}
        title={PRIMARY_ACTION.label}
        className="inline-flex h-[52px] w-[52px] -translate-y-2 items-center justify-center rounded-full bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_10px_24px_var(--noggin-shadow-strong),inset_0_-2px_10px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out active:scale-95 motion-reduce:transition-none"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
      </Link>
    </nav>
  );
}
