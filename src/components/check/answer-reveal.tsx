"use client";

import { ArrowLeft, Check, CheckCircle2, X, XCircle } from "lucide-react";
import Link from "next/link";
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
  nogId?: string;
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
  nogId,
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
  const roomHref = `/nogs/${nogId ?? attempt.nogId}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="qs-top-bar">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={roomHref}
            aria-label={`Back to ${nogName}'s room`}
            className="stage-close-btn"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <h1 className="stage-h1">Play</h1>

          <span className="qs-round-pill [overflow-wrap:anywhere]">
            {topicTitle}
          </span>
        </div>

        <div className="qs-meta-pills">
          <span className="qs-brain-pill">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
      </div>

      <div className="qs-live-stage gap-5">
        <section
          aria-labelledby="quiz-progress-heading"
          className="qs-live-head items-center rounded-full border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] px-5 py-2.5 shadow-sm"
        >
          <h2
            id="quiz-progress-heading"
            className="noggin-display m-0 shrink-0 text-sm font-extrabold text-[var(--noggin-forest)]"
          >
            Quiz Progress
          </h2>

          <div
            role="progressbar"
            aria-labelledby="quiz-progress-heading"
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-valuenow={questionNumber}
            aria-valuetext={`Question ${questionNumber} of ${totalQuestions}`}
            className="meter flex-1"
          >
            <i style={{ width: `${progressPercent}%` }} />
          </div>

          <span className="qs-progress-pill tnum shrink-0">
            {questionNumber} / {totalQuestions}
          </span>
        </section>

        <div className="qs-bubbles-row">
          <section
            aria-label={`Question ${questionNumber}`}
            className="qs-bubble qs-bubble--host bg-[var(--noggin-sage)]"
          >
            <div className="qs-bubble__who">
              <span>Professor Owl</span>
              <span className="qs-verdict-chip is-ok">Question {questionNumber}</span>
            </div>
            <h2 className="qs-bubble__text text-[clamp(1.125rem,2vw,1.375rem)] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
              {attempt.prompt}
            </h2>
            <svg
              className="qs-tail qs-tail--left"
              viewBox="0 0 28 20"
              aria-hidden="true"
            >
              <path
                d="M0 0C4 9 10 16 14 20C14 11 19 4 28 0Z"
                fill="var(--ng-c-fbf5e6)"
              />
            </svg>
          </section>

          <div
            data-attempt-id={attempt.id}
            className={cn(
              "qs-bubble qs-bubble--nog border-2 border-[var(--noggin-leaf)]",
              isComplete && (attempt.correct ? "is-ok" : "is-miss"),
            )}
          >
            <div className="qs-bubble__who">
              <span>{nogName}&rsquo;s answer</span>
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
                <p className="qs-bubble__text text-[1rem] text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                  {fullAnswer || "I wasn't sure how to answer this one yet."}
                </p>
              </div>
            ) : (
              <div className="min-h-[3.5rem]">
                <div aria-live="polite" className="sr-only" />
                <div className="flex items-baseline gap-1">
                  <p
                    aria-hidden="true"
                    className="qs-bubble__text text-[1rem] text-[var(--noggin-forest)] [overflow-wrap:anywhere]"
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
              <div className="flex flex-col gap-2.5 border-t border-[var(--noggin-mint-light)] pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  {attempt.correct ? (
                    <span className="qs-verdict-chip is-ok inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Got it</span>
                    </span>
                  ) : (
                    <span className="qs-verdict-chip is-miss inline-flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Missed</span>
                    </span>
                  )}
                </div>

                {attempt.concepts.length > 0 && (
                  <ul aria-label="Checked concepts" className="flex flex-wrap gap-2">
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

            <svg
              className="qs-tail qs-tail--right"
              viewBox="0 0 28 20"
              aria-hidden="true"
            >
              <path
                d="M0 0C9 4 14 11 14 20C18 16 24 9 28 0Z"
                fill="var(--ng-c-fbf5e6)"
              />
            </svg>
          </div>
        </div>

        <div className="relative z-12 mx-auto mt-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            disabled={questionNumber <= 1}
            onClick={onPrevious}
            className="gbtn gbtn--white gbtn--lg disabled:cursor-not-allowed disabled:opacity-45"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={onNext}
            className="qs-pop-cta max-w-[260px]"
          >
            <span>{isLastQuestion ? "See results →" : "Next →"}</span>
          </button>
        </div>

        <div className="qs-actors-layer">
          <div className="qs-actor qs-actor--owl-floor">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/game/ui/host-owl-clay.svg"
              alt=""
              aria-hidden="true"
            />
            <div className="qs-floor-shadow" />
          </div>

          <div className="qs-actor qs-actor--nog-floor">
            <div className="w-[215px]">
              <NogStage
                scene="room"
                alt={`${nogName} answering question ${questionNumber}`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="215px"
                className="nog-bob w-full"
              />
            </div>
            <div className="qs-floor-shadow" />
          </div>
        </div>
      </div>
    </div>
  );
}
