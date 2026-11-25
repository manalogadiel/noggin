"use client";

import {
  BookOpen,
  CheckCircle2,
  House,
  MessageCircleQuestion,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface RoomRailProps {
  nogId: string;
  className?: string;
}

const RAIL_ITEMS = [
  { label: "Room", suffix: "", icon: House },
  { label: "Notebook", suffix: "/notebook", icon: BookOpen },
  { label: "Analysis", suffix: "/analysis", icon: Sprout },
  { label: "Ask", suffix: "/ask", icon: MessageCircleQuestion },
  { label: "Check", suffix: "/play", icon: CheckCircle2 },
] as const;

function isRailItemActive(
  pathname: string,
  baseHref: string,
  suffix: string,
): boolean {
  const target = `${baseHref}${suffix}`;
  if (suffix === "") {
    return pathname === baseHref;
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function RoomRail({ nogId, className }: RoomRailProps) {
  const pathname = usePathname() ?? "";
  const baseHref = `/nogs/${nogId}`;

  return (
    <nav
      aria-label="Nog room sections"
      className={cn(
        "hidden lg:fixed lg:top-[120px] right-0 lg:z-20 lg:flex lg:flex-col lg:items-center lg:gap-2.5 rounded-l-[28px] rounded-r-none bg-[var(--noggin-leaf-strong)] lg:py-3 lg:pr-2 lg:pl-3 lg:shadow-[0_12px_28px_var(--noggin-shadow),inset_0_-2px_10px_var(--noggin-shadow-inset)]",
        className,
      )}
    >
      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        const href = `${baseHref}${item.suffix}`;
        const active = isRailItemActive(pathname, baseHref, item.suffix);

        return (
          <Link
            key={item.label}
            href={href}
            aria-label={item.label}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-12 w-12 min-h-11 min-w-11 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-cream)] motion-reduce:transition-none",
              active
                ? "bg-[var(--noggin-white)] text-[var(--noggin-leaf-strong)] shadow-[0_6px_14px_var(--noggin-shadow)]"
                : "text-[var(--noggin-white)] hover:bg-[color-mix(in_srgb,var(--noggin-white)_16%,transparent)]",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
