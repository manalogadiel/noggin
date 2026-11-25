"use client";

import Link from "next/link";
import { useState } from "react";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { ACCESSORIES, useGameUi } from "@/components/game-ui/game-ui-context";
import { NogAvatar } from "@/components/nog/nog-avatar";
import { usePetting } from "@/components/nog/use-petting";
import type { SaveProfileSettingsHandler } from "@/components/settings/settings-sheet";
import type {
  NogRecord,
  NogStageSlug,
  ProfileSettings,
} from "@/core/application/ports";
import type { VitalsResult } from "@/core/domain/vitals";
import { formatRoomRestDate, isNogResting } from "@/lib/rest-schedule";

export interface RoomViewProps {
  nog: NogRecord;
  vitals: VitalsResult;
  progress: number;
  initialSettings: ProfileSettings;
  onSaveSettings: SaveProfileSettingsHandler;
  onPet: () => Promise<void>;
  onWake?: () => Promise<unknown>;
  now?: Date;
}

const STAGE_LEVEL: Record<NogStageSlug, number> = {
  hatchling: 1,
  sprout: 2,
  scholar: 3,
  genius: 4,
};

const STAGE_LABEL: Record<NogStageSlug, string> = {
  hatchling: "Hatchling",
  sprout: "Sprout",
  scholar: "Scholar",
  genius: "Genius",
};

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function NogRoomView({
  nog,
  vitals,
  progress,
  onPet,
  onWake,
  now,
}: RoomViewProps) {
  const { reaction, message, tapCount, pet } = usePetting({ onPet });
  const { state, activeRoom, openModal, updateState, awardRewards, showToast } = useGameUi();
  const [fallbackNow] = useState<Date>(() => new Date());
  const [lampOn, setLampOn] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [teachMode, setTeachMode] = useState(false);
  const [wokeOverride, setWokeOverride] = useState(false);
  const [waking, setWaking] = useState(false);

  const level = STAGE_LEVEL[nog.stage] ?? 1;
  const stageName = STAGE_LABEL[nog.stage] ?? "Sprout";
  const clampedProgress = clampPct(progress);
  const happyPct = clampPct(vitals.happiness);
  const clarityPct = clampPct(vitals.clarity <= 1 ? vitals.clarity * 100 : vitals.clarity);
  const vitalityPct = clampPct(vitals.vitality);

  const roomBaseHref = `/nogs/${nog.id}`;
  const effectiveNow = now ?? fallbackNow;
  const restingDate =
    !wokeOverride && nog.restUntil && isNogResting(nog.restUntil, effectiveNow)
      ? formatRoomRestDate(nog.restUntil)
      : null;

  const coverStyle = state.notebookCovers[nog.id] ?? "sage";
  const bookTitle = state.notebookTitles[nog.id] || nog.subjectName || nog.name;
  const happyDone = tapCount > 0 || happyPct >= 80;

  const dailyTasks = [
    { id: "t-feed", label: "Teach 1 thought", coins: 25, xp: 40, icon: "✏️", done: clampedProgress > 0, href: `${roomBaseHref}/feed` },
    { id: "t-water", label: "Water 1 memory", coins: 0, xp: 50, icon: "💧", done: clarityPct >= 80, href: `${roomBaseHref}/water` },
    { id: "t-pet", label: `Pet ${nog.name} once`, coins: 10, xp: 15, icon: "💚", done: happyDone, href: null as string | null },
  ];
  const tasksLeft = dailyTasks.filter((t) => !state.claimedTasks[t.id]).length;

  async function handleWakeClick() {
    if (waking) return;
    setWaking(true);
    try {
      await onWake?.();
      setWokeOverride(true);
      awardRewards(0, 10);
      showToast(`${nog.name} woke up refreshed! +10 EXP`);
    } finally {
      setWaking(false);
    }
  }

  function handleClaimTask(task: (typeof dailyTasks)[number]) {
    if (state.claimedTasks[task.id]) return;
    if (!task.done) {
      setTasksOpen(false);
      showToast(`Tap ${nog.name} to pet them!`);
      return;
    }
    updateState((prev) => ({
      ...prev,
      claimedTasks: { ...prev.claimedTasks, [task.id]: true },
    }));
    awardRewards(task.coins, task.xp);
    const msgParts = [
      task.coins ? `+${task.coins} coins` : "",
      task.xp ? `+${task.xp} EXP` : "",
    ].filter(Boolean);
    showToast(`Claimed ${msgParts.join(" · ")}!`);
  }

  const equippedIds = state.equippedSlots.filter((x): x is string => Boolean(x));

  return (
    <div
      className="ng-sanctuary"
      data-room-bg={activeRoom.id}
    >
      {/* Full-Bleed Sanctuary Room Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeRoom.src}
        alt=""
        className={`ng-sanctuary__bg ${lampOn ? "brightness-75 saturate-110" : ""}`}
      />
      <div
        className={`ng-sanctuary__scrim ${restingDate ? "ng-sanctuary__scrim--resting" : ""}`}
        aria-hidden="true"
      />
      {lampOn && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              "radial-gradient(circle 380px at 78% 48%, rgba(255,228,136,0.42) 0%, rgba(255,198,84,0.12) 48%, transparent 74%)",
          }}
        />
      )}

      {/* Accurate Per-Room Cabinet / Bookshelf Hotspot -> Notebooks */}
      <Link
        href={`${roomBaseHref}/notebook`}
        className="ng-hotspot ng-hotspot--shelf"
        aria-label="Open Notebooks from room cabinet"
        title="Open Notebooks"
      >
        <span className="ng-hotspot__tip">Notebooks</span>
      </Link>

      {/* Top-Left Daily Tasks Chest & Popover */}
      <div className="relative z-20 flex items-start justify-between px-6 pt-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setTasksOpen((v) => !v)}
            aria-label="Daily Tasks"
            className="relative flex h-14 w-14 items-center justify-center border-0 bg-transparent p-0 transition hover:scale-105"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/game/ui/icon-chest-clay.svg"
              alt=""
              className="h-14 w-14 object-contain drop-shadow-[0_6px_12px_rgba(24,42,8,0.34)]"
            />
            {tasksLeft > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ng-c-e86058)] px-1 text-[11px] font-black text-white shadow">
                {tasksLeft}
              </span>
            )}
          </button>

          {tasksOpen && (
            <div
              role="dialog"
              aria-label="Daily Tasks"
              className="ng-shell ng-shell--sage absolute top-16 left-0 z-50 w-[310px] max-w-[88vw]"
            >
              <div className="ng-shell__head">
                <span className="ng-shell__badge">{tasksLeft} Left</span>
                <strong
                  className="text-base font-black italic text-white"
                  style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
                >
                  DAILY TASKS
                </strong>
                <button
                  type="button"
                  onClick={() => setTasksOpen(false)}
                  aria-label="Close tasks"
                  className="ng-shell__close h-7 w-7 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="ng-shell__body flex flex-col gap-2.5 p-3.5">
                {dailyTasks.map((t) => {
                  const claimed = Boolean(state.claimedTasks[t.id]);
                  const rewardText = [
                    t.coins ? `+${t.coins} coins` : "",
                    t.xp ? `+${t.xp} EXP` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden="true">{t.icon}</span>
                        <div className="leading-tight">
                          <div className="text-xs font-extrabold text-[var(--ng-c-2f5406)]">{t.label}</div>
                          <div className="text-[11px] font-bold text-[var(--ng-c-6e7d52)]">{rewardText}</div>
                        </div>
                      </div>
                      {!claimed && !t.done && t.href ? (
                        <Link
                          href={t.href}
                          onClick={() => setTasksOpen(false)}
                          className="ng-btn ng-btn--leaf px-3 py-1.5 text-xs"
                        >
                          Go
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={claimed}
                          onClick={() => handleClaimTask(t)}
                          className={`ng-btn px-3 py-1.5 text-xs ${
                            claimed
                              ? "ng-btn--stone"
                              : t.done
                                ? "ng-btn--gold"
                                : "ng-btn--leaf"
                          }`}
                        >
                          {claimed ? "Done ✓" : t.done ? "Claim" : "Go"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Sanctuary Stage */}
      <div className="relative z-10 mx-auto grid w-full max-w-[1260px] flex-1 grid-cols-1 items-center gap-6 px-6 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* CENTER: Nog Avatar + Speech Bubble + Grounded Props + Solo Teach/Wake CTA */}
        <section
          aria-label={`${nog.name} pet stage`}
          className="relative flex flex-col items-center justify-center gap-3 pt-2"
        >
          {restingDate && (
            <div className="ng-rest-banner" role="status">
              <span aria-hidden="true">🌙</span>
              <span>Resting · Back {restingDate}</span>
            </div>
          )}

          {!restingDate && (
            <div className="ng-speech-rect" role="status" aria-live="polite">
              {message || `Ready to learn more, Partner!`}
            </div>
          )}

          <div className="relative flex flex-col items-center justify-center">
            {/* Floor Mini 3D Notebook Prop on Left */}
            <Link
              href={`${roomBaseHref}/notebook`}
              aria-label={`Open ${bookTitle} notebook`}
              className="absolute bottom-4 -left-16 z-20 hidden w-[74px] -rotate-12 transition hover:scale-105 sm:block"
            >
              <Book3dSvg style={coverStyle} title={bookTitle} uid={`rm-${nog.id}`} />
            </Link>

            {/* Standing Cozy Lamp Toggle on Right */}
            <button
              type="button"
              onClick={() => setLampOn((v) => !v)}
              aria-label={lampOn ? "Turn off cozy lamp" : "Turn on cozy lamp"}
              className="absolute -right-14 bottom-4 z-20 hidden w-[64px] border-0 bg-transparent p-0 transition hover:scale-105 sm:block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/prop-lamp-clay.svg" alt="" className="h-auto w-full object-contain drop-shadow-md" />
            </button>

            <div className="relative">
              {restingDate ? (
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/nog/sleeping-books.png"
                    alt={`${nog.name} sleeping peacefully`}
                    className="h-[280px] w-[320px] object-contain drop-shadow-[0_14px_24px_rgba(14,22,48,0.42)]"
                  />
                </div>
              ) : (
                <div className="relative flex flex-col items-center">
                  <NogAvatar
                    name={nog.name}
                    reaction={reaction}
                    message={null}
                    tapCount={tapCount}
                    onTap={pet}
                    tint={nog.colors?.body ?? null}
                    className="w-[320px] sm:w-[370px]"
                  />
                  {equippedIds.map((accId) => {
                    const item = ACCESSORIES.find((a) => a.id === accId);
                    if (!item) return null;
                    if (accId === "glasses") {
                      return (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={accId}
                          src="/game/ui/acc-glasses-worn.svg"
                          alt=""
                          aria-hidden="true"
                          className="pointer-events-none absolute top-[44%] left-1/2 z-10 w-[108px] -translate-x-1/2"
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Below Nog: Dark-Blue 3D Wake CTA when sleeping, else Solo Hero Teach Button */}
          <div className="relative z-20 mt-1 flex justify-center">
            {restingDate ? (
              <button
                type="button"
                disabled={waking}
                onClick={handleWakeClick}
                className="ng-btn ng-btn--navy min-w-[220px] px-7 py-3.5 text-lg"
              >
                <span>☀️ Wake {nog.name}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTeachMode((v) => !v)}
                aria-expanded={teachMode}
                className="ng-btn ng-btn--leaf min-w-[220px] gap-2.5 px-7 py-2.5 text-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/game/ui/icon-teach-clay.svg"
                  alt=""
                  className="h-9 w-9 object-contain"
                />
                <span>Teach {nog.name}</span>
              </button>
            )}
          </div>
        </section>

        {/* RIGHT: Stats Card (Elevated Above Bottom-Right Radial Wheel) */}
        <aside
          aria-label={`${nog.name} stats and care`}
          className="flex flex-col items-end self-start pt-2 lg:mb-36"
        >
          <div className="ng-shell ng-shell--sage w-full max-w-[340px]">
            <div className="ng-shell__head grid-cols-[auto_1fr]">
              <span className="ng-shell__badge">
                Lvl. {level} · {stageName}
              </span>
              <span
                className="text-right text-lg font-black italic text-white"
                style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
              >
                {nog.name}
              </span>
            </div>

            <div className="ng-shell__body flex flex-col gap-3 p-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-black text-[var(--ng-c-2f5406)]">
                  <span>BRAIN CAPACITY</span>
                  <span>{clampedProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${nog.name} level progress`}
                  aria-valuenow={clampedProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3 overflow-hidden rounded-full bg-[var(--ng-c-e6dcc0)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--ng-c-7cb342)] transition-[width] duration-300"
                    style={{ width: `${clampedProgress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-[var(--ng-c-e3d6b4)] pt-2.5 text-xs font-extrabold text-[var(--ng-c-2f5406)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="w-20">HAPPINESS</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--ng-c-e6dcc0)]">
                    <div className="h-full rounded-full bg-[var(--noggin-leaf)]" style={{ width: `${happyPct}%` }} />
                  </div>
                  <span className="w-9 text-right">{happyPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="w-20">CLARITY</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--ng-c-e6dcc0)]">
                    <div className="h-full rounded-full bg-[var(--ng-c-63b88c)]" style={{ width: `${clarityPct}%` }} />
                  </div>
                  <span className="w-9 text-right">{clarityPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="w-20">VITALITY</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--ng-c-e6dcc0)]">
                    <div className="h-full rounded-full bg-[var(--ng-c-ec8778)]" style={{ width: `${vitalityPct}%` }} />
                  </div>
                  <span className="w-9 text-right">{vitalityPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Persistent Fixed Teach Bar (Feed Green · Water Blue · Bath Lavender) */}
      {teachMode && !restingDate && (
        <nav className="ng-teach-bar" aria-label="Teach actions">
          <Link href={`${roomBaseHref}/feed`} className="ng-btn ng-btn--leaf px-6 py-3">
            <span>Feed</span>
          </Link>
          <Link href={`${roomBaseHref}/water`} className="ng-btn ng-btn--blue px-6 py-3">
            <span>Water</span>
          </Link>
          <Link href={`${roomBaseHref}/bath`} className="ng-btn ng-btn--purple px-6 py-3">
            <span>Bath</span>
          </Link>
        </nav>
      )}

      {/* Bottom-Right 45° Segmented Glowing Radial Wheel + Inner 3D Wedges */}
      <nav className="ng-arc-dock" aria-label="Sanctuary quick actions">
        <svg className="ng-arc-svg" viewBox="0 0 390 390" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="ng-arc-band" x1="70" y1="370" x2="370" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--ng-c-fff8dd)" stopOpacity="0.9" />
              <stop offset="50%" stopColor="var(--ng-c-e3f7c2)" stopOpacity="0.94" />
              <stop offset="100%" stopColor="var(--ng-c-fff8dd)" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="ng-arc-rim" x1="54" y1="390" x2="390" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--ng-c-ffe780)" />
              <stop offset="50%" stopColor="var(--ng-c-d8ff99)" />
              <stop offset="100%" stopColor="var(--ng-c-ffe780)" />
            </linearGradient>
            <linearGradient id="ng-wedge-quiz" x1="186" y1="384" x2="372" y2="270" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--ng-c-ffe678)" />
              <stop offset="100%" stopColor="var(--ng-c-f2b21b)" />
            </linearGradient>
            <linearGradient id="ng-wedge-arena" x1="260" y1="240" x2="386" y2="380" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--ng-c-ff997a)" />
              <stop offset="100%" stopColor="var(--ng-c-e55a47)" />
            </linearGradient>
            <filter id="ng-arc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="g" />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d="M 38 390 A 352 352 0 0 1 390 38" stroke="var(--ng-c-fff4b8)" strokeWidth="3" strokeDasharray="14 11" strokeLinecap="round" opacity="0.88" filter="url(#ng-arc-glow)" />
          <path d="M 54 390 A 336 336 0 0 1 390 54 L 390 168 A 222 222 0 0 0 168 390 Z" fill="url(#ng-arc-band)" stroke="var(--ng-c-8cb956)" strokeWidth="2.6" />
          <path d="M 54 390 A 336 336 0 0 1 390 54" stroke="url(#ng-arc-rim)" strokeWidth="3.6" strokeLinecap="round" filter="url(#ng-arc-glow)" />
          <path d="M 168 390 A 222 222 0 0 1 390 168" stroke="var(--ng-c-fffbe6)" strokeWidth="2" opacity="0.8" />
          <g stroke="var(--ng-c-85b54c)" strokeWidth="1.8" opacity="0.48">
            <line x1="179" y1="321" x2="70" y2="286" />
            <line x1="210" y1="259" x2="118" y2="193" />
            <line x1="259" y1="210" x2="193" y2="118" />
            <line x1="321" y1="179" x2="286" y2="70" />
          </g>
          <path d="M 118 193 A 336 336 0 0 1 193 118 L 259 210 A 222 222 0 0 0 210 259 Z" fill="rgba(255, 253, 242, 0.58)" stroke="var(--ng-c-f5c644)" strokeWidth="2.4" />

          {/* QUIZ Inner 3D Wedge (Borderless Extruded Slab + Filled 3D Trophy) */}
          <g className="pointer-events-none">
            <path d="M 380 392 L 184 392 A 206 206 0 0 1 241 253 Z" fill="var(--ng-c-c28308)" />
            <path d="M 380 384 L 184 384 A 206 206 0 0 1 241 245 Z" fill="url(#ng-wedge-quiz)" />
            <path d="M 198 372 A 192 192 0 0 1 244 261" stroke="var(--ng-c-fff8cc)" strokeWidth="4" strokeLinecap="round" opacity="0.55" fill="none" />
            <g transform="translate(240, 298)">
              <path d="M22 4c-8.5 0-14 2-14 2v9c0 6.5 4.2 11.4 10 13.2V34h-6c-1.8 0-3 1.3-3 3v3h26v-3c0-1.7-1.2-3-3-3h-6v-5.8c5.8-1.8 10-6.7 10-13.2V6s-5.5-2-14-2z" fill="var(--ng-c-fff8d4)" />
              <rect x="11" y="34" width="22" height="6" rx="2.5" fill="var(--ng-c-9c5e00)" />
              <path d="M22 10.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6 1.9-3.9z" fill="var(--ng-c-f2a60f)" />
            </g>
            <text x="262" y="364" textAnchor="middle" fill="var(--ng-c-4f2e00)" fontFamily="Poppins,sans-serif" fontWeight="900" fontSize="16">
              QUIZ
            </text>
          </g>

          {/* ARENA Inner 3D Wedge (Borderless Extruded Slab + Filled 3D Crown) */}
          <g className="pointer-events-none">
            <path d="M 386 386 L 247 247 A 206 206 0 0 1 386 190 Z" fill="var(--ng-c-b33526)" />
            <path d="M 386 378 L 247 239 A 206 206 0 0 1 386 182 Z" fill="url(#ng-wedge-arena)" />
            <path d="M 262 242 A 192 192 0 0 1 374 196" stroke="var(--ng-c-ffd8cc)" strokeWidth="4" strokeLinecap="round" opacity="0.55" fill="none" />
            <g transform="translate(316, 232)">
              <path d="M5 28L2 11l10 7 8-12 8 12 10-7-3 17H5z" fill="var(--ng-c-ffe678)" />
              <rect x="5" y="27" width="30" height="6.5" rx="3" fill="var(--ng-c-e59d14)" />
              <circle cx="20" cy="21" r="3.4" fill="var(--ng-c-e8584a)" />
            </g>
            <text x="336" y="294" textAnchor="middle" fill="var(--noggin-white)" fontFamily="Poppins,sans-serif" fontWeight="900" fontSize="15">
              ARENA
            </text>
          </g>
        </svg>

        <Link href={`${roomBaseHref}/play`} aria-label="Play Quiz" className="ng-wedge-hit ng-wedge-hit--quiz" />
        <Link href="/arena" aria-label="Party Arena" className="ng-wedge-hit ng-wedge-hit--arena" />

        <Link href={`${roomBaseHref}/notebook`} className="ng-arc-btn ng-arc-btn--1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/game/ui/icon-notebook-clay.svg" alt="" className="ng-arc-btn__ico" />
          <span className="ng-arc-btn__lbl">Notebook</span>
        </Link>
        <Link href={`${roomBaseHref}/analysis`} className="ng-arc-btn ng-arc-btn--2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/game/ui/icon-brainmap-clay.svg" alt="" className="ng-arc-btn__ico" />
          <span className="ng-arc-btn__lbl">Brain Map</span>
        </Link>
        <Link href={`${roomBaseHref}/rest`} className="ng-arc-btn ng-arc-btn--3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/game/ui/icon-rest-clay.svg" alt="" className="ng-arc-btn__ico" />
          <span className="ng-arc-btn__lbl">Rest</span>
        </Link>
        <button type="button" onClick={() => openModal({ type: "rooms" })} className="ng-arc-btn ng-arc-btn--4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/game/ui/icon-rooms-clay.svg" alt="" className="ng-arc-btn__ico" />
          <span className="ng-arc-btn__lbl">Rooms</span>
        </button>
        <Link href={`${roomBaseHref}/customize`} className="ng-arc-btn ng-arc-btn--5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/game/ui/icon-customize-clay.svg" alt="" className="ng-arc-btn__ico" />
          <span className="ng-arc-btn__lbl">Customize</span>
        </Link>
      </nav>
    </div>
  );
}
