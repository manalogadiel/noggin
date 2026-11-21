"use client";

import { BookOpen, CheckCircle2, House, Sprout } from "lucide-react";
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
        "hidden lg:sticky lg:top-8 lg:flex lg:flex-col lg:items-center lg:gap-2.5 lg:self-start lg:rounded-[var(--noggin-radius-pill)] lg:bg-[var(--noggin-white)] lg:p-2.5 lg:shadow-[0_12px_28px_var(--noggin-shadow),inset_0_-2px_10px_var(--noggin-shadow-inset)]",
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
              "inline-flex h-12 w-12 min-h-11 min-w-11 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
              active
                ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_14px_var(--noggin-shadow),inset_0_-2px_8px_var(--noggin-shadow-inset)]"
                : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
