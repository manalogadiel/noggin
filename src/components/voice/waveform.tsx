"use client";

export const WAVEFORM_BAR_COUNT = 7;

export const STATIC_WAVEFORM_LEVELS: ReadonlyArray<number> = [
  0.35, 0.58, 0.82, 0.96, 0.74, 0.52, 0.38,
];

export interface WaveformProps {
  levels: ReadonlyArray<number>;
  reducedMotion: boolean;
}

export function Waveform({ levels, reducedMotion }: WaveformProps) {
  const displayLevels = reducedMotion ? STATIC_WAVEFORM_LEVELS : levels;

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 items-center gap-0.5"
    >
      {Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
        const raw = displayLevels[index] ?? STATIC_WAVEFORM_LEVELS[index] ?? 0.4;
        const clamped = Math.max(0.2, Math.min(1, raw));
        const heightPx = Math.round(4 + clamped * 14);
        return (
          <span
            key={index}
            data-waveform-bar={index}
            style={{ height: `${heightPx}px` }}
            className="w-[3px] rounded-full bg-[var(--noggin-white)] transition-[height] duration-150 ease-out motion-reduce:transition-none"
          />
        );
      })}
    </span>
  );
}
