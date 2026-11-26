"use client";

import {
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
  const bathHref = `${roomHref}?teach=bath&topic=${encodeURIComponent(topic.id)}`;
  const continueHref =
    incorrectCount > 0
      ? `${roomHref}?teach=feed&topic=${encodeURIComponent(topic.id)}`
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
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="qs-top-bar">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="stage-h1">Play</h1>

          <span className="qs-round-pill inline-flex items-center gap-1.5 [overflow-wrap:anywhere]">
            <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{topic.title}</span>
          </span>
        </div>

        <div className="qs-meta-pills">
          <span className="qs-brain-pill">
            {STAGE_LABELS[stage]} · {meterAfter} mastered
          </span>
        </div>
      </div>

      <div className="qs-results-stage flex-1 px-4 py-3 md:px-6">
        <div className="qs-sc-shell mx-auto max-w-[1040px]">
          <header className="qs-sc-header">
            <span className="qs-sc-badge max-w-[180px] truncate">{topic.title}</span>
            <h2 className="qs-sc-title">
              {isGreatJob ? "Great Job!" : "Keep teaching!"}
            </h2>
            <Link
              href={roomHref}
              aria-label={`Close quiz results and return to ${nog.name}'s room`}
              className="qs-sc-close inline-flex items-center justify-center no-underline"
            >
              ✕
            </Link>
          </header>

          <div className="qs-sc-body">
            <div className="qs-res-left">
              <section
                aria-labelledby="question-review-heading"
                className="qs-review-box qs-review-box--sc qs-review-box--pop bg-[var(--noggin-sage)] flex min-w-0 flex-col gap-3"
              >
                <div className="qs-sc-subrow">
                  <h3
                    id="question-review-heading"
                    className="qs-review-box__title m-0"
                  >
                    Question Review
                  </h3>
                  <span className="qs-review-count tnum">
                    You got {correctCount} out of {totalCount}
                    <span aria-hidden="true" className="hidden">
                      questions
                    </span>{" "}
                    correct!
                  </span>
                </div>

                {reused && (
                  <p className="m-0 text-xs font-semibold text-[var(--noggin-forest)]">
                    Same notes as last check — teach or revise a lesson to run a fresh check.
                  </p>
                )}

                <ul className="qs-review-list flex flex-col gap-2.5 overflow-y-auto">
                  {attempts.map((attempt, index) => {
                    const isExpanded = expandedIds.has(attempt.id);
                    const panelId = `review-panel-${attempt.id}`;

                    return (
                      <li
                        key={attempt.id}
                        className={cn(
                          "qs-review-item",
                          attempt.correct ? "is-ok" : "is-miss",
                        )}
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          onClick={() => toggleAttempt(attempt.id)}
                          className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="qs-review-dot inline-flex h-7 w-7 shrink-0 items-center justify-center">
                              {attempt.correct ? (
                                <CheckCircle2
                                  className="h-4 w-4 text-[var(--noggin-leaf-strong)]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <XCircle
                                  className="h-4 w-4 text-[var(--noggin-danger)]"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
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
                          <div id={panelId} className="qs-review-body px-4 pb-3">
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
                                  className="qs-pop-bath-btn inline-flex items-center gap-1.5 no-underline"
                                >
                                  <Bath className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
            </div>

            <aside aria-label="Quiz summary" className="qs-res-right">
              {/* Seamless Box-Free Trophy Celebration Art */}
              <div className="qs-trophy-pop-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/game/nog/pingu-trophy.png"
                  alt={`${nog.name} holding a golden trophy with ribbons and medal`}
                  className="qs-trophy-art"
                />
              </div>

              <div className="qs-metric-grid grid w-full grid-cols-2 gap-2.5">
                <div className="qs-pop-stat qs-pop-stat--ok bg-[var(--noggin-sage)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/game/ui/stat-check-pop.svg" alt="" className="qs-pop-stat__ico" />
                  <p className="m-0">
                    <strong className="tnum">{correctCount}</strong>{" "}
                    <span>Correct</span>
                  </p>
                </div>

                <div className="qs-pop-stat qs-pop-stat--miss bg-[var(--noggin-sage)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/game/ui/stat-cross-pop.svg" alt="" className="qs-pop-stat__ico" />
                  <p className="m-0">
                    <strong className="tnum">{incorrectCount}</strong>{" "}
                    <span>Incorrect</span>
                  </p>
                </div>

                <div className="qs-pop-stat qs-pop-stat--score bg-[var(--noggin-sage)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/game/ui/stat-score-pop.svg" alt="" className="qs-pop-stat__ico" />
                  <p className="m-0">
                    <strong className="tnum">{scorePercent}%</strong>{" "}
                    <span>Score</span>
                  </p>
                </div>

                {meterDelta > 0 && (
                  <div className="qs-pop-stat qs-pop-stat--xp bg-[var(--noggin-sage)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/game/ui/stat-xp-pop.svg" alt="" className="qs-pop-stat__ico" />
                    <p className="m-0">
                      <strong className="tnum">+{meterDelta} XP</strong>{" "}
                      <span>Training</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="qs-cta-pair w-full">
                <Link
                  href={continueHref}
                  className="qs-pop-cta flex-1 no-underline"
                >
                  <span>Continue Training</span>
                </Link>
                <Link
                  href={continueHref}
                  aria-label="Next step"
                  className="qs-pop-arrow-btn no-underline"
                >
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                </Link>
              </div>

              <button
                type="button"
                onClick={onChooseAnother}
                className="qs-replay-link inline-flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Choose another topic</span>
              </button>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
