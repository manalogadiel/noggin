"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { SpeakButton } from "@/components/voice/speak-button";
import type { QuickCheckAttempt } from "@/core/application/ports";
import { isConceptCovered } from "@/core/domain/quiz";
import { cn } from "@/lib/utils";

const WORD_REVEAL_MS = 35;

function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface AnswerRevealProps {
  nogName: string;
  topicTitle: string;
  attempt: QuickCheckAttempt;
  questionNumber: number;
  totalQuestions: number;
  alreadyRevealed?: boolean;
  onRevealed?: (attemptId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function AnswerReveal({
  nogName,
  topicTitle,
  attempt,
  questionNumber,
  totalQuestions,
  alreadyRevealed = false,
  onRevealed,
  onPrevious,
  onNext,
}: AnswerRevealProps) {
  const fullAnswer = attempt.nogAnswer.trim();
  const words = useMemo(
    () => (fullAnswer.length > 0 ? fullAnswer.split(/\s+/) : []),
    [fullAnswer],
  );

  const [reducedMotion, setReducedMotion] = useState<boolean>(detectReducedMotion);
  const [visibleWordCount, setVisibleWordCount] = useState<number>(() =>
    alreadyRevealed || detectReducedMotion() || words.length === 0
      ? words.length
      : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      setReducedMotion(query.matches);
    };
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  const isComplete =
    reducedMotion || alreadyRevealed || visibleWordCount >= words.length;

  useEffect(() => {
    if (isComplete) {
      return;
    }
    const timer = window.setTimeout(() => {
      setVisibleWordCount((current) => Math.min(words.length, current + 1));
    }, WORD_REVEAL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isComplete, visibleWordCount, words.length]);

  useEffect(() => {
    if (isComplete) {
      onRevealed?.(attempt.id);
    }
  }, [attempt.id, isComplete, onRevealed]);

  const partialText = words.slice(0, visibleWordCount).join(" ");
  const isLastQuestion = questionNumber >= totalQuestions;
  const progressPercent =
    totalQuestions > 0 ? Math.round((questionNumber / totalQuestions) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
            {topicTitle}
          </span>
          <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-ink)]">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,320px)] lg:items-start">
        <section
          aria-label={`Question ${questionNumber} of ${totalQuestions}`}
          className="flex min-w-0 flex-col gap-5 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8"
        >
          <div className="flex flex-col gap-2">
            <p className="text-[0.8125rem] font-semibold tracking-wide text-[var(--noggin-leaf-strong)] uppercase">
              Question {questionNumber}
            </p>
            <h1 className="noggin-display text-[clamp(1.375rem,3vw,2rem)] font-bold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
              {attempt.prompt}
            </h1>
          </div>

          <div
            data-attempt-id={attempt.id}
            className="flex flex-col gap-4 rounded-[26px] bg-[var(--noggin-white)] p-5 shadow-[0_10px_26px_var(--noggin-shadow)] sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="noggin-display text-[0.875rem] font-bold text-[var(--noggin-ink)]">
                {nogName}&rsquo;s answer
              </p>

              {isComplete ? (
                <SpeakButton
                  key={attempt.id}
                  attemptId={attempt.id}
                  text={fullAnswer}
                  nogName={nogName}
                />
              ) : (
                <span className="text-[0.75rem] font-semibold text-[var(--noggin-leaf-strong)]">
                  Answering…
                </span>
              )}
            </div>

            {isComplete ? (
              <div aria-live="polite" className="min-h-[3.5rem]">
                <p className="text-[1rem] leading-relaxed text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                  {fullAnswer || "I wasn't sure how to answer this one yet."}
                </p>
              </div>
            ) : (
              <div className="min-h-[3.5rem]">
                <div aria-live="polite" className="sr-only" />
                <div className="flex items-baseline gap-1">
                  <p
                    aria-hidden="true"
                    className="text-[1rem] leading-relaxed text-[var(--noggin-forest)] [overflow-wrap:anywhere]"
                  >
                    {partialText}
                  </p>
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-0.5 shrink-0 rounded-full bg-[var(--noggin-leaf-strong)] motion-safe:animate-pulse"
                  />
                </div>
              </div>
            )}

            {isComplete && (
              <div className="flex flex-col gap-3 border-t border-[var(--noggin-mint-light)] pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {attempt.correct ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-bold text-[var(--noggin-forest)]">
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-[var(--noggin-leaf-strong)]"
                        aria-hidden="true"
                      />
                      <span>Got it</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-danger-soft)] px-3.5 py-1 text-[0.875rem] font-bold text-[var(--noggin-danger)]">
                      <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Missed</span>
                    </span>
                  )}
                </div>

                {attempt.concepts.length > 0 && (
                  <ul
                    aria-label="Checked concepts"
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
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={questionNumber <= 1}
              onClick={onPrevious}
              className="noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-6 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              className="noggin-primary-pill noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-7 text-[1rem] font-bold"
            >
              <span>{isLastQuestion ? "See results" : "Next"}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section
            aria-label="Quiz progress"
            className="flex flex-col gap-3 rounded-[28px] bg-[var(--noggin-white)] p-5 shadow-[0_12px_28px_var(--noggin-shadow)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
                Quiz Progress
              </h2>
              <span className="text-[0.875rem] font-bold text-[var(--noggin-leaf-strong)]">
                {questionNumber} / {totalQuestions}
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={0}
              aria-valuemax={totalQuestions}
              aria-valuenow={questionNumber}
              className="h-3.5 w-full overflow-hidden rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)]"
            >
              <div
                className="h-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </section>

          <div className="flex flex-col items-center rounded-[28px] bg-[var(--noggin-white)] p-5 shadow-[0_12px_28px_var(--noggin-shadow)]">
            <div className="w-full max-w-[190px]">
              <NogStage
                scene="room"
                alt={`${nogName} answering question ${questionNumber}`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="190px"
                className="nog-bob"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
