"use client";

import { ArrowLeft, BookOpen, Clock, Play, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { NogStage } from "@/components/nog-3d/nog-stage";
import type { NogRecord, TopicSummary } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export type CheckFeedbackKind =
  | "not_taught"
  | "questions_pending"
  | "tired_for_today"
  | "sleepy"
  | "no_questions"
  | "not_found";

export interface CheckFeedback {
  kind: CheckFeedbackKind;
  topicId: string;
}

export interface TopicSelectStepProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  selectedTopicId: string | null;
  isThinking: boolean;
  feedback: CheckFeedback | null;
  onSelectTopic: (topicId: string) => void;
  onStart: () => void;
  onRetry: () => void;
}

export function TopicSelectStep({
  nog,
  topics,
  selectedTopicId,
  isThinking,
  feedback,
  onSelectTopic,
  onStart,
  onRetry,
}: TopicSelectStepProps) {
  const roomHref = `/nogs/${nog.id}`;
  const feedBaseHref = `${roomHref}/feed`;
  const hasReadyTopic = topics.some((topic) => topic.status === "ready");
  const canStart = Boolean(selectedTopicId) && hasReadyTopic && !isThinking;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={roomHref}
          aria-label={`Back to ${nog.name}'s room`}
          className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>

        <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
          {nog.name}
        </span>
      </div>

      <section className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8">
        <header className="flex flex-col gap-1.5">
          <h1 className="noggin-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.06] text-[var(--noggin-leaf-title)]">
            Practice Quiz
          </h1>
          <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
            Test what your Nog has learned.
          </p>
        </header>

        {isThinking ? (
          <div className="mt-6 flex flex-col items-center gap-5 rounded-[28px] bg-[var(--noggin-white)] p-6 text-center shadow-[0_12px_28px_var(--noggin-shadow)] sm:p-8">
            <div
              role="status"
              aria-live="polite"
              className="w-full max-w-[420px] rounded-[24px] bg-[var(--noggin-mint-light)] px-5 py-4 text-[1rem] font-semibold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)]"
            >
              <p className="noggin-display font-bold">Hmm, let me think…</p>
              <div
                aria-hidden="true"
                className="mx-auto mt-3 flex max-w-[260px] flex-col gap-2"
              >
                <div className="h-2.5 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
                <div className="mx-auto h-2.5 w-3/4 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
              </div>
            </div>

            <div className="w-full max-w-[220px]">
              <NogStage
                scene="room"
                alt={`${nog.name} thinking through the quiz questions`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="220px"
                priority
                className="nog-bob"
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,320px)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5">
              {topics.length === 0 ? (
                <div className="flex flex-col items-start gap-4 rounded-[28px] bg-[var(--noggin-white)] p-6 shadow-[0_10px_26px_var(--noggin-shadow)]">
                  <p className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]">
                    No topics to quiz yet
                  </p>
                  <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                    Teach {nog.name} a lesson first, then come back to test what stuck.
                  </p>
                  <Link
                    href={feedBaseHref}
                    className="noggin-primary-pill noggin-display inline-flex min-h-11 items-center justify-center gap-2 px-6 text-[0.9375rem] font-bold"
                  >
                    <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Teach a topic</span>
                  </Link>
                </div>
              ) : (
                <fieldset className="flex flex-col gap-3 border-0 p-0">
                  <legend className="noggin-display mb-1 text-[1rem] font-bold text-[var(--noggin-forest)]">
                    Choose a topic
                  </legend>

                  <div className="flex flex-col gap-3">
                    {topics.map((topic) => {
                      const isPending = topic.status !== "ready";
                      const isSelected = !isPending && selectedTopicId === topic.id;
                      const questionLabel =
                        topic.questionCount === 1
                          ? "1 question"
                          : `${topic.questionCount} questions`;

                      return (
                        <label
                          key={topic.id}
                          className={cn(
                            "flex min-h-14 items-center justify-between gap-3 rounded-[22px] bg-[var(--noggin-white)] px-4 py-3.5 shadow-[0_6px_16px_var(--noggin-shadow)] transition-all duration-150 motion-reduce:transition-none",
                            isPending
                              ? "cursor-not-allowed opacity-70"
                              : "cursor-pointer hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                            isSelected &&
                              "bg-[var(--noggin-mint-light)] ring-2 ring-[var(--noggin-leaf-strong)]",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <input
                              type="radio"
                              name="quick-check-topic"
                              value={topic.id}
                              checked={isSelected}
                              disabled={isPending}
                              onChange={() => onSelectTopic(topic.id)}
                              className="h-5 w-5 shrink-0 accent-[var(--noggin-leaf-strong)]"
                            />
                            <span className="noggin-display text-[1rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                              {topic.title}
                            </span>
                          </span>

                          {isPending ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-meter-mid-soft)] px-3 py-1 text-[0.75rem] font-semibold text-[var(--noggin-meter-mid-ink)]">
                              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Questions being written</span>
                            </span>
                          ) : (
                            topic.questionCount > 0 && (
                              <span className="inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.75rem] font-semibold text-[var(--noggin-ink)]">
                                {questionLabel}
                              </span>
                            )
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {feedback && (
                <FeedbackBanner
                  nogName={nog.name}
                  feedback={feedback}
                  feedBaseHref={feedBaseHref}
                  onRetry={onRetry}
                />
              )}

              {topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!canStart}
                    onClick={onStart}
                    className="noggin-primary-pill noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-8 text-[1.0625rem] font-bold disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
                    <span>Start</span>
                  </button>
                </div>
              )}
            </div>

            <aside className="flex flex-col items-center gap-4 rounded-[28px] bg-[var(--noggin-white)] p-5 text-center shadow-[0_12px_28px_var(--noggin-shadow)]">
              <div className="w-full rounded-[20px] bg-[var(--noggin-mint)] px-4 py-3 text-[0.875rem] font-medium leading-relaxed text-[var(--noggin-forest)]">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-4 w-4 shrink-0 text-[var(--noggin-leaf-strong)]" aria-hidden="true" />
                  <span>Game-show check</span>
                </span>
                <p className="mt-1 text-[var(--noggin-ink)]">
                  {nog.name} answers each question from its own notebook while you watch.
                </p>
              </div>

              <div className="w-full max-w-[200px]">
                <NogStage
                  scene={feedback?.kind === "sleepy" ? "dizzy" : "room"}
                  alt={`${nog.name} ready for a practice quiz`}
                  poster={
                    feedback?.kind === "sleepy"
                      ? "/nog/hatchling-dizzy.png"
                      : "/nog/blob-closeup.png"
                  }
                  width={feedback?.kind === "sleepy" ? 1024 : 1254}
                  height={feedback?.kind === "sleepy" ? 1024 : 1254}
                  sizes="200px"
                  priority
                  className="nog-bob"
                />
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

interface FeedbackBannerProps {
  nogName: string;
  feedback: CheckFeedback;
  feedBaseHref: string;
  onRetry: () => void;
}

function FeedbackBanner({
  nogName,
  feedback,
  feedBaseHref,
  onRetry,
}: FeedbackBannerProps) {
  const teachHref = `${feedBaseHref}?topic=${encodeURIComponent(feedback.topicId)}`;

  if (feedback.kind === "not_taught") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-start gap-3 rounded-[24px] bg-[var(--noggin-white)] p-5 shadow-[0_10px_24px_var(--noggin-shadow)] ring-2 ring-[var(--noggin-leaf)]"
      >
        <p className="noggin-display text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
          You haven&apos;t taught me that yet!
        </p>
        <p className="text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
          Feed {nogName} a short lesson on this topic first so it has notes to draw from.
        </p>
        <Link
          href={teachHref}
          className="noggin-primary-pill noggin-display inline-flex min-h-11 items-center justify-center px-6 text-[0.9375rem] font-bold"
        >
          Teach it
        </Link>
      </div>
    );
  }

  if (feedback.kind === "questions_pending") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[24px] bg-[var(--noggin-meter-mid-soft)] p-5 text-[var(--noggin-meter-mid-ink)]"
      >
        <p className="noggin-display text-[1rem] font-bold">
          Questions are still being written
        </p>
        <p className="mt-1 text-[0.875rem] leading-relaxed">
          Check back in a moment once this topic&apos;s quiz is ready.
        </p>
      </div>
    );
  }

  if (feedback.kind === "tired_for_today") {
    return (
      <div
        role="alert"
        className="rounded-[24px] bg-[var(--noggin-meter-mid-soft)] p-5 text-[var(--noggin-meter-mid-ink)]"
      >
        <p className="noggin-display text-[1rem] font-bold">
          Your Nog is tired for today
        </p>
        <p className="mt-1 text-[0.875rem] leading-relaxed">
          {nogName} hit today&apos;s quiz limit. Come back tomorrow for another check.
        </p>
      </div>
    );
  }

  if (feedback.kind === "sleepy") {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-[24px] bg-[var(--noggin-danger-soft)] p-5 text-[var(--noggin-danger)]"
      >
        <p className="noggin-display text-[1rem] font-bold">
          Your Nog is sleepy — try again in a bit
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint)] motion-reduce:transition-none"
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-[24px] bg-[var(--noggin-danger-soft)] p-5 text-[var(--noggin-danger)]"
    >
      <p className="noggin-display text-[1rem] font-bold">
        No quiz questions are available for this topic right now.
      </p>
    </div>
  );
}
