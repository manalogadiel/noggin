"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PROFILE_TABS = [
  { href: "/profile/progress", label: "Learning Progress" },
  { href: "/profile/activity", label: "Recent Activity" },
  { href: "/profile/shop", label: "Shop" },
  { href: "/profile/account", label: "Account" },
] as const;

export function ProfileTabs() {
  const pathname = usePathname() ?? "";
  const [pendingNav, setPendingNav] = useState<{ from: string; to: string } | null>(null);

  const pendingHref =
    pendingNav && pendingNav.from === pathname && pendingNav.to !== pathname
      ? pendingNav.to
      : null;

  return (
    <nav
      aria-label="Profile sections"
      className="game-tabs flex-wrap"
    >
      {PROFILE_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const isPendingTarget = pendingHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={true}
            aria-current={active ? "page" : undefined}
            className={isPendingTarget ? "is-pending" : undefined}
            onClick={() => {
              if (!active) {
                setPendingNav({ from: pathname, to: tab.href });
              }
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
