"use client";

import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import {
  type BookCoverStyle,
  useGameUi,
} from "@/components/game-ui/game-ui-context";
import type { LearningProgressNogItem } from "@/core/application/use-cases/get-learning-progress";

const COVER_ROTATION: BookCoverStyle[] = [
  "sage",
  "honey",
  "berry",
  "denim",
  "forest",
  "gingham",
];

export function NotebookCapacityPanel({
  nogs,
}: {
  nogs: LearningProgressNogItem[];
}) {
  const { state, openModal } = useGameUi();

  return (
    <section aria-label="Notebook Capacity" className="prof-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="prof-panel__title">Notebook Capacity</span>
        <span className="text-[12px] font-bold text-[var(--noggin-ink)]">
          {state.isPlus ? "Plus Plan · 30 pages / book" : "Standard · Expandable"}
        </span>
      </div>

      <div className="prof-book-bars">
        {nogs.map((nog, index) => {
          const cover =
            state.notebookCovers[nog.id] ??
            COVER_ROTATION[index % COVER_ROTATION.length];
          const maxPages = state.isPlus
            ? 30
            : (state.notebookMaxPages[nog.id] ?? 12);
          const usedPages = Math.max(1, nog.topics.length);
          const fillPct = Math.min(
            100,
            Math.round((usedPages / Math.max(1, maxPages)) * 100),
          );
          const atMax = state.isPlus || maxPages >= 30;
          const bookTitle =
            state.notebookTitles[nog.id] ?? `${nog.name}'s Notebook`;

          return (
            <div key={nog.id} className="prof-book-row">
              <div className="prof-book-row__ico">
                <Book3dSvg
                  style={cover}
                  title={bookTitle}
                  uid={`cap-${nog.id}`}
                  className="h-full w-full"
                />
              </div>

              <div className="prof-book-row__bar">
                <div className="prof-book-row__head">
                  <span className="truncate">{bookTitle}</span>
                  <span className="shrink-0 tnum">
                    {usedPages} / {maxPages} pages
                  </span>
                </div>
                <div className="meter">
                  <i style={{ width: `${fillPct}%` }} />
                </div>
              </div>

              <button
                type="button"
                disabled={atMax}
                onClick={() =>
                  openModal({
                    type: "expandPages",
                    bookId: nog.id,
                    bookTitle,
                    cover,
                  })
                }
                aria-label={`Expand ${bookTitle} pages`}
                className="nb-expand-btn nb-expand-btn--sm shrink-0 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {atMax ? "MAX" : "+ Expand"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
