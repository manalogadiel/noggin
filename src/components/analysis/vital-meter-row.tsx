"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { VitalMeterData, VitalZone } from "./vitals-config";

export interface VitalMeterRowProps {
  meter: VitalMeterData;
}

const STATUS_CHIP_STYLE: Record<VitalZone, string> = {
  high: "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]",
  mid: "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
  low: "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]",
};

const MARKER_RING_STYLE: Record<VitalZone, string> = {
  high: "border-[var(--noggin-meter-high)]",
  mid: "border-[var(--noggin-meter-mid)]",
  low: "border-[var(--noggin-meter-low)]",
};

export function VitalMeterRow({ meter }: VitalMeterRowProps) {
  const labelId = useId();
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-3 px-5 py-4 sm:px-7 sm:py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            id={labelId}
            className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]"
          >
            {meter.label}
          </span>

          <button
            type="button"
            aria-label={`About ${meter.label}`}
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--noggin-ink)] transition-colors hover:bg-[var(--noggin-mint)] hover:text-[var(--noggin-forest)] motion-reduce:transition-none"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="noggin-display inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.875rem] font-bold tabular-nums text-[var(--noggin-forest)]">
            {meter.score}/100
          </span>

          <span
            className={cn(
              "inline-flex items-center rounded-[var(--noggin-radius-pill)] px-3 py-1 text-[0.8125rem] font-semibold",
              STATUS_CHIP_STYLE[meter.tone],
            )}
          >
            {meter.status}
          </span>
        </div>
      </div>

      {open && (
        <div
          id={popoverId}
          role="region"
          aria-label={`${meter.label} details`}
          className="rounded-[18px] bg-[var(--noggin-mint)] px-4 py-3 text-[0.875rem] leading-relaxed text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)]"
        >
          {meter.explanation}
        </div>
      )}

      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={meter.score}
        aria-valuetext={`${meter.score}/100, ${meter.status}`}
        className="relative flex h-4 w-full items-center"
      >
        <div className="flex h-3 w-full overflow-hidden rounded-[var(--noggin-radius-pill)] shadow-[inset_0_1px_3px_var(--noggin-shadow-inset)]">
          <div
            aria-hidden="true"
            className="h-full w-[30%] bg-[var(--noggin-meter-low)]"
          />
          <div
            aria-hidden="true"
            className="h-full w-[30%] bg-[var(--noggin-meter-mid)]"
          />
          <div
            aria-hidden="true"
            className="h-full w-[40%] bg-[var(--noggin-meter-high)]"
          />
        </div>

        <span
          aria-hidden="true"
          style={{ left: `clamp(10px, ${meter.score}%, calc(100% - 10px))` }}
          className={cn(
            "pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-[var(--noggin-white)] shadow-[0_3px_8px_var(--noggin-shadow-strong)] transition-[left] duration-300 ease-out motion-reduce:transition-none",
            MARKER_RING_STYLE[meter.tone],
          )}
        />
      </div>
    </div>
  );
}
