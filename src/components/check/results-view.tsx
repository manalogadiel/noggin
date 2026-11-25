"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bath,
  Check,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type {
  NogRecord,
  NogStageSlug,
  QuickCheckAttempt,
  TopicSummary,
} from "@/core/application/ports";
import { isConceptCovered } from "@/core/domain/quiz";
import { cn } from "@/lib/utils";

export interface ResultsViewProps {
  nog: NogRecord;
  topic: TopicSummary;
  attempts: ReadonlyArray<QuickCheckAttempt>;
  meterBefore: number;
  meterAfter: number;
  stage: NogStageSlug;
  reused: boolean;
  onChooseAnother: () => void;
}

const STAGE_LABELS: Record<NogStageSlug, string> = {
  hatchling: "Hatchling",
  sprout: "Sprout",
  scholar: "Scholar",
  genius: "Genius",
};

export function ResultsView({
  nog,
  topic,
  attempts,
  meterBefore,
  meterAfter,
  stage,
  reused,
  onChooseAnother,
}: ResultsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const totalCount = attempts.length;
  const correctCount = attempts.filter((item) => item.correct).length;
  const incorrectCount = totalCount - correctCount;
  const scorePercent =
    totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const meterDelta = Math.max(0, meterAfter - meterBefore);
  const isGreatJob = scorePercent >= 70;

  const roomHref = `/nogs/${nog.id}`;
  const bathHref = `${roomHref}/bath?topic=${encodeURIComponent(topic.id)}`;
  const continueHref =
    incorrectCount > 0
      ? `${roomHref}/feed?topic=${encodeURIComponent(topic.id)}`
      : roomHref;

  function toggleAttempt(attemptId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(attemptId)) {
        next.delete(attemptId);
      } else {
        next.add(attemptId);
      }
      return next;
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href={roomHref}
          aria-label={`Back to ${nog.name}'s room`}
          className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>

        <h1 className="noggin-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.06] text-[var(--noggin-leaf-title)]">
          Play
        </h1>

        <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sage)] px-4 py-1.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] [overflow-wrap:anywhere]">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{topic.title}</span>
        </span>

        <span className="text-[0.875rem] font-semibold text-[var(--noggin-ink)]">
          {STAGE_LABELS[stage]} · {meterAfter} mastered
        </span>
      </header>

      {/* Supercell-Inspired Tapered Sage Pop Shell */}
      <div className="ng-shell ng-shell--sage mx-auto max-w-[1060px]">
        <header className="ng-shell__head">
          <span className="ng-shell__badge truncate">{topic.title}</span>
          <h2 className="ng-shell__title">
            {isGreatJob ? "Great Job!" : "Keep teaching!"}
          </h2>
          <span className="justify-self-end text-xs font-black text-white">
            {scorePercent}%
          </span>
        </header>

        <div className="ng-shell__body flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
              You got {correctCount} out of {totalCount}
              <span aria-hidden="true" className="hidden">
                questions
              </span>{" "}
              correct!
            </p>
            {reused && (
              <p className="m-0 text-[0.8125rem] text-[var(--noggin-ink)]">
                Same notes as last check — teach or revise a lesson to run a fresh check.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,340px)] lg:items-start">
            <section
              aria-labelledby="question-review-heading"
              className="flex flex-col gap-4 rounded-[24px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-5 shadow-md"
            >
              <h3
                id="question-review-heading"
                className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]"
              >
                Question Review
              </h3>

              <ul className="flex flex-col gap-3">
                {attempts.map((attempt, index) => {
                  const isExpanded = expandedIds.has(attempt.id);
                  const panelId = `review-panel-${attempt.id}`;

                  return (
                    <li
                      key={attempt.id}
                      className={cn(
                        "overflow-hidden bg-[var(--noggin-white)] shadow-sm",
                        isExpanded ? "rounded-[22px]" : "rounded-[var(--noggin-radius-pill)]",
                      )}
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() => toggleAttempt(attempt.id)}
                        className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-[var(--noggin-mint)] motion-reduce:transition-none"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {attempt.correct ? (
                            <CheckCircle2
                              className="h-5 w-5 shrink-0 text-[var(--noggin-leaf-strong)]"
                              aria-hidden="true"
                            />
                          ) : (
                            <XCircle
                              className="h-5 w-5 shrink-0 text-[var(--noggin-danger)]"
                              aria-hidden="true"
                            />
                          )}
                          <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                            <span className="sr-only">Question {index + 1}: </span>
                            {attempt.prompt}
                          </span>
                        </span>

                        <ChevronDown
                          className={cn(
                            "h-5 w-5 shrink-0 text-[var(--noggin-forest)] transition-transform duration-150 motion-reduce:transition-none",
                            isExpanded && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      {isExpanded && (
                        <div
                          id={panelId}
                          className="flex flex-col gap-3 border-t border-[var(--noggin-mint-light)] bg-[var(--noggin-white)] px-5 py-4"
                        >
                          <div>
                            <p className="text-[0.75rem] font-bold tracking-wide text-[var(--noggin-ink)] uppercase">
                              {nog.name}&rsquo;s answer
                            </p>
                            <p className="mt-1 text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                              {attempt.nogAnswer || "No answer given."}
                            </p>
                          </div>

                          {attempt.concepts.length > 0 && (
                            <ul aria-label="Reviewed concepts" className="flex flex-wrap gap-2">
                              {attempt.concepts.map((item) => {
                                const covered = isConceptCovered(item);
                                return (
                                  <li
                                    key={item.concept}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] px-3 py-1 text-[0.8125rem] font-semibold",
                                      covered
                                        ? "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]"
                                        : "bg-[var(--noggin-danger-soft)] text-[var(--noggin-danger)]",
                                    )}
                                  >
                                    {covered ? (
                                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    ) : (
                                      <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    )}
                                    <span>{item.concept}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}

                          {!attempt.correct && (
                            <div className="pt-1">
                              <Link
                                href={bathHref}
                                className="ng-btn ng-btn--coral px-5 py-2 text-xs"
                              >
                                <Bath className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>Fix in Bath</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside aria-label="Quiz summary" className="flex flex-col gap-3">
              {/* Trophy Pingu Celebration Art */}
              <div className="flex justify-center overflow-hidden rounded-2xl bg-[var(--ng-c-fffdf5)] p-2 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/game/nog/pingu-trophy.png"
                  alt={`${nog.name} holding a golden trophy with ribbons and medal`}
                  className="h-40 w-40 object-contain drop-shadow"
                />
              </div>

              <div className="flex items-center gap-3 rounded-[var(--noggin-radius-pill)] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] px-4 py-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/game/ui/stat-check-pop.svg" alt="" className="h-8 w-8 shrink-0" />
                <p className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
                  <span className="tabular-nums">{correctCount}</span>{" "}
                  <span className="font-bold">Correct</span>
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--noggin-radius-pill)] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] px-4 py-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/game/ui/stat-cross-pop.svg" alt="" className="h-8 w-8 shrink-0" />
                <p className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
                  <span className="tabular-nums">{incorrectCount}</span>{" "}
                  <span className="font-bold">Incorrect</span>
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--noggin-radius-pill)] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] px-4 py-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/game/ui/stat-score-pop.svg" alt="" className="h-8 w-8 shrink-0" />
                <p className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
                  <span className="tabular-nums">{scorePercent}%</span>{" "}
                  <span className="font-bold">Score</span>
                </p>
              </div>

              {meterDelta > 0 && (
                <div className="flex items-center gap-3 rounded-[var(--noggin-radius-pill)] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] px-4 py-3 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/game/ui/stat-xp-pop.svg" alt="" className="h-8 w-8 shrink-0" />
                  <p className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
                    <span className="tabular-nums">+{meterDelta} XP</span>{" "}
                    <span className="font-bold">Training</span>
                  </p>
                </div>
              )}

              <div className="mt-1 flex flex-col items-center gap-2">
                <Link
                  href={continueHref}
                  className="ng-btn ng-btn--leaf w-full py-3 text-base"
                >
                  <span>Continue Training</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>

                <button
                  type="button"
                  onClick={onChooseAnother}
                  className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 px-3 text-[0.9375rem] font-bold text-[var(--noggin-forest)] underline-offset-4 hover:underline"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Choose another topic</span>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
