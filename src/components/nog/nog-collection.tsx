"use client";

import { ArrowRight, ChevronRight, LayoutGrid, List, Lock, Plus, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useGameUi } from "@/components/game-ui/game-ui-context";
import { cn } from "@/lib/utils";
import {
  formatNogStage,
  nogLevelForStage,
  nogRenderForStage,
  type NogCardSummary,
} from "./nog-card";

const STORAGE_KEY = "noggin.nogsView";

type CollectionView = "grid" | "list";

const viewListeners = new Set<() => void>();
let fallbackView: CollectionView = "grid";

const LOCKED_SLOTS = [
  { label: "Slot 5", sash: "LV. 5", img: "/game/nog/hatchling-giggling.png" },
  { label: "Slot 6", sash: "LV. 8", img: "/game/nog/flying-book.png" },
  { label: "Slot 7", sash: "PLUS", img: "/game/nog/hatchling-surprised.png" },
  { label: "Slot 8", sash: "PLUS", img: "/game/nog/hatchling-sleepy.png" },
  { label: "Slot 9", sash: "PLUS", img: "/game/nog/egg-peek.png" },
] as const;

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
  const { state } = useGameUi();
  const [selectedId, setSelectedId] = useState<string>(nogs[0]?.id ?? "");

  const selected = nogs.find((n) => n.id === selectedId) ?? nogs[0];
  const equippedAccCount = state.equippedSlots.filter(Boolean).length;

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
    <div className="game-world cs-world">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/select-stage.jpg"
        alt=""
        className="cs-bg-img"
      />
      <div className="cs-spotlight-overlay" aria-hidden="true" />

      <div className="charselect-layout">
        {/* LEFT: Sculpted Parchment Roster Board */}
        <div className="cs-board-shell">
          <Link
            href="/home"
            className="cs-side-close"
            aria-label="Return to Home"
          >
            <span aria-hidden="true" className="text-2xl font-black leading-none">
              ‹
            </span>
          </Link>

          <svg className="cs-charm cs-charm--tl" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path
              d="M32 8c-9 8-14 18-10 28 8 4 19 0 24-11-3-8-8-14-14-17z"
              fill="var(--ng-c-8bb955)"
            />
            <path
              d="M22 36c6-7 13-13 21-17"
              stroke="var(--ng-c-537d23)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <svg className="cs-charm cs-charm--tr" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path
              d="M32 6l6.2 14.4L54 22l-11.8 10.6L45 48l-13-7.6L19 48l2.8-15.4L10 22l15.8-1.6L32 6z"
              fill="var(--ng-c-ffe074)"
              stroke="var(--ng-c-d69312)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>

          <section aria-label="Nog roster" className="charselect-roster">
            <div className="charselect-roster__head">
              <div className="flex items-baseline gap-2.5">
                <h1 id="my-nogs-heading" className="cs-owned-count m-0">
                  My Nogs
                </h1>
                <span className="cs-owned-count text-[14px]">
                  <strong>{nogs.length}</strong> / 9
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="View"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--noggin-mint-light)] p-1 shadow-sm"
              >
                <button
                  type="button"
                  role="radio"
                  aria-label="Grid view"
                  aria-checked={view === "grid"}
                  onClick={() => persistView("grid")}
                  onKeyDown={handleRadioKeyDown}
                  className={cn(
                    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors",
                    view === "grid"
                      ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow"
                      : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-sage-soft)]",
                  )}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-label="List view"
                  aria-checked={view === "list"}
                  onClick={() => persistView("list")}
                  onKeyDown={handleRadioKeyDown}
                  className={cn(
                    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors",
                    view === "list"
                      ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow"
                      : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-sage-soft)]",
                  )}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {view === "grid" ? (
              <div className="cs-grid">
                {nogs.map((nog, idx) => {
                  const isSelected = nog.id === selected?.id;
                  const level = nogLevelForStage(nog.stage);
                  const stageLabel = formatNogStage(nog.stage);
                  const imageSrc = nogRenderForStage(nog.stage);
                  const isBaby = nog.stage === "hatchling";
                  const isMeadow = idx % 2 === 1;
                  return (
                    <div
                      key={nog.id}
                      onMouseEnter={() => setSelectedId(nog.id)}
                      onFocus={() => setSelectedId(nog.id)}
                      className={cn("cs-card-wrap", isSelected && "is-selected-wrap")}
                    >
                      <Link
                        href={`/nogs/${nog.id}`}
                        aria-label={`${nog.name}, ${nog.subjectName}, ${stageLabel}, Lvl. ${level}`}
                        className={cn(
                          "cs-card",
                          isMeadow && "cs-card--meadow",
                          isSelected && "is-selected",
                        )}
                      >
                        <div className="cs-card__bg" aria-hidden="true" />
                        <Image
                          src={imageSrc}
                          alt=""
                          width={152}
                          height={152}
                          className={cn("cs-card__img", isBaby && "cs-card__img--baby")}
                        />
                        <span className="cs-card__ribbon">
                          <span>{nog.name}</span>{" "}
                          <span className="text-[11px] opacity-90">Lvl. {level}</span>
                        </span>
                      </Link>
                    </div>
                  );
                })}

                <div className="cs-card-wrap">
                  <Link href="/adopt" className="cs-card cs-card--hatch">
                    <div className="cs-card__bg" aria-hidden="true" />
                    <span
                      className="mynog-hatch-plus relative z-[3] my-auto flex h-14 w-14 items-center justify-center"
                      aria-hidden="true"
                    >
                      <Plus className="h-7 w-7" />
                    </span>
                    <span className="cs-card__ribbon">Hatch New</span>
                  </Link>
                </div>

                {LOCKED_SLOTS.map((slot) => (
                  <div key={slot.label} className="cs-card-wrap is-locked-wrap">
                    <div
                      aria-label={`${slot.label} (${slot.sash})`}
                      className="cs-card cs-card--locked"
                    >
                      <div className="cs-card__bg">
                        <span className="cs-card__sash">{slot.sash}</span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slot.img} alt="" className="cs-card__img" />
                      <span className="cs-card__lock" aria-hidden="true">
                        <Lock className="h-4 w-4" />
                      </span>
                      <span className="cs-card__ribbon">{slot.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul aria-label="Nogs" className="flex flex-col gap-2.5">
                {nogs.map((nog) => {
                  const stageLabel = formatNogStage(nog.stage);
                  const level = nogLevelForStage(nog.stage);
                  const imageSrc = nogRenderForStage(nog.stage);

                  return (
                    <li key={nog.id}>
                      <Link
                        href={`/nogs/${nog.id}`}
                        aria-label={`${nog.name}, ${nog.subjectName}, ${stageLabel}`}
                        onMouseEnter={() => setSelectedId(nog.id)}
                        className="group flex items-center gap-3.5 rounded-2xl border border-[var(--noggin-sage-strong)] bg-[var(--noggin-mint-light)] px-4 py-2.5 shadow-sm transition hover:-translate-y-0.5"
                      >
                        <Image
                          src={imageSrc}
                          alt=""
                          width={56}
                          height={56}
                          className="h-14 w-14 shrink-0 object-contain"
                        />

                        <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                          <span className="noggin-display truncate text-lg font-extrabold text-[var(--noggin-forest)]">
                            {nog.name}
                          </span>
                          <span className="noggin-display shrink-0 text-sm font-bold text-[var(--noggin-forest)]">
                            Lvl. {level}
                          </span>
                          <span className="truncate text-xs font-medium text-[var(--noggin-forest)]">
                            {nog.subjectName}
                          </span>
                        </div>

                        <ChevronRight
                          aria-hidden="true"
                          className="h-5 w-5 shrink-0 text-[var(--noggin-leaf-strong)]"
                        />
                      </Link>
                    </li>
                  );
                })}

                <li>
                  <Link
                    href="/adopt"
                    className="flex items-center gap-3.5 rounded-2xl border border-[var(--noggin-sage-strong)] bg-[var(--noggin-mint-light)] px-4 py-2.5 shadow-sm transition hover:-translate-y-0.5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-sage)] text-[var(--noggin-leaf-strong)]"
                    >
                      <Plus className="h-6 w-6" strokeWidth={2.75} />
                    </span>

                    <span className="noggin-display min-w-0 flex-1 text-lg font-extrabold text-[var(--noggin-forest)]">
                      Hatch New
                    </span>

                    <ChevronRight
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-[var(--noggin-leaf-strong)]"
                    />
                  </Link>
                </li>
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT: Open Spotlight Hero Stage with 3D Clay Books Pedestal */}
        {selected && (
          <section aria-label="Selected Nog showcase" className="cs-hero">
            <div className="cs-hero-crest">
              <span className="cs-hero-crest__badge" aria-hidden="true">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span>
                Lvl. {nogLevelForStage(selected.stage)} · {formatNogStage(selected.stage)}
              </span>
            </div>

            <h2 className="cs-hero__name">{selected.name}</h2>

            <div className="cs-stage-group">
              <div className="cs-pedestal-wrap">
                <div
                  className={cn(
                    "cs-pedestal-bob nog-bob",
                    selected.stage === "hatchling" && "cs-pedestal-bob--baby",
                  )}
                >
                  <Image
                    src={nogRenderForStage(selected.stage)}
                    alt={`${selected.name} standing on 3D stacked books`}
                    width={316}
                    height={316}
                    className={cn(
                      "cs-pedestal-wrap__nog",
                      selected.stage === "hatchling" && "cs-pedestal-wrap__nog--baby",
                    )}
                  />
                </div>
                <div className="cs-books-3d-wrap">
                  <div className="cs-nog-book-shadow" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/game/ui/books-pedestal-3d.png"
                    alt=""
                    aria-hidden="true"
                    className="cs-books-3d"
                  />
                </div>
              </div>

              <div className="charselect-vitals-row">
                <span className="charselect-vitals-chip">{selected.subjectName}</span>
                <span className="charselect-vitals-chip">{equippedAccCount} equipped</span>
              </div>

              <div className="cs-action-row">
                <Link href={`/nogs/${selected.id}`} className="cs-select-btn-3d">
                  <span>Open Sanctuary</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={`/nogs/${selected.id}/customize`} className="cs-customize-btn-3d">
                  Dress Up
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
