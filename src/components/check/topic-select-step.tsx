"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  FileUp,
  ListChecks,
  MessageSquareText,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { type BookCoverStyle } from "@/components/game-ui/game-ui-context";
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

const BOOK_COVER_ROTATION: ReadonlyArray<BookCoverStyle> = [
  "sage",
  "honey",
  "gingham",
  "berry",
  "denim",
];

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
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="qs-top-bar">
          <div className="flex items-center gap-3">
            <Link
              href={roomHref}
              aria-label={`Back to ${nog.name}'s room`}
              className="stage-close-btn"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>

            <h1 className="stage-h1">Play</h1>

            {selectedTopic && (
              <span className="qs-round-pill [overflow-wrap:anywhere]">
                {selectedTopic.title}
              </span>
            )}
          </div>
        </div>

        <div className="qs-live-stage">
          <div className="qs-bubbles-row">
            <div
              aria-hidden="true"
              className="qs-bubble qs-bubble--host bg-[var(--noggin-sage)] min-h-[140px] justify-center"
            >
              <div className="qs-bubble__who">
                <span>Professor Owl</span>
              </div>
              <div className="h-4 w-5/6 rounded-full bg-[var(--noggin-white)]/80 motion-safe:animate-pulse" />
              <div className="h-4 w-2/3 rounded-full bg-[var(--noggin-white)]/80 motion-safe:animate-pulse" />
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
            </div>

            <div
              role="status"
              aria-live="polite"
              className="qs-bubble qs-bubble--nog bg-[var(--noggin-sage)] min-h-[140px] justify-center"
            >
              <div className="qs-bubble__who">
                <span>{nog.name}</span>
              </div>
              <p className="qs-bubble__text">Hmm, let me think…</p>
              <div
                aria-hidden="true"
                className="mt-1 flex max-w-[220px] flex-col gap-2"
              >
                <div className="h-2.5 w-full rounded-full bg-[var(--noggin-white)] motion-safe:animate-pulse" />
                <div className="h-2.5 w-3/4 rounded-full bg-[var(--noggin-white)] motion-safe:animate-pulse" />
              </div>
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
              <div className="w-[clamp(140px,14.5vw,210px)]">
                <NogStage
                  scene="room"
                  alt={`${nog.name} thinking through the quiz questions`}
                  poster="/nog/blob-closeup.png"
                  width={1254}
                  height={1254}
                  sizes="210px"
                  priority
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

  const fmtChipClass: Record<string, string> = {
    mc: "qs-fmt-chip--blue",
    enum: "qs-fmt-chip--purple",
    phrase: "qs-fmt-chip--coral",
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="qs-top-bar">
        <div className="flex items-center gap-3">
          <Link
            href={roomHref}
            aria-label={`Back to ${nog.name}'s room`}
            className="stage-close-btn"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <h1
            className="stage-h1"
            style={{ fontSize: "26px", color: "var(--noggin-white)" }}
          >
            Practice Quiz
          </h1>
        </div>

        <p className="qs-brain-pill m-0 hidden sm:inline-flex">
          {nog.name} answers each question from its own notebook while you watch.
        </p>
      </div>

      <div className="qs-prep-stage flex-col gap-3">
        {/* Royal-Blue Dot-Matrix START QUIZ Marquee Shell */}
        <div className="qs-sc-shell qs-sc-shell--prep relative z-10">
          <header className="qs-sc-header">
            <div className="qs-count-stepper" aria-label="Question count">
              <button
                type="button"
                aria-label="Fewer questions"
                onClick={() => setQuestionCount((c) => Math.max(3, c - 1))}
                className="qs-count-btn"
              >
                −
              </button>
              <span className="qs-count-val tabular-nums">{questionCount} Qs</span>
              <button
                type="button"
                aria-label="More questions"
                onClick={() => setQuestionCount((c) => Math.min(50, c + 1))}
                className="qs-count-btn"
              >
                +
              </button>
            </div>

            <h2 className="qs-sc-title">START QUIZ</h2>

            <span className="qs-sc-badge justify-self-end truncate max-w-[140px]">
              {selectedTopic?.title ?? "Topics"}
            </span>
          </header>

          <div className="qs-sc-body qs-sc-body--prep">
            <h2 className="sr-only">Topics</h2>

            {topics.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-[24px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-6 shadow-sm">
                <p className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]">
                  No topics to quiz yet
                </p>
                <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)]">
                  Teach {nog.name} a lesson first, then come back to test what stuck.
                </p>
                <Link href={feedBaseHref} className="gbtn gbtn--leaf gbtn--sm no-underline">
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Teach a topic</span>
                </Link>
              </div>
            ) : (
              <fieldset className="m-0 border-0 p-0">
                <legend className="sr-only">Topics</legend>

                <div className="qs-book-row">
                  {topics.map((topic, idx) => {
                    const isPending = topic.status !== "ready";
                    const isSelected = !isPending && selectedTopicId === topic.id;
                    const cover = BOOK_COVER_ROTATION[idx % BOOK_COVER_ROTATION.length];
                    const questionLabel =
                      topic.questionCount === 1
                        ? "1 question"
                        : `${topic.questionCount} questions`;

                    return (
                      <label
                        key={topic.id}
                        className={cn(
                          "qs-book-pick",
                          isSelected && "is-on",
                          isPending && "cursor-not-allowed opacity-65",
                        )}
                      >
                        <input
                          type="radio"
                          name="quick-check-topic"
                          value={topic.id}
                          checked={isSelected}
                          disabled={isPending}
                          aria-disabled={isPending ? "true" : undefined}
                          onChange={() => onSelectTopic(topic.id)}
                          className="sr-only"
                        />

                        {isSelected && (
                          <span className="qs-book-pick__tick" aria-hidden="true">
                            ✓
                          </span>
                        )}

                        <span className="qs-book-pick__svg" aria-hidden="true">
                          <Book3dSvg
                            style={cover}
                            title={topic.title}
                            uid={`quiz-book-${topic.id}`}
                          />
                        </span>

                        <span className="qs-book-pick__name [overflow-wrap:anywhere]">
                          {topic.title}
                        </span>

                        <span className="text-[10.5px] font-bold text-[var(--noggin-ink)]">
                          {isPending ? "Questions being written" : questionLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="qs-fmt-row" role="group" aria-label="Question formats">
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
                      "qs-fmt-chip",
                      fmtChipClass[mode.id],
                      on && "is-on",
                    )}
                  >
                    <span className="qs-fmt-ico" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{mode.label}</span>
                    <span className="qs-fmt-check" aria-hidden="true">
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="qs-src-actions">
              <button
                type="button"
                aria-pressed={aiGenOn}
                onClick={() => setAiGenOn((v) => !v)}
                className={cn("qs-src-cta qs-src-cta--ai", aiGenOn && "is-on")}
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Generate with AI</span>
              </button>
              <button
                type="button"
                aria-pressed={fileUploadOn}
                onClick={() => setFileUploadOn((v) => !v)}
                className={cn("qs-src-cta qs-src-cta--file", fileUploadOn && "is-on")}
              >
                <FileUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Add by File</span>
              </button>
            </div>

            {feedback && (
              <FeedbackBanner
                nogName={nog.name}
                feedback={feedback}
                feedBaseHref={feedBaseHref}
                onRetry={onRetry}
              />
            )}

            {topics.length > 0 && (
              <button
                type="button"
                disabled={!canStart}
                onClick={onStart}
                className="qs-start-cta disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" />
                <span>Start Quiz</span>
              </button>
            )}
          </div>
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
            <div className="w-[clamp(140px,14.5vw,210px)]">
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
                sizes="210px"
                priority
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
