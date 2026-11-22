"use client";

import {
  ArrowRight,
  Bath,
  Check,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
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
    <div className="flex min-w-0 flex-col gap-6">
      <section className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(200px,260px)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-3.5 py-1 text-[0.8125rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]">
                <Trophy
                  className="h-4 w-4 shrink-0 text-[var(--noggin-leaf-strong)]"
                  aria-hidden="true"
                />
                <span>{topic.title}</span>
              </span>

              <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.8125rem] font-bold text-[var(--noggin-forest)]">
                {STAGE_LABELS[stage]} · {meterAfter} mastered
              </span>
            </div>

            <div>
              <h1 className="noggin-display text-[clamp(2rem,4.5vw,3.125rem)] font-extrabold leading-[1.05] text-[var(--noggin-leaf-title)]">
                {isGreatJob ? "Great Job!" : "Keep teaching!"}
              </h1>
              <p className="mt-2 text-[1.0625rem] font-medium text-[var(--noggin-forest)]">
                You got {correctCount} out of {totalCount} correct!
              </p>
              {reused && (
                <p className="mt-1 text-[0.875rem] text-[var(--noggin-ink)]">
                  Same notes as last check — teach or revise a lesson to run a fresh check.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col items-center justify-center rounded-[22px] bg-[var(--noggin-white)] px-3 py-3.5 text-center shadow-[0_6px_16px_var(--noggin-shadow)]">
                <span className="noggin-display text-[1.375rem] font-extrabold text-[var(--noggin-leaf-strong)]">
                  {correctCount}
                </span>{" "}
                <span className="text-[0.8125rem] font-semibold text-[var(--noggin-ink)]">
                  Correct
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-[22px] bg-[var(--noggin-white)] px-3 py-3.5 text-center shadow-[0_6px_16px_var(--noggin-shadow)]">
                <span className="noggin-display text-[1.375rem] font-extrabold text-[var(--noggin-danger)]">
                  {incorrectCount}
                </span>{" "}
                <span className="text-[0.8125rem] font-semibold text-[var(--noggin-ink)]">
                  Incorrect
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-[22px] bg-[var(--noggin-white)] px-3 py-3.5 text-center shadow-[0_6px_16px_var(--noggin-shadow)]">
                <span className="noggin-display text-[1.375rem] font-extrabold text-[var(--noggin-forest)]">
                  {scorePercent}%
                </span>{" "}
                <span className="text-[0.8125rem] font-semibold text-[var(--noggin-ink)]">
                  Score
                </span>
              </div>

              {meterDelta > 0 && (
                <div className="flex flex-col items-center justify-center rounded-[22px] bg-[var(--noggin-mint-light)] px-3 py-3.5 text-center shadow-[0_6px_16px_var(--noggin-shadow)]">
                  <span className="noggin-display inline-flex items-center gap-1 text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>+{meterDelta} XP</span>
                  </span>{" "}
                  <span className="text-[0.8125rem] font-semibold text-[var(--noggin-forest)]">
                    Training
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[220px]">
            <NogStage
              scene="room"
              alt={
                isGreatJob
                  ? `${nog.name} celebrating your quiz results`
                  : `${nog.name} ready to learn more with you`
              }
              poster="/nog/blob-closeup.png"
              width={1254}
              height={1254}
              sizes="220px"
              className="nog-bob"
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="question-review-heading"
        className="flex flex-col gap-4 rounded-[28px] bg-[var(--noggin-white)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-6"
      >
        <h2
          id="question-review-heading"
          className="noggin-display text-[1.375rem] font-extrabold text-[var(--noggin-forest)]"
        >
          Question Review
        </h2>

        <ul className="flex flex-col gap-3">
          {attempts.map((attempt, index) => {
            const isExpanded = expandedIds.has(attempt.id);
            const panelId = `review-panel-${attempt.id}`;

            return (
              <li
                key={attempt.id}
                className="overflow-hidden rounded-[22px] bg-[var(--noggin-mint)] shadow-[0_6px_16px_var(--noggin-shadow)]"
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleAttempt(attempt.id)}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
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
                      <ul
                        aria-label="Reviewed concepts"
                        className="flex flex-wrap gap-2"
                      >
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
                                <Check
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <X
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
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
                          className="noggin-display inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-5 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)] transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onChooseAnother}
          className="noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-6 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Choose another topic</span>
        </button>

        <Link
          href={continueHref}
          className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center gap-2 px-7 text-[1rem] font-bold"
        >
          <span>Continue Training</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
