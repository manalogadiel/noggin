"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PROFILE_TABS = [
  { href: "/profile/progress", label: "Learning Progress" },
  { href: "/profile/activity", label: "Recent Activity" },
  { href: "/profile/shop", label: "Shop" },
  { href: "/profile/account", label: "Account" },
] as const;

export function ProfileTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Profile sections"
      className="flex flex-wrap items-center gap-2.5"
    >
      {PROFILE_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "noggin-display inline-flex min-h-11 items-center justify-center rounded-[var(--noggin-radius-pill)] px-5 py-2.5 text-[0.9375rem] font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf-strong)]",
              active
                ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                : "bg-[var(--noggin-mint)] text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
