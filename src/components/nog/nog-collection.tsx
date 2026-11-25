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
    <div className="relative overflow-hidden rounded-[28px] border-2 border-[var(--ng-c-d7c9a3)] bg-[var(--ng-c-f9f2df)] shadow-[0_22px_50px_rgb(24_42_8_/_0.22)]">
      {/* Spotlight Stage Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/select-stage.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-28"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgb(255_253_245_/_0.78)] via-[rgb(238_244_223_/_0.72)] to-[rgb(198_224_156_/_0.65)]"
      />

      <div className="relative z-10 grid grid-cols-1 gap-6 p-5 md:p-7 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        {/* LEFT: Storybook Parchment Roster Board */}
        <section
          aria-label="Nog roster"
          className="rounded-3xl border-2 border-[var(--ng-c-e3d6b4)] bg-[rgb(255_253_245_/_0.9)] p-4 shadow-md backdrop-blur-sm md:p-5"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ng-c-e8f6d2)] px-3.5 py-1 text-xs font-black tracking-wide text-[var(--noggin-forest)]">
              <span>OWNED:</span>
              <span>{nogs.length} / 9</span>
            </div>

            <div
              role="radiogroup"
              aria-label="View"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-1 shadow-sm"
            >
              <button
                type="button"
                role="radio"
                aria-label="Grid view"
                aria-checked={view === "grid"}
                onClick={() => persistView("grid")}
                onKeyDown={handleRadioKeyDown}
                className={cn(
                  "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors",
                  view === "grid"
                    ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow"
                    : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
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
                  "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors",
                  view === "list"
                    ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow"
                    : "text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
                )}
              >
                <List className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {nogs.map((nog) => {
                const isSelected = nog.id === selected?.id;
                const level = nogLevelForStage(nog.stage);
                const stageLabel = formatNogStage(nog.stage);
                const imageSrc = nogRenderForStage(nog.stage);
                return (
                  <div
                    key={nog.id}
                    onMouseEnter={() => setSelectedId(nog.id)}
                    onFocus={() => setSelectedId(nog.id)}
                    className={cn(
                      "group relative flex flex-col items-center rounded-2xl border-2 p-2.5 text-center transition",
                      isSelected
                        ? "border-[var(--ng-c-f5be2c)] bg-[var(--ng-c-fffdf5)] shadow-[0_6px_0_rgb(194_134_10_/_0.35)]"
                        : "border-[var(--ng-c-e3d6b4)] bg-white/85 hover:-translate-y-0.5 hover:border-[var(--noggin-leaf)]",
                    )}
                  >
                    <Link
                      href={`/nogs/${nog.id}`}
                      aria-label={`${nog.name}, ${nog.subjectName}, ${stageLabel}, Lvl. ${level}`}
                      className="flex w-full flex-col items-center gap-1"
                    >
                      <Image
                        src={imageSrc}
                        alt=""
                        width={84}
                        height={84}
                        className="h-20 w-20 object-contain"
                      />
                      <span className="noggin-display truncate text-sm font-black text-[var(--noggin-forest)]">
                        {nog.name}
                      </span>
                      <span className="rounded-full bg-[var(--ng-c-e8f6d2)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--noggin-forest)]">
                        Lvl. {level}
                      </span>
                      <span className="truncate text-[11px] font-semibold text-[var(--noggin-ink)]">
                        {nog.subjectName}
                      </span>
                    </Link>
                  </div>
                );
              })}

              <Link
                href="/adopt"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--noggin-leaf-strong)] bg-[rgb(232_246_210_/_0.55)] p-3 text-center transition hover:-translate-y-0.5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--noggin-leaf-strong)] text-white shadow">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="noggin-display text-sm font-black text-[var(--noggin-forest)]">
                  Hatch New
                </span>
                <span className="text-[11px] font-semibold text-[var(--noggin-ink)]">
                  + Subject
                </span>
              </Link>

              {LOCKED_SLOTS.map((slot) => (
                <div
                  key={slot.label}
                  aria-label={`${slot.label} (${slot.sash})`}
                  className="relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[var(--ng-c-e3d6b4)] bg-[rgb(235_227_204_/_0.7)] p-2.5 text-center opacity-70 grayscale-[40%]"
                >
                  <span className="absolute top-2 right-2 rounded-full bg-[var(--ng-c-4a2e00)] px-1.5 py-0.5 text-[9px] font-black text-[var(--ng-c-ffe588)]">
                    {slot.sash}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slot.img} alt="" className="h-14 w-14 object-contain opacity-65" />
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--noggin-ink)]">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {slot.label}
                  </span>
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

        {/* RIGHT: Open Spotlight Hero Stage with 3D Clay Books Pedestal */}
        {selected && (
          <section
            aria-label="Selected Nog showcase"
            className="flex flex-col items-center text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgb(255_253_245_/_0.92)] px-4 py-1.5 text-xs font-black tracking-wide text-[var(--noggin-forest)] shadow">
              <Sparkles className="h-3.5 w-3.5 text-[var(--noggin-leaf-strong)]" aria-hidden="true" />
              <span>
                Lvl. {nogLevelForStage(selected.stage)} · {formatNogStage(selected.stage)}
              </span>
            </div>

            <h2
              className="mt-2 text-3xl font-black tracking-wide text-[var(--noggin-forest)] uppercase md:text-4xl"
              style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
            >
              {selected.name}
            </h2>
            <p className="mt-0.5 text-xs font-bold text-[var(--noggin-ink)]">
              {selected.subjectName} · {equippedAccCount} equipped
            </p>

            <div className="relative mt-3 flex flex-col items-center">
              <div className="nog-bob relative z-10 -mb-6">
                <Image
                  src={nogRenderForStage(selected.stage)}
                  alt={`${selected.name} standing on 3D stacked books`}
                  width={220}
                  height={220}
                  className="h-44 w-44 object-contain drop-shadow-[0_14px_24px_rgb(30_48_10_/_0.26)] md:h-52 md:w-52"
                />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/game/ui/books-pedestal-3d.png"
                alt=""
                aria-hidden="true"
                className="relative z-0 w-56 object-contain md:w-64"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/nogs/${selected.id}`}
                className="ng-btn ng-btn--leaf px-6 py-3 text-sm"
              >
                <span>Open Sanctuary</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={`/nogs/${selected.id}/customize`}
                className="ng-btn ng-btn--gold px-5 py-3 text-sm"
              >
                <span>Dress Up</span>
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
