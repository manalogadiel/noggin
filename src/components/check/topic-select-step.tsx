"use client";

import {
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
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { type BookCoverStyle } from "@/components/game-ui/game-ui-context";
import { NogStage } from "@/components/nog-3d/nog-stage";
import type { NogRecord, TopicSummary } from "@/core/application/ports";
import type { QuizQuestionFormat } from "@/core/application/use-cases/run-quick-check";
import {
  countWords,
  DEFAULT_LESSON_WORD_LIMIT,
  splitLesson,
} from "@/core/domain/lesson";
import { QUICK_CHECK_SIZE } from "@/core/domain/quiz";
import { cn } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 50 * 1024;

export interface StartQuizOptions {
  questionCount: number;
  formats: QuizQuestionFormat[];
}

export interface SetupActionStatus {
  ok: boolean;
  message: string;
}

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
  onStart: (options?: StartQuizOptions) => void;
  onRetry: () => void;
  onGenerateTopic?: (title: string) => Promise<SetupActionStatus>;
  onUploadNotes?: (topicId: string, text: string) => Promise<SetupActionStatus>;
}

const FORMAT_MODES: ReadonlyArray<{
  id: QuizQuestionFormat;
  label: string;
  icon: typeof Check;
}> = [
  { id: "mc", label: "Choices", icon: Check },
  { id: "enum", label: "List", icon: ListChecks },
  { id: "phrase", label: "Short", icon: MessageSquareText },
];

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
  onGenerateTopic,
  onUploadNotes,
}: TopicSelectStepProps) {
  const [questionCount, setQuestionCount] = useState(QUICK_CHECK_SIZE);
  const [aiGenOn, setAiGenOn] = useState(false);
  const [fileUploadOn, setFileUploadOn] = useState(false);
  const [formats, setFormats] = useState<Record<QuizQuestionFormat, boolean>>({
    mc: true,
    enum: true,
    phrase: true,
  });
  const [topicDraft, setTopicDraft] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genStatus, setGenStatus] = useState<SetupActionStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    text: string;
    words: number;
    chunks: number;
  } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<SetupActionStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const roomHref = `/nogs/${nog.id}`;
  const feedBaseHref = `${roomHref}?teach=feed`;
  const hasReadyTopic = topics.some((topic) => topic.status === "ready");
  const pendingTopics = topics.filter((topic) => topic.status !== "ready");
  const canStart = Boolean(selectedTopicId) && hasReadyTopic && !isThinking;
  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? null;

  const activeFormats = FORMAT_MODES.map((m) => m.id).filter((id) => formats[id]);

  const handleToggleFormat = (id: QuizQuestionFormat) => {
    setFormats((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length;
      if (prev[id] && enabledCount <= 1) {
        return prev;
      }
      return { ...prev, [id]: !prev[id] };
    });
  };

  const handleGenerateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onGenerateTopic || genBusy || !topicDraft.trim()) {
      return;
    }
    setGenBusy(true);
    setGenStatus(null);
    const status = await onGenerateTopic(topicDraft.trim());
    setGenStatus(status);
    if (status.ok) {
      setTopicDraft("");
    }
    setGenBusy(false);
  };

  const handleRetryPendingTopic = async (title: string) => {
    if (!onGenerateTopic || genBusy) {
      return;
    }
    setGenBusy(true);
    setGenStatus(null);
    const status = await onGenerateTopic(title);
    setGenStatus(status);
    setGenBusy(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadStatus(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setUploadStatus({
        ok: false,
        message: "Please choose a text file under 50 KB.",
      });
      return;
    }
    try {
      const raw = await file.text();
      const trimmed = raw.trim();
      const words = countWords(trimmed);
      if (words === 0) {
        setSelectedFile(null);
        setUploadStatus({
          ok: false,
          message: "That file has no readable study notes.",
        });
        return;
      }
      const chunks = Math.min(
        5,
        splitLesson(trimmed, DEFAULT_LESSON_WORD_LIMIT).filter((c) => c.trim().length > 0).length,
      );
      setSelectedFile({
        name: file.name,
        text: trimmed,
        words,
        chunks,
      });
    } catch {
      setSelectedFile(null);
      setUploadStatus({
        ok: false,
        message: "Couldn't read that file. Try a .txt or .md note file.",
      });
    }
  };

  const handleTeachSelectedFile = async () => {
    if (!onUploadNotes || !selectedTopicId || !selectedFile || uploadBusy) {
      return;
    }
    setUploadBusy(true);
    setUploadStatus(null);
    const status = await onUploadNotes(selectedTopicId, selectedFile.text);
    setUploadStatus(status);
    if (status.ok) {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    setUploadBusy(false);
  };

  if (isThinking) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="qs-top-bar">
          <div className="flex items-center gap-3">
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
                  stage={nog.stage}
                  tint={nog.colors?.body ?? null}
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
      <h1 className="sr-only">Practice Quiz</h1>

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
              <div className="flex flex-col items-start gap-4 rounded-[24px] bg-[var(--noggin-sage)] p-6 shadow-[0_6px_16px_rgb(34_54_10_/_0.12)]">
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
                    onClick={() => handleToggleFormat(mode.id)}
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
                onClick={() => {
                  setAiGenOn((v) => !v);
                  setFileUploadOn(false);
                }}
                className={cn("qs-src-cta qs-src-cta--ai", aiGenOn && "is-on")}
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Generate with AI</span>
              </button>
              <button
                type="button"
                aria-pressed={fileUploadOn}
                onClick={() => {
                  setFileUploadOn((v) => !v);
                  setAiGenOn(false);
                }}
                className={cn("qs-src-cta qs-src-cta--file", fileUploadOn && "is-on")}
              >
                <FileUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Add by File</span>
              </button>
            </div>

            {aiGenOn && (
              <div className="flex flex-col gap-2.5 rounded-[20px] bg-[var(--noggin-white)]/92 p-4 shadow-[0_6px_16px_var(--noggin-shadow)]">
                <form
                  onSubmit={(e) => void handleGenerateSubmit(e)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    maxLength={60}
                    value={topicDraft}
                    disabled={genBusy}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    placeholder="New topic to generate quiz questions..."
                    aria-label="New quiz topic title"
                    className="g-input h-10 min-w-[180px] flex-1 rounded-full px-4 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={genBusy || !topicDraft.trim() || !onGenerateTopic}
                    className="gbtn gbtn--leaf gbtn--sm shrink-0 disabled:opacity-55"
                  >
                    {genBusy ? "Generating…" : "Generate"}
                  </button>
                </form>

                {pendingTopics.length > 0 && onGenerateTopic && (
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--noggin-forest)]">
                    <span>Finish pending:</span>
                    {pendingTopics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        disabled={genBusy}
                        onClick={() => void handleRetryPendingTopic(topic.title)}
                        className="rounded-full bg-[var(--noggin-mint)] px-3 py-1 font-bold text-[var(--noggin-forest)] transition-colors hover:bg-[var(--noggin-mint-light)]"
                      >
                        Retry {topic.title}
                      </button>
                    ))}
                  </div>
                )}

                {genStatus && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "m-0 text-xs font-semibold",
                      genStatus.ok
                        ? "text-[var(--noggin-forest)]"
                        : "text-[var(--noggin-danger)]",
                    )}
                  >
                    {genStatus.message}
                  </p>
                )}
              </div>
            )}

            {fileUploadOn && (
              <div className="flex flex-col gap-2.5 rounded-[20px] bg-[var(--noggin-white)]/92 p-4 shadow-[0_6px_16px_var(--noggin-shadow)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="gbtn gbtn--white gbtn--sm cursor-pointer">
                    <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Choose study file (.txt, .md)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.csv,.json,text/plain,text/markdown"
                      aria-label="Upload study notes file"
                      onChange={(e) => void handleFileChange(e)}
                      className="sr-only"
                    />
                  </label>
                  {selectedFile && (
                    <span className="text-xs font-semibold text-[var(--noggin-forest)]">
                      {selectedFile.name} · {selectedFile.words} words ({selectedFile.chunks}{" "}
                      {selectedFile.chunks === 1 ? "note" : "notes"})
                    </span>
                  )}
                </div>

                {selectedFile && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[var(--noggin-ink)]">
                      Target notebook: <strong>{selectedTopic?.title ?? "Select a topic"}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={uploadBusy || !selectedTopicId || !onUploadNotes}
                      onClick={() => void handleTeachSelectedFile()}
                      className="gbtn gbtn--leaf gbtn--sm disabled:opacity-55"
                    >
                      {uploadBusy ? "Teaching…" : `Teach file to ${nog.name}`}
                    </button>
                  </div>
                )}

                {uploadStatus && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "m-0 text-xs font-semibold",
                      uploadStatus.ok
                        ? "text-[var(--noggin-forest)]"
                        : "text-[var(--noggin-danger)]",
                    )}
                  >
                    {uploadStatus.message}
                  </p>
                )}
              </div>
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
              <button
                type="button"
                disabled={!canStart}
                onClick={() =>
                  onStart({
                    questionCount,
                    formats: activeFormats,
                  })
                }
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
                stage={nog.stage}
                tint={nog.colors?.body ?? null}
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
  const teachHref = `${feedBaseHref}&topic=${encodeURIComponent(feedback.topicId)}`;

  if (feedback.kind === "not_taught") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-start gap-3 rounded-[24px] bg-[var(--noggin-white)] p-5 shadow-[0_5px_0_var(--lip-leaf),0_12px_24px_var(--noggin-shadow)]"
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
