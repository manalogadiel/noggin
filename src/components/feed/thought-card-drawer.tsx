"use client";

import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import type { ThoughtCardRecord } from "@/core/application/ports";
import type { ThoughtCardStatus } from "@/core/domain/thought-card";
import { cn } from "@/lib/utils";

export interface ThoughtCardDrawerProps {
  nogName: string;
  cards: ReadonlyArray<ThoughtCardRecord>;
  highlightedCardId?: string | null;
}

const STATUS_STYLE: Record<
  ThoughtCardStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  understood: {
    label: "Understood",
    dotClass: "bg-[var(--noggin-meter-high)]",
    badgeClass: "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]",
  },
  shaky: {
    label: "Shaky",
    dotClass: "bg-[var(--noggin-meter-mid)]",
    badgeClass:
      "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
  },
  confused: {
    label: "Confused",
    dotClass: "bg-[var(--noggin-meter-low)]",
    badgeClass: "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]",
  },
};

export function ThoughtCardDrawer({
  nogName,
  cards,
  highlightedCardId,
}: ThoughtCardDrawerProps) {
  const contentId = useId();
  const [open, setOpen] = useState(Boolean(highlightedCardId));

  if (cards.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={`${nogName}'s thought cards`}
      className="rounded-[28px] bg-[var(--noggin-white)] p-4 shadow-[0_10px_24px_var(--noggin-shadow)] sm:p-5"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 shrink-0 text-[var(--noggin-leaf-strong)]"
            aria-hidden="true"
          />
          <span className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
            What {nogName} remembers
          </span>
          <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-2.5 py-0.5 text-[0.75rem] font-semibold tabular-nums text-[var(--noggin-forest)]">
            {cards.length}
          </span>
        </div>

        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[var(--noggin-forest)]" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-[var(--noggin-forest)]" aria-hidden="true" />
        )}
      </button>

      {open && (
        <ul id={contentId} className="mt-3 flex flex-col gap-2.5">
          {cards.map((card) => {
            const meta = STATUS_STYLE[card.status];
            const isHighlighted = card.id === highlightedCardId;
            return (
              <li
                key={card.id}
                className={cn(
                  "rounded-[20px] p-3.5 transition-colors",
                  isHighlighted
                    ? "bg-[var(--noggin-mint-light)] ring-2 ring-[var(--noggin-leaf-strong)]"
                    : "bg-[var(--noggin-mint)]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dotClass)}
                    />
                    <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      {card.label}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "inline-flex items-center rounded-[var(--noggin-radius-pill)] px-2.5 py-0.5 text-[0.75rem] font-semibold",
                      meta.badgeClass,
                    )}
                  >
                    {meta.label}
                  </span>
                </div>

                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[var(--noggin-forest)]">
                  {card.paraphrase}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
