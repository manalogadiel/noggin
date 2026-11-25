"use client";

import { Fragment, useState } from "react";
import { Leaf, Shield, Sparkles, Swords } from "lucide-react";
import {
  ARENA_BATTLE_STEPS,
  ARENA_LEAGUE_TIER,
  ARENA_SAMPLE_PLAYERS,
  PROMOTION_ZONE_AFTER_RANK,
} from "@/components/arena/preview-data";
import { cn } from "@/lib/utils";

interface RiserPlayer {
  name: string;
  img: string;
  filter: string;
  featured?: boolean;
  flip?: boolean;
}

const RISER_BACK: RiserPlayer[] = [
  { name: "Taro", img: "/game/nog/blob-closeup.png", filter: "hue-rotate(235deg) saturate(1.2)" },
  { name: "Yuzu", img: "/game/nog/hatchling-surprised.png", filter: "sepia(0.22) hue-rotate(12deg) saturate(1.25)", flip: true },
  { name: "Nori", img: "/game/nog/hatchling-happy.png", filter: "hue-rotate(175deg) saturate(1.2)" },
  { name: "Pebble", img: "/game/nog/blob-closeup.png", filter: "sepia(0.18) hue-rotate(310deg) saturate(1.2)" },
  { name: "Clover", img: "/game/nog/hatchling-happy.png", filter: "hue-rotate(55deg) saturate(1.15)" },
  { name: "Sora", img: "/game/nog/blob-closeup.png", filter: "hue-rotate(115deg) saturate(1.15)" },
];

const RISER_MID: RiserPlayer[] = [
  { name: "Pixel", img: "/game/nog/hatchling-surprised.png", filter: "hue-rotate(195deg) saturate(1.2)", flip: true },
  { name: "Lumi", img: "/game/nog/hatchling-happy.png", filter: "hue-rotate(65deg) saturate(1.15)" },
  { name: "Boba", img: "/game/nog/blob-closeup.png", filter: "sepia(0.2) hue-rotate(15deg) saturate(1.25)" },
  { name: "Pip", img: "/game/nog/hatchling-happy.png", filter: "hue-rotate(265deg) saturate(1.2)" },
  { name: "Sage", img: "/game/nog/blob-closeup.png", filter: "hue-rotate(95deg) saturate(1.15)" },
  { name: "Tofu", img: "/game/nog/blob-closeup.png", filter: "sepia(0.18) hue-rotate(300deg) saturate(1.2)" },
];

const RISER_FRONT: RiserPlayer[] = [
  { name: "Miso", img: "/game/nog/blob-closeup.png", filter: "sepia(0.25) hue-rotate(35deg) saturate(1.2)" },
  { name: "Zuzu", img: "/game/nog/hatchling-surprised.png", filter: "hue-rotate(155deg) saturate(1.2)", flip: true },
  { name: "Pingu", img: "/game/nog/hatchling-happy.png", filter: "none", featured: true },
  { name: "Kumo", img: "/game/nog/blob-closeup.png", filter: "hue-rotate(210deg) saturate(1.15)" },
  { name: "Bean", img: "/game/nog/hatchling-happy.png", filter: "sepia(0.16) hue-rotate(325deg) saturate(1.2)" },
  { name: "Oat", img: "/game/nog/blob-closeup.png", filter: "sepia(0.14) saturate(1.1)" },
];

const PARTY_NOTEBOOKS = ["Networking", "Algorithms", "Databases"] as const;
const MAX_CAPS = [10, 25, 50] as const;

