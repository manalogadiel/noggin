"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { useGameUi } from "@/components/game-ui/game-ui-context";
import { NogAvatar } from "@/components/nog/nog-avatar";
import { usePetting } from "@/components/nog/use-petting";
import type { SaveProfileSettingsHandler } from "@/components/settings/settings-sheet";
import { IntentLink } from "@/components/shell/intent-link";
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

const WORN_ACC_IMG: Record<string, string> = {
  glasses: "/game/ui/acc-glasses-worn.svg",
  beanie: "/game/ui/acc-beanie.svg",
  bow: "/game/ui/acc-bow.svg",
  gradcap: "/game/ui/acc-gradcap.svg",
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
  const { state, activeRoom, openModal, awardRewards, showToast, setSanctuary } = useGameUi();
  const [fallbackNow] = useState<Date>(() => new Date());
  const [lampOn, setLampOn] = useState(false);
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

  useEffect(() => {
    setSanctuary({
      nogId: nog.id,
      nogName: nog.name,
      teachDone: clampedProgress > 0,
      waterDone: clarityPct >= 80,
      petDone: happyDone,
    });
    return () => setSanctuary(null);
  }, [nog.id, nog.name, clampedProgress, clarityPct, happyDone, setSanctuary]);

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

  const equippedIds = state.equippedSlots.filter((x): x is string => Boolean(x));
  const bubbleText = restingDate
    ? `Zzz... resting until ${restingDate}`
    : (message ?? "✨ Ready to learn!");
  const isIdleBubble = !teachMode && !message;

  return (
    <div
      className={`game-world game-world--hub ${teachMode ? "is-teach-mode" : ""} ${lampOn ? "is-lamp-night" : ""}`}
      data-room-bg={activeRoom.id}
    >
      {/* Full-Bleed Centered Sanctuary Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeRoom.src}
        alt=""
        className="scene-bg-img scene-bg-img--gamestage"
      />
      <div
        className={`scene-bg-scrim ${restingDate ? "scene-bg-scrim--resting" : ""}`}
        aria-hidden="true"
      />
      <div className="room-lamp-glow" aria-hidden="true" />

      {/* Ambient Floating Sunbeam Dust Motes */}
      <div className="sunbeam-motes" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </div>

      {/* Clickable Room Props Hotspots */}
      {!teachMode && (
        <div className="room-hotspots" aria-label="Interactive room objects">
          <Link
            href={`${roomBaseHref}/notebook`}
            className="room-hotspot room-hotspot--shelf"
            title="Open Notebooks"
            aria-label="Open Notebooks from bookshelf"
          >
            <span className="room-hotspot__tip">Notebooks</span>
          </Link>
          <Link
            href={`${roomBaseHref}/water`}
            className="room-hotspot room-hotspot--sprout"
            title="Water Potted Sprout"
            aria-label="Water potted sprout"
          >
            <span className="room-hotspot__tip">Water Sprout</span>
          </Link>
        </div>
      )}

      {/* Teach Mode Floating 3D Notebook Trigger */}
      {teachMode && (
        <Link
          href={`${roomBaseHref}/notebook`}
          className="live-book-btn live-book-btn--float"
          aria-label={`Open ${bookTitle} notebook`}
        >
          <span className="live-book-btn__svg">
            <Book3dSvg style={coverStyle} title={bookTitle} uid={`hud-${nog.id}`} />
          </span>
          <span className="live-book-btn__tag">{bookTitle}</span>
        </Link>
      )}

      <div className="game-main-pane">
        {/* Bottom-Right 45deg Glowing Radial Wheel + Inner 3D Wedges */}
        <nav
          className={`home-arc-dock ${teachMode ? "pointer-events-none opacity-0" : ""}`}
          aria-label="Sanctuary quick actions"
        >
          <svg className="home-arc-svg" viewBox="0 0 390 390" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="home-arc-band" x1="70" y1="370" x2="370" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-fff8dd)" stopOpacity="0.88" />
                <stop offset="50%" stopColor="var(--ng-c-e3f7c2)" stopOpacity="0.92" />
                <stop offset="100%" stopColor="var(--ng-c-fff8dd)" stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id="home-arc-rim" x1="54" y1="390" x2="390" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-ffe780)" />
                <stop offset="50%" stopColor="var(--ng-c-d8ff99)" />
                <stop offset="100%" stopColor="var(--ng-c-ffe780)" />
              </linearGradient>
              <linearGradient id="wedge-quiz-g" x1="186" y1="384" x2="372" y2="270" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-ffe678)" />
                <stop offset="100%" stopColor="var(--ng-c-f2b21b)" />
              </linearGradient>
              <linearGradient id="wedge-arena-g" x1="260" y1="240" x2="386" y2="380" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-ff997a)" />
                <stop offset="100%" stopColor="var(--ng-c-e55a47)" />
              </linearGradient>
              <filter id="home-arc-outer-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="g" />
                <feMerge>
                  <feMergeNode in="g" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="wedge-sh" x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="var(--ng-c-223608)" floodOpacity="0.28" />
              </filter>
            </defs>

            <path
              d="M 38 390 A 352 352 0 0 1 390 38"
              stroke="var(--ng-c-fff4b8)"
              strokeWidth="3"
              strokeDasharray="14 11"
              strokeLinecap="round"
              opacity="0.88"
              filter="url(#home-arc-outer-glow)"
            />
            <path
              d="M 54 390 A 336 336 0 0 1 390 54 L 390 168 A 222 222 0 0 0 168 390 Z"
              fill="url(#home-arc-band)"
              stroke="var(--ng-c-8cb956)"
              strokeWidth="2.6"
            />
            <path
              d="M 54 390 A 336 336 0 0 1 390 54"
              stroke="url(#home-arc-rim)"
              strokeWidth="3.6"
              strokeLinecap="round"
              filter="url(#home-arc-outer-glow)"
            />
            <path
              d="M 168 390 A 222 222 0 0 1 390 168"
              stroke="var(--ng-c-fffbe6)"
              strokeWidth="2"
              opacity="0.8"
            />
            <g stroke="var(--ng-c-85b54c)" strokeWidth="1.8" opacity="0.48">
              <line x1="179" y1="321" x2="70" y2="286" />
              <line x1="210" y1="259" x2="118" y2="193" />
              <line x1="259" y1="210" x2="193" y2="118" />
              <line x1="321" y1="179" x2="286" y2="70" />
            </g>
            <path
              d="M 118 193 A 336 336 0 0 1 193 118 L 259 210 A 222 222 0 0 0 210 259 Z"
              fill="rgba(255, 253, 242, 0.58)"
              stroke="var(--ng-c-f5c644)"
              strokeWidth="2.4"
            />

            {/* QUIZ Inner 3D Wedge */}
            <g className="home-puzzle-wedge home-puzzle-wedge--quiz pointer-events-none" filter="url(#wedge-sh)">
              <path d="M 380 392 L 184 392 A 206 206 0 0 1 241 253 Z" fill="var(--ng-c-c28308)" />
              <path d="M 380 384 L 184 384 A 206 206 0 0 1 241 245 Z" fill="url(#wedge-quiz-g)" />
              <path
                d="M 198 372 A 192 192 0 0 1 244 261"
                stroke="var(--ng-c-fff8cc)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.55"
                fill="none"
              />
              <g transform="translate(240, 298)">
                <path
                  d="M22 4c-8.5 0-14 2-14 2v9c0 6.5 4.2 11.4 10 13.2V34h-6c-1.8 0-3 1.3-3 3v3h26v-3c0-1.7-1.2-3-3-3h-6v-5.8c5.8-1.8 10-6.7 10-13.2V6s-5.5-2-14-2z"
                  fill="var(--ng-c-fff8d4)"
                />
                <path
                  d="M22 4c-8.5 0-14 2-14 2v9c0 6.5 4.2 11.4 10 13.2V34h4V4z"
                  fill="var(--noggin-white)"
                  opacity="0.45"
                />
                <path
                  d="M8 9H4.5C3.1 9 2 10.2 2 11.7c0 4.2 2.4 7.6 6.8 8.3l.6-3.2c-2.3-.5-3.6-2.2-3.6-4.4H8V9zM36 9h3.5c1.4 0 2.5 1.2 2.5 2.7 0 4.2-2.4 7.6-6.8 8.3l-.6-3.2c2.3-.5 3.6-2.2 3.6-4.4H36V9z"
                  fill="var(--ng-c-fff0a6)"
                />
                <rect x="11" y="34" width="22" height="6" rx="2.5" fill="var(--ng-c-9c5e00)" />
                <path
                  d="M22 10.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6 1.9-3.9z"
                  fill="var(--ng-c-f2a60f)"
                />
              </g>
              <text
                x="262"
                y="364"
                textAnchor="middle"
                fill="var(--ng-c-4f2e00)"
                fontFamily="Poppins,sans-serif"
                fontWeight="900"
                fontSize="16"
                letterSpacing="0.03em"
              >
                QUIZ
              </text>
            </g>

            {/* ARENA Inner 3D Wedge */}
            <g className="home-puzzle-wedge home-puzzle-wedge--arena pointer-events-none" filter="url(#wedge-sh)">
              <path d="M 386 386 L 247 247 A 206 206 0 0 1 386 190 Z" fill="var(--ng-c-b33526)" />
              <path d="M 386 378 L 247 239 A 206 206 0 0 1 386 182 Z" fill="url(#wedge-arena-g)" />
              <path
                d="M 262 242 A 192 192 0 0 1 374 196"
                stroke="var(--ng-c-ffd8cc)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.55"
                fill="none"
              />
              <g transform="translate(316, 232)">
                <path d="M5 28L2 11l10 7 8-12 8 12 10-7-3 17H5z" fill="var(--ng-c-ffe678)" />
                <path d="M5 28L2 11l10 7 8-12v22H5z" fill="var(--ng-c-fff5b8)" opacity="0.5" />
                <rect x="5" y="27" width="30" height="6.5" rx="3" fill="var(--ng-c-e59d14)" />
                <circle cx="20" cy="6" r="3" fill="var(--ng-c-fff7cc)" />
                <circle cx="3" cy="10.5" r="2.6" fill="var(--ng-c-fff7cc)" />
                <circle cx="37" cy="10.5" r="2.6" fill="var(--ng-c-fff7cc)" />
                <circle cx="20" cy="21" r="3.4" fill="var(--ng-c-e8584a)" />
                <circle cx="19" cy="20" r="1.2" fill="var(--noggin-white)" opacity="0.8" />
              </g>
              <text
                x="336"
                y="294"
                textAnchor="middle"
                fill="var(--noggin-white)"
                fontFamily="Poppins,sans-serif"
                fontWeight="900"
                fontSize="15"
                letterSpacing="0.03em"
              >
                ARENA
              </text>
            </g>
          </svg>

          <IntentLink
            href={`${roomBaseHref}/play`}
            aria-label="Play Quiz"
            className="ng-wedge-hit ng-wedge-hit--quiz"
          />
          <IntentLink
            href="/arena"
            aria-label="Party Arena"
            className="ng-wedge-hit ng-wedge-hit--arena"
          />

          <IntentLink
            href={`${roomBaseHref}/notebook`}
            className="home-arc-btn home-arc-btn--1"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-notebook-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Notebook</span>
          </IntentLink>
          <IntentLink
            href={`${roomBaseHref}/analysis`}
            className="home-arc-btn home-arc-btn--2"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-brainmap-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Brain Map</span>
          </IntentLink>
          <IntentLink
            href={`${roomBaseHref}/rest`}
            className="home-arc-btn home-arc-btn--3"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-rest-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Rest</span>
          </IntentLink>
          <button type="button" onClick={() => openModal({ type: "rooms" })} className="home-arc-btn home-arc-btn--4">
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-rooms-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Rooms</span>
          </button>
          <IntentLink
            href={`${roomBaseHref}/customize`}
            className="home-arc-btn home-arc-btn--5"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-customize-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Customize</span>
          </IntentLink>
        </nav>

        <div className={`gamestage-main ${teachMode ? "gamestage-main--teach" : ""}`}>
          {/* LEFT / CENTER: Living Nog Stage */}
          <section className="gamestage-left" aria-label={`${nog.name} pet stage`}>
            {!teachMode && restingDate && (
              <div className="gamestage-rest-banner" role="status">
                <span className="gamestage-rest-banner__moon" aria-hidden="true">🌙</span>
                <span>Resting · Back {restingDate}</span>
              </div>
            )}

            <div className="gamestage-carousel">
              <div className="gamestage-orbit">
                {!teachMode && (
                  <>
                    <Link
                      href={`${roomBaseHref}/notebook`}
                      className="floor-mini-book"
                      title={`Open ${bookTitle} notebook`}
                      aria-label={`Open ${bookTitle} notebook`}
                    >
                      <span className="floor-mini-book__svg">
                        <Book3dSvg style={coverStyle} title={bookTitle} uid={`flr-${nog.id}`} />
                      </span>
                      <span className="floor-mini-book__tip">{bookTitle}</span>
                    </Link>

                    <button
                      type="button"
                      className={`floor-cozy-lamp ${lampOn ? "is-lit" : ""}`}
                      onClick={() => setLampOn((v) => !v)}
                      title="Toggle Cozy Lamp"
                      aria-label={lampOn ? "Turn off cozy lamp" : "Turn on cozy lamp"}
                    >
                      <span className="floor-cozy-lamp__glow" aria-hidden="true" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/game/ui/prop-lamp-clay.svg" alt="" className="floor-cozy-lamp__img" />
                      <span className="floor-mini-book__tip">{lampOn ? "Lamp Off" : "Cozy Lamp"}</span>
                    </button>
                  </>
                )}

                <div className="gamestage-pet-wrap">
                  <div
                    className={`nog-bubble ${isIdleBubble ? "nog-bubble--idle" : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {bubbleText}
                  </div>
                  {tapCount > 0 && (
                    <span key={`heart-${tapCount}`} className="pet-heart-pop" aria-hidden="true">
                      ♥
                    </span>
                  )}

                  {restingDate ? (
                    <div className="sanctuary-pet-btn" aria-label={`${nog.name} is resting`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/game/nog/sleeping-books.png" alt={`${nog.name} sleeping peacefully`} className="nog-bob" />
                      <span className="nog-ground-shadow" aria-hidden="true" />
                    </div>
                  ) : (
                    <NogAvatar
                      variant="sanctuary"
                      name={nog.name}
                      reaction={reaction}
                      message={null}
                      tapCount={tapCount}
                      onTap={pet}
                      tint={nog.colors?.body ?? null}
                    >
                      {equippedIds.map((accId) => {
                        const img = WORN_ACC_IMG[accId];
                        if (!img) return null;
                        return (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={accId}
                            src={img}
                            alt=""
                            aria-hidden="true"
                            className={`nog-worn-acc nog-worn-acc--${accId} nog-bob`}
                          />
                        );
                      })}
                      <span className="nog-ground-shadow" aria-hidden="true" />
                    </NogAvatar>
                  )}
                </div>
              </div>
            </div>

            {!teachMode ? (
              <div className="gamestage-ctas">
                {restingDate ? (
                  <button
                    type="button"
                    disabled={waking}
                    onClick={handleWakeClick}
                    className="home-wake-hero-btn"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="5.5" fill="var(--ng-c-ffe678)" />
                      <path
                        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2"
                        stroke="var(--ng-c-ffe678)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Wake {nog.name}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTeachMode(true)}
                    aria-expanded={teachMode}
                    className="gbtn gbtn--leaf gbtn--lg home-teach-hero-btn"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/game/ui/icon-teach-clay.svg" alt="" className="home-teach-hero-ico" />
                    <span>Teach {nog.name}</span>
                  </button>
                )}
              </div>
            ) : (
              <nav className="teach-mode-bar" aria-label="Teach actions">
                <IntentLink
                  href={`${roomBaseHref}/feed`}
                  className="toy-btn toy-btn--feed"
                >
                  <span>Feed</span>
                </IntentLink>
                <IntentLink
                  href={`${roomBaseHref}/water`}
                  className="toy-btn toy-btn--water"
                >
                  <span>Water</span>
                </IntentLink>
                <IntentLink
                  href={`${roomBaseHref}/bath`}
                  className="toy-btn toy-btn--bath"
                >
                  <span>Bath</span>
                </IntentLink>
                <button
                  type="button"
                  onClick={() => setTeachMode(false)}
                  className="toy-btn toy-btn--white"
                >
                  Done
                </button>
              </nav>
            )}
          </section>

          {/* RIGHT: Organic Stats Card */}
          {!teachMode && (
            <aside className="gamestage-right" aria-label={`${nog.name} stats and care`}>
              <div className="gamestage-card">
                <div className="gamestage-card__surface">
                  <div className="gamestage-card__head">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span className="gamestage-lvl-badge tnum">{level}</span>
                      <div style={{ minWidth: 0 }}>
                        <h1
                          style={{
                            margin: 0,
                            display: "block",
                            fontFamily: "var(--font-display)",
                            fontWeight: 800,
                            fontSize: 21,
                            lineHeight: 1.1,
                          }}
                        >
                          {nog.name}
                        </h1>
                        <span style={{ fontSize: 12, color: "var(--noggin-ink)" }}>
                          Lvl. {level} · {stageName}
                        </span>
                      </div>
                    </div>
                    <span className="streak-trophy-pill tnum" title={`${state.streakDays}-day study streak`}>
                      🏆 {state.streakDays}d
                    </span>
                  </div>

                  <div className="gamestage-bars tnum">
                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>BRAIN CAPACITY</span>
                      <div className="gamestage-meter">
                        <i
                          style={{
                            width: `${clampedProgress}%`,
                            background: "linear-gradient(90deg, var(--ng-c-93c556) 0%, var(--ng-c-5f9128) 100%)",
                          }}
                        />
                      </div>
                      <span style={{ textAlign: "right" }}>{clampedProgress}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>LEVEL {level}</span>
                      <div
                        role="progressbar"
                        aria-label={`${nog.name} level progress`}
                        aria-valuenow={clampedProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="gamestage-meter"
                      >
                        <i
                          style={{
                            width: `${clampedProgress}%`,
                            background: "linear-gradient(90deg, var(--ng-c-f7cb52) 0%, var(--noggin-leaf) 100%)",
                          }}
                        />
                      </div>
                      <span style={{ textAlign: "right" }}>{clampedProgress}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>HAPPINESS</span>
                      <div className="gamestage-meter">
                        <i style={{ width: `${happyPct}%`, background: "var(--noggin-leaf)" }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{happyPct}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>CLARITY</span>
                      <div className="gamestage-meter">
                        <i style={{ width: `${clarityPct}%`, background: "var(--ng-c-63b88c)" }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{clarityPct}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>VITALITY</span>
                      <div className="gamestage-meter">
                        <i style={{ width: `${vitalityPct}%`, background: "var(--ng-c-ec8778)" }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{vitalityPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
