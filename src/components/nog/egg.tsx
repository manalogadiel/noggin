"use client";

import { useEffect, useRef, useState } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { cn } from "@/lib/utils";
import styles from "./egg.module.css";

const TOTAL_TAPS = 3;
const POP_DURATION_MS = 280;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface EggHatchProps {
  onHatched: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function EggHatch({ onHatched }: EggHatchProps) {
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
        className="group relative flex w-full max-w-[320px] cursor-pointer items-center justify-center rounded-[36px] bg-[radial-gradient(circle_at_50%_62%,var(--noggin-sun-top)_0%,var(--noggin-mint)_68%,transparent_100%)] p-5 transition-opacity focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[var(--noggin-leaf-strong)] disabled:cursor-default sm:p-7"
      >
        <div className={cn("w-full max-w-[250px] sm:max-w-[280px]", stageMotionClass)}>
          <NogStage
            scene="egg"
            alt=""
            poster="/nog/egg-speckled.png"
            width={605}
            height={589}
            sizes="(min-width: 640px) 280px, 250px"
            priority
            decorative
            className="w-full"
          />
        </div>
      </button>

      <div
        role="img"
        aria-label={`Taps: ${taps} of ${TOTAL_TAPS}`}
        className="mt-6 flex items-center justify-center gap-3"
      >
        {[1, 2, 3].map((stepIndex) => (
          <span
            key={stepIndex}
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 rounded-full border-2 border-[var(--noggin-leaf-strong)] transition-colors duration-150 motion-reduce:transition-none",
              taps >= stepIndex
                ? "bg-[var(--noggin-leaf-strong)]"
                : "bg-[var(--noggin-white)]",
            )}
          />
        ))}
      </div>

      <p
        aria-live="polite"
        className="mt-3 text-center text-[1rem] text-[var(--noggin-ink)]"
      >
        {hintText}
      </p>
    </div>
  );
}
