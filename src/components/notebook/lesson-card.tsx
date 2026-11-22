"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { LessonPage } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export interface LessonCardProps {
  page: LessonPage;
}

const TAUGHT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatLessonPreview(body: string): string {
  if (body.length <= 80) {
    return body.trimEnd();
  }
  return `${body.slice(0, 80).trimEnd()}…`;
}

function formatTaughtDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "recently";
  }
  return TAUGHT_DATE_FORMAT.format(parsed);
}

export function LessonCard({ page }: LessonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const preview = formatLessonPreview(page.body);
  const taughtDate = formatTaughtDate(page.createdAt);

  return (
    <li className="rounded-[22px] bg-[var(--noggin-white)] shadow-[0_6px_18px_var(--noggin-shadow)]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full min-h-14 cursor-pointer items-start justify-between gap-3 rounded-[22px] p-4 text-left transition-colors duration-150 hover:bg-[var(--noggin-mint)]/55 motion-reduce:transition-none sm:p-5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="noggin-display text-[1rem] font-bold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
            {preview}
          </span>

          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium text-[var(--noggin-ink)]">
            <span>Taught {taughtDate}</span>
            {page.kind === "follow_up_answer" && (
              <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--noggin-forest)]">
                Follow-up
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-[var(--noggin-forest)] transition-transform duration-150 motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div
          id={contentId}
          className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5"
        >
          <p className="rounded-[16px] bg-[var(--noggin-mint)] p-4 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
            {page.body}
          </p>
        </div>
      )}
    </li>
  );
}
