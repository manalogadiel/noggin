"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Egg, House } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  NAV_ITEMS,
  type NavItem,
} from "@/components/shell/nav-items";
import { Wordmark } from "@/components/shell/wordmark";

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  if (icon === "egg") {
    return <Egg className="h-5 w-5 shrink-0" aria-hidden="true" />;
  }
  return <House className="h-5 w-5 shrink-0" aria-hidden="true" />;
}

export function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[240px] shrink-0 flex-col bg-[var(--noggin-leaf-strong)] px-4 pt-8 pb-6 shadow-[inset_0_-2px_12px_var(--noggin-shadow-inset)] md:flex">
      <div className="px-2">
        <Wordmark
          tone="white"
          size="sm"
          href="/home"
          className="focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--noggin-cream)]"
        />
      </div>

      <nav aria-label="App" className="mt-11 flex flex-col gap-3">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "noggin-display flex h-12 min-h-12 items-center gap-3 rounded-[var(--noggin-radius-pill)] px-4 text-[1.0625rem] font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--noggin-cream)]",
                active
                  ? "bg-[var(--noggin-cream)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                  : "text-[var(--noggin-white)] hover:bg-[color-mix(in_srgb,var(--noggin-white)_12%,transparent)]",
              )}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
