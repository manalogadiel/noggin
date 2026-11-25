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
    <li className="hw-entry">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        <div className="hw-entry__top">
          <span className="hw-entry__title [overflow-wrap:anywhere]">
            {preview}
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hw-date-stamp tnum">Taught {taughtDate}</span>
            {page.kind === "follow_up_answer" && (
              <span className="hw-stamp hw-stamp--refresh">
                Follow-up
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0 text-[var(--noggin-forest)] transition-transform duration-150 motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div
          id={contentId}
          className="hw-sticky whitespace-pre-wrap [overflow-wrap:anywhere]"
        >
          {page.body}
        </div>
      )}
    </li>
  );
}
