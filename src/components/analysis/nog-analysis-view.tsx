"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

const NODE_POSITIONS = [
  { x: 96, y: 100 },
  { x: 250, y: 80 },
  { x: 420, y: 106 },
  { x: 170, y: 225 },
  { x: 345, y: 230 },
  { x: 465, y: 205 },
] as const;

export function NogAnalysisView({
  nog,
  vitals,
  cards,
  stage,
}: NogAnalysisViewProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    cards[0]?.id ?? null,
  );
  const meters = buildVitalMeters(vitals);
  const level = stageToLevel(stage);
  const roomHref = `/nogs/${nog.id}`;
  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? cards[0] ?? null;

  return (
    <div className="game-world nb-world nb-textured-bg">
      <div className="stage-body stage-body--with-rail max-w-[1260px] gap-6">
        <header className="open-book-toolbar">
          <div className="flex items-center gap-3">
            <Link
              href={roomHref}
              aria-label={`Back to ${nog.name}'s room`}
              className="stage-close-btn"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>

            <h1 className="stage-h1">Nog Analysis</h1>
          </div>

          <span className="qs-brain-pill uppercase tracking-wider">
            Brain Map
          </span>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-center lg:gap-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-full max-w-[280px] lg:max-w-[330px] nog-bob">
              <NogStage
                scene="room"
                alt={`${nog.name} in its room`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 330px, 280px"
                priority
                className="w-full"
              />
            </div>

            <h2 className="noggin-display mt-2 max-w-full text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.05] text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
              {nog.name}
            </h2>

            <span className="qs-round-pill mt-2">
              {stage} · Level {level}
            </span>
          </div>

          <section
            aria-label={`${nog.name} vitals`}
            className="overflow-hidden rounded-[28px] border border-[var(--noggin-leaf)] bg-[var(--noggin-cream)] shadow-[0_14px_34px_var(--noggin-shadow)]"
          >
            <div className="divide-y divide-[var(--noggin-leaf)]/45">
              {meters.map((meter) => (
                <VitalMeterRow key={meter.key} meter={meter} />
              ))}

              <p className="px-5 py-3.5 text-center text-[0.875rem] font-medium text-[var(--noggin-ink)] sm:px-7">
                Your Nog faints if any vital reaches 0
              </p>
            </div>
          </section>
        </div>

        {/* Interactive Brain Map Topology (Standalone Botanical Inspector) */}
        {cards.length > 0 && (
          <section
            aria-label="Brain map graph"
            className="hatch-panel grid grid-cols-1 gap-4 p-4 md:grid-cols-[1.2fr_0.8fr]"
          >
            <div className="overflow-hidden rounded-2xl bg-[var(--noggin-mint)] p-2">
              <svg
                viewBox="0 0 540 290"
                className="h-56 w-full"
                role="img"
                aria-label="Thought card brain map"
              >
                {cards.slice(0, NODE_POSITIONS.length - 1).map((_, idx) => {
                  const a = NODE_POSITIONS[idx];
                  const b = NODE_POSITIONS[idx + 1];
                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--noggin-leaf)"
                      strokeWidth="3"
                      strokeDasharray={idx % 2 === 1 ? "6 4" : undefined}
                    />
                  );
                })}
                {cards.slice(0, NODE_POSITIONS.length).map((card, idx) => {
                  const pos = NODE_POSITIONS[idx];
                  const isActive = selectedCard?.id === card.id;
                  const fillColor =
                    card.status === "confused"
                      ? "var(--ng-c-e86058)"
                      : card.status === "shaky"
                        ? "var(--ng-c-f5be2c)"
                        : "var(--noggin-leaf)";
                  return (
                    <g
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select concept ${idx + 1}`}
                      onClick={() => setSelectedCardId(card.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedCardId(card.id);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isActive ? 28 : 22}
                        fill={fillColor}
                        stroke="var(--noggin-white)"
                        strokeWidth={isActive ? "4" : "2"}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 5}
                        textAnchor="middle"
                        fill="var(--noggin-white)"
                        fontSize="12"
                        fontWeight="800"
                      >
                        C{idx + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {selectedCard && (
              <aside className="flex flex-col justify-between gap-3 rounded-2xl bg-[var(--noggin-sage)] p-4">
                <div>
                  <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-[var(--noggin-forest)] uppercase">
                    Node Focus
                  </span>
                  <strong className="noggin-display mt-2 block text-lg font-extrabold text-[var(--noggin-forest)] capitalize">
                    {selectedCard.status}
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[var(--noggin-forest)]">
                    Tap any concept node on the graph to highlight its mastery link.
                  </p>
                </div>
                <Link
                  href={`${roomHref}/water`}
                  className="gbtn gbtn--sm bg-[var(--ng-c-318fd6)] text-white w-full no-underline"
                >
                  Practice Concepts in Water →
                </Link>
              </aside>
            )}
          </section>
        )}

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
