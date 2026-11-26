"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { cn } from "@/lib/utils";
import styles from "./egg.module.css";

const TOTAL_TAPS = 3;
const POP_DURATION_MS = 280;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface EggHatchProps {
  onHatched: () => void;
  onTapChange?: (taps: number) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function EggHatch({ onHatched, onTapChange }: EggHatchProps) {
  const [taps, setTaps] = useState(0);
  const [popping, setPopping] = useState(false);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (popTimerRef.current !== null) {
        clearTimeout(popTimerRef.current);
      }
    };
  }, []);

  function handleTap() {
    if (popping || taps >= TOTAL_TAPS) {
      return;
    }

    const next = taps + 1;
    setTaps(next);
    onTapChange?.(next);

    if (next >= TOTAL_TAPS) {
      if (prefersReducedMotion()) {
        onHatched();
        return;
      }
      setPopping(true);
      popTimerRef.current = setTimeout(() => {
        onHatched();
      }, POP_DURATION_MS);
    }
  }

  const stageMotionClass = popping
    ? styles.pop
    : taps === 1
      ? styles.wobble
      : taps === 2
        ? styles.shake
        : "";

  const isCracking = taps >= 2;

  const hintText =
    taps === 0
      ? "Tap the egg three times to crack it open."
      : taps === 1
        ? "It wobbled! Tap again."
        : taps === 2
          ? "One more tap!"
          : "Hatching…";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label="Tap the egg"
        onClick={handleTap}
        disabled={popping}
        className="group relative flex w-full max-w-[340px] cursor-pointer items-center justify-center rounded-[36px] bg-transparent p-2 transition-opacity focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--noggin-leaf-strong)] disabled:cursor-default"
      >
        <div
          className={cn(
            "relative w-full max-w-[300px] sm:max-w-[320px] nog-bob",
            stageMotionClass,
          )}
        >
          {isCracking ? (
            <Image
              src="/nog/egg-cracking.png"
              alt=""
              width={605}
              height={589}
              sizes="(min-width: 640px) 320px, 300px"
              priority
              className="h-auto w-full object-contain"
            />
          ) : (
            <NogStage
              scene="egg"
              alt=""
              poster="/nog/egg-speckled.png"
              width={605}
              height={589}
              sizes="(min-width: 640px) 320px, 300px"
              priority
              decorative
              className="w-full"
            />
          )}
        </div>
      </button>

      <div
        role="img"
        aria-label={`Taps: ${taps} of ${TOTAL_TAPS}`}
        className="hatch-dots-pill mt-4"
      >
        {[1, 2, 3].map((stepIndex) => (
          <span
            key={stepIndex}
            aria-hidden="true"
            className={cn("hatch-dot", taps >= stepIndex && "is-filled")}
          />
        ))}
      </div>

      <p aria-live="polite" className="stage-sub mt-3 text-center">
        {hintText}
      </p>
    </div>
  );
}
