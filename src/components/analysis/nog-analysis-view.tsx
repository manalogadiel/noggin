import { NogStage } from "@/components/nog-3d/nog-stage";
import { RoomRail } from "@/components/room/room-rail";
import type { NogRecord } from "@/core/application/ports";
import type { AnalysisCard } from "@/core/application/use-cases/get-nog-analysis";
import type { GrowthStage } from "@/core/domain/training";
import type { VitalsResult } from "@/core/domain/vitals";
import { ThoughtCardsSection } from "./thought-cards-section";
import { VitalMeterRow } from "./vital-meter-row";
import { buildVitalMeters, stageToLevel } from "./vitals-config";

export interface NogAnalysisViewProps {
  nog: NogRecord;
  vitals: VitalsResult;
  cards: ReadonlyArray<AnalysisCard>;
  stage: GrowthStage;
}

export function NogAnalysisView({
  nog,
  vitals,
  cards,
  stage,
}: NogAnalysisViewProps) {
  const meters = buildVitalMeters(vitals);
  const level = stageToLevel(stage);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-center lg:gap-7">
          <div className="flex flex-col items-center text-center">
            <div className="w-full max-w-[260px] sm:max-w-[300px]">
              <NogStage
                scene="room"
                alt={`${nog.name} in its room`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 300px, 260px"
                priority
                className="w-full"
              />
            </div>

            <h1 className="noggin-display mt-3 max-w-full text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.05] text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
              {nog.name}
            </h1>

            <span className="noggin-display mt-2.5 inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-4 py-1.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)]">
              {stage} · Level {level}
            </span>
          </div>

          <section
            aria-label={`${nog.name} vitals`}
            className="flex flex-col gap-3.5 rounded-[32px] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-7"
          >
            {meters.map((meter) => (
              <VitalMeterRow key={meter.key} meter={meter} />
            ))}

            <p className="mt-1 px-1 text-center text-[0.875rem] font-medium text-[var(--noggin-ink)]">
              Your Nog faints if any vital reaches 0
            </p>
          </section>
        </div>

        <ThoughtCardsSection
          nogId={nog.id}
          nogName={nog.name}
          cards={cards}
        />
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
