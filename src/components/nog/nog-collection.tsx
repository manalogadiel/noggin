"use client";

import { ChevronRight, LayoutGrid, List, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  formatNogStage,
  HatchNewCard,
  NogCard,
  nogLevelForStage,
  nogRenderForStage,
  type NogCardSummary,
} from "./nog-card";

const STORAGE_KEY = "noggin.nogsView";

type CollectionView = "grid" | "list";

const viewListeners = new Set<() => void>();
let fallbackView: CollectionView = "grid";

function getClientViewSnapshot(): CollectionView {
  if (typeof window === "undefined") {
    return "grid";
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "list" || stored === "grid") {
      return stored;
    }
    return "grid";
  } catch {
    return fallbackView;
  }
}

function getServerViewSnapshot(): CollectionView {
  return "grid";
}

function subscribeView(listener: () => void): () => void {
  viewListeners.add(listener);
  if (typeof window === "undefined") {
    return () => {
      viewListeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    viewListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function persistView(next: CollectionView) {
  fallbackView = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable; keep in-memory selection for this session.
    }
  }
  for (const listener of viewListeners) {
    listener();
  }
}

export interface NogCollectionProps {
  nogs: NogCardSummary[];
}

export function NogCollection({ nogs }: NogCollectionProps) {
  const view = useSyncExternalStore(
    subscribeView,
    getClientViewSnapshot,
    getServerViewSnapshot,
  );

  function handleRadioKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      persistView(view === "grid" ? "list" : "grid");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div
          role="radiogroup"
          aria-label="View"
          className="inline-flex items-center gap-1 rounded-[var(--noggin-radius-pill)] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-1 shadow-[0_6px_16px_var(--noggin-shadow)]"
        >
          <button
            type="button"
            role="radio"
            aria-label="Grid view"
            aria-checked={view === "grid"}
            onClick={() => persistView("grid")}
            onKeyDown={handleRadioKeyDown}
            className={cn(
              "inline-flex h-11 w-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
              view === "grid"
                ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_4px_10px_var(--noggin-shadow)]"
                : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
            )}
          >
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            role="radio"
            aria-label="List view"
            aria-checked={view === "list"}
            onClick={() => persistView("list")}
            onKeyDown={handleRadioKeyDown}
            className={cn(
              "inline-flex h-11 w-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
              view === "list"
                ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_4px_10px_var(--noggin-shadow)]"
                : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
            )}
          >
            <List className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {nogs.map((nog) => (
            <NogCard key={nog.id} nog={nog} />
          ))}
          <HatchNewCard />
        </div>
      ) : (
        <ul aria-label="Nogs" className="flex flex-col gap-3">
          {nogs.map((nog) => {
            const stageLabel = formatNogStage(nog.stage);
            const level = nogLevelForStage(nog.stage);
            const imageSrc = nogRenderForStage(nog.stage);

            return (
              <li key={nog.id}>
                <Link
                  href={`/nogs/${nog.id}`}
                  aria-label={`${nog.name}, ${nog.subjectName}, ${stageLabel}`}
                  className="group flex items-center gap-4 rounded-[20px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-mint-light)] px-4 py-3 shadow-[0_8px_20px_var(--noggin-shadow),inset_0_-2px_8px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-5"
                >
                  <Image
                    src={imageSrc}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 object-contain"
                  />

                  <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="noggin-display truncate text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
                      {nog.name}
                    </span>
                    <span className="noggin-display shrink-0 text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                      Lvl. {level}
                    </span>
                    <span className="truncate text-[0.875rem] font-medium text-[var(--noggin-forest)]">
                      {nog.subjectName}
                    </span>
                  </div>

                  <ChevronRight
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-[var(--noggin-leaf-strong)] transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  />
                </Link>
              </li>
            );
          })}

          <li>
            <Link
              href="/adopt"
              className="group flex items-center gap-4 rounded-[20px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-mint-light)] px-4 py-3 shadow-[0_8px_20px_var(--noggin-shadow),inset_0_-2px_8px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-5"
            >
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-sage)] text-[var(--noggin-leaf-strong)]"
              >
                <Plus className="h-7 w-7" strokeWidth={2.75} />
              </span>

              <span className="noggin-display min-w-0 flex-1 text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
                Hatch New
              </span>

              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[var(--noggin-leaf-strong)] transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              />
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
