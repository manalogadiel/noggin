"use client";

import {
  Bath,
  BookOpen,
  Droplets,
  Gamepad2,
  Moon,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { NogAvatar } from "@/components/nog/nog-avatar";
import { usePetting } from "@/components/nog/use-petting";
import type { SaveProfileSettingsHandler } from "@/components/settings/settings-sheet";
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

export function NogRoomView({ nog, progress, onPet }: RoomViewProps) {
  const { reaction, message, tapCount, pet } = usePetting({ onPet });

  const level = STAGE_LEVEL[nog.stage] ?? 1;
  const clampedProgress = clampProgress(progress);
  const roomBaseHref = `/nogs/${nog.id}`;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col items-center lg:items-stretch">
        <h1 className="noggin-display self-start text-[clamp(2.5rem,5.5vw,4.5rem)] font-extrabold leading-[0.98] tracking-tight text-[var(--noggin-leaf-title)]">
          Nog Room
        </h1>

        <div className="mt-4 flex flex-1 flex-col items-center justify-center lg:mt-6">
          <NogAvatar
            name={nog.name}
            reaction={reaction}
            message={message}
            tapCount={tapCount}
            onTap={pet}
            tint={nog.colors?.body ?? null}
            className="w-full"
          />
        </div>

        <div className="mt-6 flex w-full justify-center">
          <Link
            href={`${roomBaseHref}/notebook`}
            className="noggin-primary-pill noggin-display inline-flex min-h-[60px] w-full items-center justify-center gap-3 px-8 text-[1.1875rem] font-bold lg:min-h-[68px] lg:max-w-[360px] lg:text-[1.25rem]"
          >
            <BookOpen
              className="h-5 w-5 shrink-0 lg:h-6 lg:w-6"
              aria-hidden="true"
            />
            <span>My Notebook</span>
          </Link>
        </div>
      </div>

      <section
        aria-label={`${nog.name} care panel`}
        className="flex w-full flex-col gap-5 rounded-[36px] bg-[var(--noggin-panel)] p-5 shadow-[0_14px_34px_var(--noggin-shadow),inset_0_-4px_16px_var(--noggin-shadow-inset)] sm:p-6 lg:p-7"
      >
        <div className="rounded-[28px] bg-[var(--noggin-leaf-strong)] p-5 text-[var(--noggin-white)] shadow-[0_8px_20px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] lg:p-6">
          <h1 className="noggin-display max-w-full text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[1.05] text-[var(--noggin-white)] [overflow-wrap:anywhere]">
            {nog.name}
          </h1>

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
    </div>
  );
}
