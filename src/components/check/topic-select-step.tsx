"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  FileUp,
  ListChecks,
  MessageSquareText,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

const FORMAT_MODES = [
  { id: "mc", label: "Choices", icon: Check },
  { id: "enum", label: "List", icon: ListChecks },
  { id: "phrase", label: "Short", icon: MessageSquareText },
] as const;

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
  const [questionCount, setQuestionCount] = useState(10);
  const [aiGenOn, setAiGenOn] = useState(true);
  const [fileUploadOn, setFileUploadOn] = useState(false);
  const [formats, setFormats] = useState<Record<string, boolean>>({
    mc: true,
    enum: true,
    phrase: true,
  });

  const roomHref = `/nogs/${nog.id}`;
  const feedBaseHref = `${roomHref}/feed`;
  const hasReadyTopic = topics.some((topic) => topic.status === "ready");
  const canStart = Boolean(selectedTopicId) && hasReadyTopic && !isThinking;
  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? null;

  if (isThinking) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
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

          {selectedTopic && (
            <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sage)] px-4 py-1.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] [overflow-wrap:anywhere]">
              {selectedTopic.title}
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-col gap-5">
            <div
              aria-hidden="true"
              className="flex min-h-[260px] flex-col justify-center gap-4 rounded-[28px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-8"
            >
              <div className="h-3.5 w-28 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)]/80 motion-safe:animate-pulse" />
              <div className="h-6 w-5/6 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)]/90 motion-safe:animate-pulse" />
              <div className="h-6 w-2/3 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)]/80 motion-safe:animate-pulse" />
            </div>

            <div
              aria-hidden="true"
              className="flex flex-col gap-3 rounded-[18px] border-2 border-[var(--noggin-leaf)] bg-[var(--noggin-white)] p-5 shadow-[0_10px_26px_var(--noggin-shadow)] sm:p-6"
            >
              <div className="h-3.5 w-32 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
              <div className="h-4 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
              <div className="h-4 w-3/4 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            </div>
          </div>

          <aside className="flex flex-col items-center gap-5">
            <div
              role="status"
              aria-live="polite"
              className="relative w-full rounded-[24px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] px-6 py-4 text-center text-[1rem] font-semibold text-[var(--noggin-forest)] shadow-[0_10px_24px_var(--noggin-shadow)]"
            >
              <p className="noggin-display font-bold">Hmm, let me think…</p>
              <div
                aria-hidden="true"
                className="mx-auto mt-3 flex max-w-[220px] flex-col gap-2"
              >
                <div className="h-2.5 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
                <div className="mx-auto h-2.5 w-3/4 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
              </div>
              <span
                aria-hidden="true"
                className="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 border-r border-b border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)]"
              />
            </div>

            <div className="flex items-end justify-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/game/ui/host-owl-clay.svg"
                alt=""
                aria-hidden="true"
                className="h-28 w-28 object-contain drop-shadow"
              />
              <div className="w-full max-w-[260px]">
                <NogStage
                  scene="room"
                  alt={`${nog.name} thinking through the quiz questions`}
                  poster="/nog/blob-closeup.png"
                  width={1254}
                  height={1254}
                  sizes="(min-width: 1024px) 260px, 240px"
                  priority
                  className="nog-bob w-full"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Link
            href={roomHref}
            aria-label={`Back to ${nog.name}'s room`}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <h1 className="noggin-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.06] text-[var(--noggin-leaf-title)]">
            Practice Quiz
          </h1>
        </div>

        <p className="max-w-[58ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
          Test what your Nog has learned. {nog.name} answers each question from
          its own notebook while you watch.
        </p>
      </header>

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.88fr_1.12fr]">
        {/* LEFT: Open-Ground Owl Host & Nog Stage */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-end justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/game/ui/host-owl-clay.svg"
              alt=""
              aria-hidden="true"
              className="hidden h-36 w-36 object-contain drop-shadow-[0_12px_20px_rgb(20_36_8_/_0.24)] sm:block"
            />
            <div className="w-full max-w-[280px] lg:max-w-[330px]">
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
                sizes="(min-width: 1024px) 330px, 280px"
                priority
                className="nog-bob w-full"
              />
            </div>
          </div>

          {topics.length > 0 && (
            <button
              type="button"
              disabled={!canStart}
              onClick={onStart}
              className="ng-btn ng-btn--gold px-10 py-3.5 text-lg disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" />
              <span>Start Quiz</span>
            </button>
          )}
        </div>

        {/* RIGHT: Royal-Blue Dot-Matrix START QUIZ Marquee Shell */}
        <div className="ng-shell ng-shell--blue max-w-[660px]">
          <header className="ng-shell__head">
            <div
              className="inline-flex items-center gap-1 rounded-full bg-[rgb(16_38_86_/_0.52)] px-2 py-1 text-xs font-black text-white"
              aria-label="Question count"
            >
              <button
                type="button"
                aria-label="Fewer questions"
                onClick={() => setQuestionCount((c) => Math.max(3, c - 1))}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                −
              </button>
              <span className="px-1.5 tabular-nums">{questionCount} Qs</span>
              <button
                type="button"
                aria-label="More questions"
                onClick={() => setQuestionCount((c) => Math.min(50, c + 1))}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                +
              </button>
            </div>

            <h2 className="ng-shell__title">START QUIZ</h2>

            <span className="ng-shell__badge justify-self-end truncate max-w-[140px]">
              {selectedTopic?.title ?? "Topics"}
            </span>
          </header>

          <div className="ng-shell__body flex min-w-0 flex-col gap-4">
            {/* Colored Format & Source Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Question formats">
                {FORMAT_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const on = formats[mode.id] !== false;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFormats((prev) => ({ ...prev, [mode.id]: !prev[mode.id] }))
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black transition",
                        on
                          ? "bg-[var(--ng-c-318fd6)] text-white shadow-sm"
                          : "bg-[var(--ng-c-e8dec4)] text-[var(--noggin-forest)]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={aiGenOn}
                  onClick={() => setAiGenOn((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black transition",
                    aiGenOn
                      ? "bg-[var(--ng-c-7d54d4)] text-white"
                      : "bg-[var(--ng-c-e8dec4)] text-[var(--noggin-forest)]",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>AI Generate</span>
                </button>
                <button
                  type="button"
                  aria-pressed={fileUploadOn}
                  onClick={() => setFileUploadOn((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black transition",
                    fileUploadOn
                      ? "bg-[var(--ng-c-e5624c)] text-white"
                      : "bg-[var(--ng-c-e8dec4)] text-[var(--noggin-forest)]",
                  )}
                >
                  <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add by File</span>
                </button>
              </div>
            </div>

            <h2 className="noggin-display text-sm font-black tracking-wide text-[var(--noggin-forest)] uppercase">
              Topics
            </h2>

            {topics.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-[24px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-6 shadow-sm">
                <p className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]">
                  No topics to quiz yet
                </p>
                <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)]">
                  Teach {nog.name} a lesson first, then come back to test what stuck.
                </p>
                <Link
                  href={feedBaseHref}
                  className="ng-btn ng-btn--leaf px-6 py-2.5 text-sm"
                >
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Teach a topic</span>
                </Link>
              </div>
            ) : (
              <fieldset className="flex flex-col gap-3 border-0 p-0">
                <legend className="sr-only">Topics</legend>

                <div className="flex flex-col gap-2.5">
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
                          "flex min-h-14 items-center justify-between gap-3 rounded-[var(--noggin-radius-pill)] border px-5 py-3 shadow-sm transition-all duration-150 motion-reduce:transition-none",
                          isPending
                            ? "cursor-not-allowed border-[var(--noggin-sand)] bg-[var(--noggin-white)] opacity-70"
                            : "cursor-pointer hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                          isSelected
                            ? "border-[var(--noggin-leaf-strong)] bg-[var(--noggin-sage)] ring-2 ring-[var(--noggin-leaf-strong)]"
                            : !isPending &&
                                "border-[var(--noggin-sage-strong)] bg-[var(--noggin-white)]",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3.5">
                          <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
                            <input
                              type="radio"
                              name="quick-check-topic"
                              value={topic.id}
                              checked={isSelected}
                              disabled={isPending}
                              onChange={() => onSelectTopic(topic.id)}
                              className="peer h-6 w-6 cursor-pointer appearance-none rounded-[8px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] transition-colors checked:bg-[var(--noggin-leaf-strong)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)] disabled:cursor-not-allowed"
                            />
                            <Check
                              aria-hidden="true"
                              className="pointer-events-none absolute h-3.5 w-3.5 text-[var(--noggin-white)] opacity-0 transition-opacity peer-checked:opacity-100"
                              strokeWidth={3}
                            />
                          </span>
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
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-3 py-1 text-[0.75rem] font-semibold",
                                isSelected
                                  ? "bg-[var(--noggin-white)] text-[var(--noggin-forest)]"
                                  : "bg-[var(--noggin-mint)] text-[var(--noggin-ink)]",
                              )}
                            >
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
          </div>
        </div>
      </div>
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
