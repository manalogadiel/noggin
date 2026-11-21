"use client";

import {
  Bath,
  BookOpen,
  Droplets,
  Egg,
  Gamepad2,
  House,
  Menu,
  Moon,
  Plus,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { NogAvatar } from "@/components/nog/nog-avatar";
import { usePetting } from "@/components/nog/use-petting";
import { VitalsSummary } from "@/components/nog/vitals-summary";
import {
  SettingsSheet,
  type SaveProfileSettingsHandler,
} from "@/components/settings/settings-sheet";
import {
  isNavItemActive,
  NAV_ITEMS,
  PRIMARY_ACTION,
} from "@/components/shell/nav-items";
import type {
  NogRecord,
  NogStageSlug,
  ProfileSettings,
} from "@/core/application/ports";
import type { VitalsResult } from "@/core/domain/vitals";
import { cn } from "@/lib/utils";

export interface RoomViewProps {
  nog: NogRecord;
  vitals: VitalsResult;
  progress: number;
  initialSettings: ProfileSettings;
  onSaveSettings: SaveProfileSettingsHandler;
  onPet: () => Promise<void>;
}

const STAGE_LEVEL: Record<NogStageSlug, number> = {
  hatchling: 1,
  sprout: 2,
  scholar: 3,
  genius: 4,
};

const ROOM_ACTIONS = [
  { label: "Feed", slug: "feed", icon: Utensils },
  { label: "Water", slug: "water", icon: Droplets },
  { label: "Bath", slug: "bath", icon: Bath },
  { label: "Play", slug: "play", icon: Gamepad2 },
  { label: "Rest", slug: "rest", icon: Moon },
] as const;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function NogRoomView({
  nog,
  vitals,
  progress,
  initialSettings,
  onSaveSettings,
  onPet,
}: RoomViewProps) {
  const pathname = usePathname() ?? "";
  const navPanelId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const { reaction, message, tapCount, pet } = usePetting({ onPet });

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const level = STAGE_LEVEL[nog.stage] ?? 1;
  const clampedProgress = clampProgress(progress);
  const subjectLabel = nog.subjectName?.trim() || "Custom subject";
  const roomBaseHref = `/nogs/${nog.id}`;

  return (
    <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-x-8 lg:gap-y-6">
      <div className="flex min-w-0 flex-col lg:col-start-1 lg:row-start-1">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls={navPanelId}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <h1 className="noggin-display truncate text-[clamp(2.5rem,5.5vw,4.5rem)] font-extrabold leading-[0.95] text-[var(--noggin-leaf-title)]">
              Nog Room
            </h1>
          </div>

          <SettingsSheet
            initialSettings={initialSettings}
            onSave={onSaveSettings}
          />

          <div
            id={navPanelId}
            hidden={!menuOpen}
            className="absolute top-[calc(100%+10px)] left-0 z-40 w-64 rounded-[28px] bg-[var(--noggin-leaf-strong)] p-3 text-[var(--noggin-white)] shadow-[0_16px_38px_var(--noggin-shadow-strong),inset_0_-2px_12px_var(--noggin-shadow-inset)]"
          >
            <nav aria-label="Room navigation" className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const Icon = item.icon === "egg" ? Egg : House;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "noggin-display flex min-h-11 items-center gap-3 rounded-[var(--noggin-radius-pill)] px-4 py-2 text-[1rem] font-semibold transition-colors",
                      active
                        ? "bg-[var(--noggin-cream)] text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]"
                        : "text-[var(--noggin-white)] hover:bg-[color-mix(in_srgb,var(--noggin-white)_14%,transparent)]",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <Link
                href={PRIMARY_ACTION.href}
                onClick={() => setMenuOpen(false)}
                className="noggin-display mt-1 flex min-h-11 items-center gap-3 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-4 py-2 text-[1rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]"
              >
                <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{PRIMARY_ACTION.label}</span>
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col items-center justify-center lg:mt-6">
          <NogAvatar
            name={nog.name}
            reaction={reaction}
            message={message}
            tapCount={tapCount}
            onTap={pet}
            className="w-full"
          />
        </div>
      </div>

      <section
        aria-label={`${nog.name} care panel`}
        className="flex w-full flex-col gap-4 rounded-[36px] bg-[var(--noggin-panel)] p-5 shadow-[0_14px_34px_var(--noggin-shadow),inset_0_-4px_16px_var(--noggin-shadow-inset)] sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:rounded-[50px] lg:p-7"
      >
        <div className="rounded-[28px] bg-[var(--noggin-leaf-strong)] p-5 text-[var(--noggin-white)] shadow-[0_8px_20px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] lg:rounded-[34px] lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="noggin-display max-w-full text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.05] text-[var(--noggin-white)] [overflow-wrap:anywhere]">
              {nog.name}
            </h1>
            <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
              {subjectLabel}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="noggin-display shrink-0 text-[1.125rem] font-bold text-[var(--noggin-white)]">
              Lvl. {level}
            </span>
            <div
              role="progressbar"
              aria-label={`${nog.name} level progress`}
              aria-valuenow={clampedProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-4 flex-1 overflow-hidden rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] p-0.5 shadow-[inset_0_1px_4px_var(--noggin-shadow-inset)]"
            >
              <div
                className="h-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-forest)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          </div>
        </div>

        <VitalsSummary vitals={vitals} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-3.5">
          {ROOM_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.slug}
                href={`${roomBaseHref}/${action.slug}`}
                className={cn(
                  "noggin-primary-pill noggin-display inline-flex min-h-[60px] items-center justify-center gap-3 px-5 text-[1.1875rem] font-bold lg:min-h-[76px] lg:text-[1.5rem]",
                  index === ROOM_ACTIONS.length - 1 &&
                    "col-span-2 lg:col-span-1",
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0 lg:h-6 lg:w-6"
                  aria-hidden="true"
                />
                <span>{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="flex justify-center lg:col-start-1 lg:row-start-2">
        <Link
          href={`${roomBaseHref}/notebook`}
          className="noggin-primary-pill noggin-display inline-flex min-h-[60px] w-full items-center justify-center gap-3 px-8 text-[1.1875rem] font-bold lg:min-h-[68px] lg:max-w-[360px] lg:text-[1.25rem]"
        >
          <BookOpen className="h-5 w-5 shrink-0 lg:h-6 lg:w-6" aria-hidden="true" />
          <span>My Notebook</span>
        </Link>
      </div>
    </div>
  );
}
