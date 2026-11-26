"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      className="game-tabs flex-wrap"
    >
      {PROFILE_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
