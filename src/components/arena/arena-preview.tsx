"use client";

import Image from "next/image";
import { Fragment } from "react";
import { Leaf, Shield, Sparkles, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ARENA_BATTLE_STEPS,
  ARENA_LEAGUE_TIER,
  ARENA_SAMPLE_PLAYERS,
  PROMOTION_ZONE_AFTER_RANK,
} from "@/components/arena/preview-data";

export function ArenaPreview() {
  return (
    <div className="space-y-8 md:space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="noggin-display text-[clamp(2rem,4.4vw,3.25rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--noggin-leaf-title)]">
            Arena
          </h1>
          <span className="noggin-display inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-bold text-[var(--noggin-forest)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Preview</span>
          </span>
        </div>
        <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-[var(--noggin-ink)] md:text-[1.125rem]">
          Battle Nogs with friends. Every Nog answers only from what you taught
          it.
        </p>
      </header>

      <section
        aria-label="Arena matchup preview"
        className="relative overflow-hidden rounded-[var(--noggin-radius-card)] bg-[var(--noggin-leaf-strong)] p-6 text-[var(--noggin-white)] shadow-[0_14px_34px_var(--noggin-shadow-strong),inset_0_-2px_12px_var(--noggin-shadow-inset)] md:p-10"
      >
        <div
          aria-hidden="true"
          className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10 md:gap-14"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--noggin-white)_16%,transparent)] p-3 md:h-36 md:w-36">
              <Image
                src="/nog/hatchling-happy.png"
                alt=""
                width={136}
                height={136}
                unoptimized
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="noggin-display inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--noggin-cream)] text-[1.5rem] font-extrabold tracking-tight text-[var(--noggin-forest)] shadow-[0_8px_20px_var(--noggin-shadow-strong)] md:h-20 md:w-20 md:text-[1.75rem]">
              VS
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--noggin-white)_16%,transparent)] p-3 md:h-36 md:w-36">
              <Image
                src="/nog/hatchling-surprised.png"
                alt=""
                width={136}
                height={136}
                unoptimized
                className="h-full w-full -scale-x-100 object-contain"
              />
            </div>
          </div>
        </div>

        <p className="noggin-display mt-6 text-center text-[1rem] font-semibold text-[var(--noggin-cream)] md:text-[1.125rem]">
          Live battles open soon
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section
          aria-labelledby="arena-join-lobby-heading"
          className="flex flex-col justify-between rounded-[28px] bg-[var(--noggin-white)] p-6 shadow-[0_10px_28px_var(--noggin-shadow)] md:p-8"
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
                  className="noggin-display h-12 w-full rounded-2xl border-2 border-[var(--noggin-panel)] bg-[var(--noggin-cream)] px-4 text-[1.125rem] font-bold tracking-[0.2em] text-[var(--noggin-forest)] uppercase placeholder:text-[var(--noggin-ink)]/50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)]"
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
                className="noggin-display inline-flex h-12 min-h-11 w-full cursor-not-allowed items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-6 text-[1rem] font-bold text-[var(--noggin-white)] opacity-60"
              >
                Join
              </button>
            </form>
          </div>
        </section>

        <section
          aria-labelledby="arena-quick-match-heading"
          className="flex flex-col justify-between rounded-[28px] bg-[var(--noggin-white)] p-6 shadow-[0_10px_28px_var(--noggin-shadow)] md:p-8"
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
              className="noggin-display inline-flex h-12 min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-6 text-[1rem] font-bold text-[var(--noggin-white)] opacity-60"
            >
              <Swords className="h-5 w-5" aria-hidden="true" />
              <span>Find a match</span>
            </button>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="arena-weekly-league-heading"
        className="rounded-[28px] bg-[var(--noggin-white)] p-6 shadow-[0_12px_30px_var(--noggin-shadow)] md:p-8"
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
                      : "bg-[var(--noggin-cream)] text-[var(--noggin-forest)]",
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
  );
}

export default ArenaPreview;
