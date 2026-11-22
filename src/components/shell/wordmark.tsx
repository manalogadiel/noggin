import Link from "next/link";
import { cn } from "@/lib/utils";

export interface WordmarkProps {
  tone?: "forest" | "white";
  size?: "sm" | "lg";
  href?: string;
  className?: string;
}

const toneClasses = {
  forest: "text-[var(--noggin-forest)]",
  white: "text-[var(--noggin-white)]",
} as const;

const sizeClasses = {
  sm: "text-[1.875rem]",
  lg: "text-[clamp(2rem,4vw,3.3125rem)]",
} as const;

export function Wordmark({
  tone = "forest",
  size = "lg",
  href,
  className,
}: WordmarkProps) {
  const textClasses = cn(
    "noggin-display font-extrabold leading-none tracking-tight select-none",
    toneClasses[tone],
    sizeClasses[size],
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="Noggin home"
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center rounded-[var(--noggin-radius-pill)] px-1",
          textClasses,
        )}
      >
        Noggin
      </Link>
    );
  }

  return <span className={textClasses}>Noggin</span>;
}
