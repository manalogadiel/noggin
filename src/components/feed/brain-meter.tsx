"use client";

import { useId } from "react";
import { DEFAULT_LESSON_WORD_LIMIT } from "@/core/domain/lesson";
import { cn } from "@/lib/utils";

export interface BrainMeterProps {
  wordCount: number;
  maxWords?: number;
}

export function BrainMeter({
  wordCount,
  maxWords = DEFAULT_LESSON_WORD_LIMIT,
}: BrainMeterProps) {
  const labelId = useId();
  const overloaded = wordCount > maxWords;
  const clampedValue = Math.max(0, Math.min(wordCount, maxWords));
  const fillPercent = maxWords > 0 ? Math.min(100, (wordCount / maxWords) * 100) : 0;
  const statusLabel = overloaded
    ? "Overloaded"
    : fillPercent >= 80
      ? "Almost full"
      : fillPercent > 0
        ? "Taking it in"
        : "Ready";

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        "rounded-[28px] p-4 shadow-[0_12px_28px_var(--noggin-shadow)] transition-colors duration-200 motion-reduce:transition-none sm:p-5",
        overloaded
          ? "bg-[var(--noggin-meter-low-soft)] shadow-[0_5px_0_var(--game-coral-lip),0_12px_28px_var(--noggin-shadow)]"
          : "surface-sage bg-[var(--noggin-sage)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2
            id={labelId}
            className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]"
          >
            Brain Capacity
          </h2>

          <span
            className={cn(
              "inline-flex items-center rounded-[var(--noggin-radius-pill)] px-2.5 py-0.5 text-[0.75rem] font-semibold",
              overloaded
                ? "bg-[var(--noggin-danger)] text-[var(--noggin-white)]"
                : fillPercent >= 80
                  ? "bg-[var(--noggin-cream)] text-[var(--noggin-meter-mid-ink)]"
                  : "bg-[var(--noggin-white)] text-[var(--noggin-forest)]",
            )}
          >
            {statusLabel}
          </span>
        </div>

        <span
          className={cn(
            "noggin-display text-[0.9375rem] font-bold tabular-nums",
            overloaded ? "text-[var(--noggin-danger)]" : "text-[var(--noggin-forest)]",
          )}
        >
          {wordCount} / {maxWords}
        </span>
      </div>

      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={maxWords}
        aria-valuenow={clampedValue}
        aria-valuetext={
          overloaded
            ? `${wordCount} of ${maxWords} words, brain full`
            : `${wordCount} of ${maxWords} words`
        }
        className="mt-3 h-4 w-full overflow-hidden rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] p-0.5 shadow-[inset_0_1px_4px_var(--noggin-shadow-inset)]"
      >
        <div
          aria-hidden="true"
          style={{
            width: `${fillPercent}%`,
            backgroundImage: overloaded
              ? undefined
              : "linear-gradient(90deg, var(--noggin-meter-high) 0%, var(--noggin-meter-mid) 68%, var(--noggin-meter-low) 100%)",
          }}
          className={cn(
            "h-full rounded-[var(--noggin-radius-pill)] transition-[width] duration-200 ease-out motion-reduce:transition-none",
            overloaded && "bg-[var(--noggin-meter-low)]",
          )}
        />
      </div>
    </section>
  );
}
