import type { VitalsResult } from "@/core/domain/vitals";

export interface VitalsSummaryProps {
  vitals: VitalsResult;
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function VitalsSummary({ vitals }: VitalsSummaryProps) {
  const items = [
    { label: "Happiness", value: toPercent(vitals.happiness) },
    { label: "Clarity", value: toPercent(vitals.clarity) },
    { label: "Vitality", value: toPercent(vitals.vitality) },
  ];

  return (
    <dl
      aria-label="Nog vitals"
      className="grid grid-cols-3 gap-2 rounded-[22px] bg-[var(--noggin-cream)] px-3 py-2.5 shadow-[inset_0_-2px_8px_var(--noggin-shadow-inset)]"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center rounded-[16px] bg-[var(--noggin-white)] px-2 py-2 text-center shadow-[0_2px_6px_var(--noggin-shadow)]"
        >
          <dt className="text-[0.75rem] font-semibold text-[var(--noggin-ink)]">
            {item.label}
          </dt>
          <dd className="noggin-display mt-0.5 text-[1rem] font-bold tabular-nums text-[var(--noggin-forest)]">
            {item.value}%
          </dd>
        </div>
      ))}
    </dl>
  );
}
