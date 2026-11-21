"use client";

import { ArrowLeft, Moon, Pause, Play, RotateCcw, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RoomRail } from "@/components/room/room-rail";
import type { NogRecord } from "@/core/application/ports";
import styles from "./rest-view.module.css";

const NAP_DURATION_SECONDS = 10 * 60;
const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface RestViewProps {
  nog: NogRecord;
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(clamped / 60)).padStart(2, "0");
  const seconds = String(clamped % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function RestView({ nog }: RestViewProps) {
  const roomHref = `/nogs/${nog.id}`;
  const [secondsLeft, setSecondsLeft] = useState(NAP_DURATION_SECONDS);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [running]);

  const progress = secondsLeft / NAP_DURATION_SECONDS;
  const strokeOffset = RING_CIRCUMFERENCE * (1 - progress);
  const formattedTime = formatCountdown(secondsLeft);
  const finished = secondsLeft === 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link
            href={roomHref}
            aria-label={`Back to ${nog.name}'s room`}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
            <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{nog.name} · Rest</span>
          </span>
        </div>

        <section className="flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 text-center shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-10">
          <h1 className="noggin-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.06] text-[var(--noggin-leaf-title)]">
            Nap time
          </h1>

          <p className="mt-2 max-w-[44ch] text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
            {nog.name} is resting. Lessons stick better after a break.
          </p>

          <div className="mt-7 grid w-full max-w-[560px] grid-cols-1 items-center gap-6 rounded-[32px] bg-[var(--noggin-white)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] sm:grid-cols-2 sm:p-8">
            <div className="mx-auto w-full max-w-[210px]">
              <Image
                src="/nog/hatchling-sleepy.png"
                alt={`${nog.name} taking a quiet nap`}
                width={1024}
                height={1024}
                unoptimized
                priority
                className={`h-auto w-full object-contain ${styles.sleepyBreathe}`}
              />
            </div>

            <div className="flex flex-col items-center gap-4">
              <div
                className="relative inline-flex h-44 w-44 items-center justify-center"
                role="timer"
                aria-label="Rest timer"
              >
                <svg
                  viewBox="0 0 176 176"
                  className="h-44 w-44 -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="88"
                    cy="88"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="var(--noggin-mint-light)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="var(--noggin-leaf-strong)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeOffset}
                    className="transition-[stroke-dashoffset] duration-700 ease-linear motion-reduce:transition-none"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="noggin-display text-[2rem] font-extrabold tabular-nums text-[var(--noggin-forest)]">
                    {formattedTime}
                  </span>
                  <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--noggin-ink)]">
                    {finished ? "Rested" : running ? "Resting" : "Paused"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!finished && (
                  <button
                    type="button"
                    onClick={() => setRunning((prev) => !prev)}
                    className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
                  >
                    {running ? (
                      <>
                        <Pause className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSecondsLeft(NAP_DURATION_SECONDS);
                    setRunning(true);
                  }}
                  aria-label="Reset timer"
                  className="inline-flex h-11 w-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-cream)] text-[var(--noggin-forest)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-7">
            <Link
              href={roomHref}
              className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center gap-2 px-8 text-[1.0625rem] font-bold"
            >
              <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Wake up</span>
            </Link>
          </div>
        </section>
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