export function ArenaPreview() {
  const [maxPlayers, setMaxPlayers] = useState<10 | 25 | 50>(50);
  const [bookIdx, setBookIdx] = useState(0);
  const joinedCount = Math.min(maxPlayers, 24);
  const activeBook = PARTY_NOTEBOOKS[bookIdx % PARTY_NOTEBOOKS.length];

  return (
    <div className="ng-botanical-bg min-h-[calc(100vh-68px)] px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto max-w-[1120px] space-y-8 md:space-y-10">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="noggin-display text-[clamp(2rem,4.4vw,3.25rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--noggin-leaf-title)]">
              Arena
            </h1>
            <span className="noggin-display inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_10px_var(--noggin-shadow)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Preview</span>
            </span>
          </div>
          <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-[var(--noggin-ink)] md:text-[1.125rem]">
            Battle Nogs with friends. Every Nog answers only from what you
            taught it.
          </p>
        </header>

        <section
          aria-label="Arena matchup preview"
          className="ng-arena-stage"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/game/bg/arena-risers.jpg"
            alt=""
            className="ng-arena-bg"
          />
          <div className="ng-arena-scrim" aria-hidden="true" />

          <div className="ng-arena-banner">
            <span className="ng-arena-pill tabular-nums">
              CODE: <strong>NOG-42</strong>
            </span>
            <span className="ng-arena-pill tabular-nums">
              👥 {joinedCount} / {maxPlayers} Players
            </span>

            <div
              className="ng-arena-cap-switch"
              role="group"
              aria-label="Max player cap"
            >
              {MAX_CAPS.map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => setMaxPlayers(cap)}
                  className={cn(
                    "ng-arena-cap-btn",
                    maxPlayers === cap && "is-on",
                  )}
                >
                  {cap}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setBookIdx((prev) => (prev + 1) % PARTY_NOTEBOOKS.length)
              }
              title="Switch party notebook"
              className="ng-arena-pill cursor-pointer"
            >
              📘 {activeBook} ↻
            </button>
          </div>

          <div aria-hidden="true" className="ng-arena-risers-wrap">
            <div className="mb-3 flex items-center justify-center gap-4 sm:gap-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/game/nog/hatchling-happy.png"
                alt=""
                width={84}
                height={84}
                className="h-16 w-16 object-contain drop-shadow-[0_10px_18px_rgba(16,32,4,0.42)] sm:h-20 sm:w-20"
              />
              <span className="noggin-display inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--noggin-cream)] text-[1.35rem] font-extrabold tracking-tight text-[var(--noggin-forest)] shadow-[0_8px_20px_var(--noggin-shadow-strong)] sm:h-16 sm:w-16">
                VS
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/game/nog/hatchling-surprised.png"
                alt=""
                width={84}
                height={84}
                className="h-16 w-16 -scale-x-100 object-contain drop-shadow-[0_10px_18px_rgba(16,32,4,0.42)] sm:h-20 sm:w-20"
              />
            </div>

            <div className="ng-arena-riser-row ng-arena-riser-row--r3">
              {RISER_BACK.map((player) => (
                <div key={player.name} className="ng-arena-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={player.img}
                    alt=""
                    style={{ filter: player.filter }}
                    className={player.flip ? "-scale-x-100" : undefined}
                  />
                  <span>{player.name}</span>
                </div>
              ))}
            </div>

            <div className="ng-arena-riser-row ng-arena-riser-row--r2">
              {RISER_MID.map((player) => (
                <div key={player.name} className="ng-arena-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={player.img}
                    alt=""
                    style={{ filter: player.filter }}
                    className={player.flip ? "-scale-x-100" : undefined}
                  />
                  <span>{player.name}</span>
                </div>
              ))}
            </div>

            <div className="ng-arena-riser-row ng-arena-riser-row--r1">
              {RISER_FRONT.map((player) => (
                <div
                  key={player.name}
                  className={cn(
                    "ng-arena-avatar",
                    player.featured && "is-featured",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={player.img}
                    alt=""
                    style={{ filter: player.filter }}
                    className={player.flip ? "-scale-x-100" : undefined}
                  />
                  <span>{player.name}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="noggin-display relative z-[3] text-center text-[1rem] font-extrabold text-[var(--noggin-white)] drop-shadow-[0_2px_6px_rgba(16,32,4,0.6)] md:text-[1.125rem]">
            Live battles open soon
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section
            aria-labelledby="arena-join-lobby-heading"
            className="ng-prof-panel flex flex-col justify-between p-6 md:p-8"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="arena-join-lobby-heading"
                  className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)] md:text-[1.5rem]"
                >
                  Join a lobby
                </h2>
                <span className="rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.8125rem] font-semibold text-[var(--noggin-forest)]">
                  Opens soon
                </span>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="arena-join-code"
                    className="noggin-display block text-[0.9375rem] font-semibold text-[var(--noggin-forest)]"
                  >
                    Join code
                  </label>
                  <input
                    id="arena-join-code"
                    name="joinCode"
                    type="text"
                    maxLength={6}
                    placeholder="ABC123"
                    autoComplete="off"
                    aria-describedby="arena-join-code-hint"
                    className="noggin-display h-12 w-full rounded-2xl border-2 border-[var(--noggin-panel)] bg-[var(--noggin-white)] px-4 text-[1.125rem] font-bold tracking-[0.2em] text-[var(--noggin-forest)] uppercase placeholder:text-[var(--noggin-ink)]/50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)]"
                  />
                  <p
                    id="arena-join-code-hint"
                    className="text-[0.875rem] text-[var(--noggin-ink)]"
                  >
                    Ask your host for the code
                  </p>
                </div>

                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="ng-btn ng-btn--leaf h-12 w-full cursor-not-allowed opacity-60"
                >
                  Join
                </button>
              </form>
            </div>
          </section>

          <section
            aria-labelledby="arena-quick-match-heading"
            className="ng-prof-panel flex flex-col justify-between p-6 md:p-8"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="arena-quick-match-heading"
                  className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)] md:text-[1.5rem]"
                >
                  Quick Match
                </h2>
                <span className="rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.8125rem] font-semibold text-[var(--noggin-forest)]">
                  Opens soon
                </span>
              </div>

              <p className="text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
                Face a Nog at your level in the same subject.
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="ng-btn ng-btn--gold inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 opacity-60"
              >
                <Swords className="h-5 w-5" aria-hidden="true" />
                <span>Find a match</span>
              </button>
            </div>
          </section>
        </div>

        <section
          aria-labelledby="arena-weekly-league-heading"
          className="ng-prof-panel p-6 md:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  id="arena-weekly-league-heading"
                  className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]"
                >
                  Weekly League
                </h2>
                <span className="noggin-display inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-bold text-[var(--noggin-forest)]">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span>{ARENA_LEAGUE_TIER}</span>
                </span>
              </div>
              <p className="text-[0.9375rem] text-[var(--noggin-ink)]">
                Sample data — leagues start with the Arena
              </p>
            </div>
          </div>

          <ol className="mt-6 space-y-2.5">
            {ARENA_SAMPLE_PLAYERS.map((player) => {
              const isTopThree = player.rank <= 3;

              return (
                <Fragment key={player.rank}>
                  <li
                    aria-current={player.isCurrentUser ? "true" : undefined}
                    className={cn(
                      "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl px-4 py-3 transition-colors sm:gap-4",
                      player.isCurrentUser
                        ? "bg-[var(--noggin-mint-light)] font-semibold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]"
                        : "bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_3px_10px_var(--noggin-shadow)]",
                    )}
                  >
                    <div className="flex w-10 items-center justify-center">
                      {isTopThree ? (
                        <span
                          aria-label={`Rank ${player.rank} medal`}
                          className="noggin-display inline-flex h-8 w-8 items-center justify-center gap-0.5 rounded-full bg-[var(--noggin-leaf-strong)] text-[0.8125rem] font-extrabold text-[var(--noggin-white)]"
                        >
                          <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{player.rank}</span>
                        </span>
                      ) : (
                        <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-ink)]">
                          #{player.rank}
                        </span>
                      )}
                    </div>{" "}
                    <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                      <span className="noggin-display truncate text-[1rem] font-bold text-[var(--noggin-forest)]">
                        {player.playerName}
                      </span>{" "}
                      <span className="truncate text-[0.875rem] text-[var(--noggin-ink)]">
                        {player.nogName} · {player.subject}
                      </span>
                    </div>{" "}
                    <span className="noggin-display text-right text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                      {player.xp} XP
                    </span>
                  </li>

                  {player.rank === PROMOTION_ZONE_AFTER_RANK ? (
                    <li
                      aria-hidden="true"
                      className="flex items-center gap-3 py-2"
                    >
                      <span className="h-px flex-1 border-t-2 border-dashed border-[var(--noggin-leaf-strong)]/40" />
                      <span className="noggin-display rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-0.5 text-[0.75rem] font-bold tracking-wide text-[var(--noggin-forest)] uppercase">
                        Promotion zone
                      </span>
                      <span className="h-px flex-1 border-t-2 border-dashed border-[var(--noggin-leaf-strong)]/40" />
                    </li>
                  ) : null}
                </Fragment>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="arena-how-battles-work-heading"
          className="rounded-[28px] bg-[var(--noggin-mint)] p-6 shadow-[0_10px_24px_var(--noggin-shadow)] md:p-8"
        >
          <h2
            id="arena-how-battles-work-heading"
            className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]"
          >
            How battles work
          </h2>

          <ol className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ARENA_BATTLE_STEPS.map((item) => (
              <li
                key={item.step}
                className="flex flex-col gap-2 rounded-2xl bg-[var(--noggin-white)] p-5 shadow-[0_6px_16px_var(--noggin-shadow)]"
              >
                <span className="noggin-display inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noggin-leaf-strong)] text-[0.9375rem] font-extrabold text-[var(--noggin-white)]">
                  {item.step}
                </span>
                <h3 className="noggin-display mt-1 text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
                  {item.title}
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                  {item.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

export default ArenaPreview;
