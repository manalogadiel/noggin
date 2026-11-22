"use client";

import {
  BookOpen,
  CheckCircle2,
  Droplets,
  Gamepad2,
  Moon,
  PencilLine,
} from "lucide-react";
import Link from "next/link";
import { RoomRail } from "@/components/room/room-rail";
import type { LessonPage, NogRecord, TopicSummary } from "@/core/application/ports";
import { type FollowUpItem, NogChat } from "./nog-chat";

export interface LessonSavedProps {
  nog: NogRecord;
  topic: TopicSummary;
  savedPage: LessonPage;
  replyText: string;
  followUps: ReadonlyArray<FollowUpItem>;
  onFollowUpDraftChange: (id: string, value: string) => void;
  onSubmitFollowUp: (id: string) => void;
  onRetryFollowUp: (id: string) => void;
  onImprove: () => void;
}

export function LessonSaved({
  nog,
  topic,
  savedPage,
  replyText,
  followUps,
  onFollowUpDraftChange,
  onSubmitFollowUp,
  onRetryFollowUp,
  onImprove,
}: LessonSavedProps) {
  const roomHref = `/nogs/${nog.id}`;
  const waterHref = `${roomHref}/water`;
  const quizHref = `${roomHref}/play?topic=${encodeURIComponent(topic.id)}`;
  const improveHref = `${roomHref}/feed?topic=${encodeURIComponent(topic.id)}&lesson=${encodeURIComponent(savedPage.id)}`;
  const restHref = `${roomHref}/rest`;
  const notebookHref = `${roomHref}/notebook?topic=${encodeURIComponent(topic.id)}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-mint-light)] text-[var(--noggin-leaf-strong)] shadow-[0_6px_16px_var(--noggin-shadow)]">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="noggin-display text-[clamp(1.875rem,4vw,2.75rem)] font-extrabold leading-tight text-[var(--noggin-leaf-title)]">
              Lesson Saved Successfully
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <section
            aria-label="Lesson summary"
            className="flex flex-col gap-4 rounded-[28px] bg-[var(--noggin-mint)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-6"
          >
            <h2 className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
              Lesson Summary
            </h2>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] bg-[var(--noggin-white)] p-4 shadow-[0_6px_16px_var(--noggin-shadow)]">
                <dt className="text-[0.8125rem] font-semibold text-[var(--noggin-ink)]">
                  Topic
                </dt>
                <dd className="noggin-display mt-1 text-[1.0625rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                  {topic.title}
                </dd>
              </div>

              <div className="rounded-[20px] bg-[var(--noggin-white)] p-4 shadow-[0_6px_16px_var(--noggin-shadow)]">
                <dt className="text-[0.8125rem] font-semibold text-[var(--noggin-ink)]">
                  Status
                </dt>
                <dd className="noggin-display mt-1 inline-flex items-center gap-1.5 text-[1.0625rem] font-bold text-[var(--noggin-leaf-strong)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Saved to Notebook</span>
                </dd>
              </div>
            </dl>
          </section>

          <NogChat
            nogName={nog.name}
            bubbleText={replyText}
            followUps={followUps}
            onFollowUpDraftChange={onFollowUpDraftChange}
            onSubmitFollowUp={onSubmitFollowUp}
            onRetryFollowUp={onRetryFollowUp}
          />
        </div>

        <section
          aria-labelledby="whats-next-heading"
          className="flex flex-col gap-4 rounded-[28px] bg-[var(--noggin-white)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-6"
        >
          <h2
            id="whats-next-heading"
            className="noggin-display text-[1.375rem] font-extrabold text-[var(--noggin-forest)]"
          >
            What&rsquo;s Next?
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-between gap-4 rounded-[24px] bg-[var(--noggin-mint)] p-5 shadow-[0_6px_16px_var(--noggin-shadow)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-leaf-strong)]">
                  <Droplets className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="noggin-display text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
                    Keep it fresh
                  </p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                    Review this lesson later to keep it fresh.
                  </p>
                </div>
              </div>

              <Link
                href={waterHref}
                className="noggin-primary-pill noggin-display inline-flex min-h-11 w-fit items-center justify-center px-5 text-[0.9375rem] font-bold"
              >
                Review
              </Link>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[24px] bg-[var(--noggin-mint)] p-5 shadow-[0_6px_16px_var(--noggin-shadow)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-leaf-strong)]">
                  <Gamepad2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="noggin-display text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
                    Test {nog.name}
                  </p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                    Try a short quiz using what you just taught.
                  </p>
                </div>
              </div>

              <Link
                href={quizHref}
                className="noggin-primary-pill noggin-display inline-flex min-h-11 w-fit items-center justify-center px-5 text-[0.9375rem] font-bold"
              >
                Quiz
              </Link>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[24px] bg-[var(--noggin-mint)] p-5 shadow-[0_6px_16px_var(--noggin-shadow)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-leaf-strong)]">
                  <PencilLine className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="noggin-display text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
                    Polish your note
                  </p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                    Refine this lesson if you want to make it clearer.
                  </p>
                </div>
              </div>

              <Link
                href={improveHref}
                onClick={(event) => {
                  event.preventDefault();
                  onImprove();
                }}
                className="noggin-primary-pill noggin-display inline-flex min-h-11 w-fit items-center justify-center px-5 text-[0.9375rem] font-bold"
              >
                Improve
              </Link>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[24px] bg-[var(--noggin-mint)] p-5 shadow-[0_6px_16px_var(--noggin-shadow)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-leaf-strong)]">
                  <Moon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="noggin-display text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
                    Take a breather
                  </p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                    Take a break and come back to teach more later.
                  </p>
                </div>
              </div>

              <Link
                href={restHref}
                className="noggin-primary-pill noggin-display inline-flex min-h-11 w-fit items-center justify-center px-5 text-[0.9375rem] font-bold"
              >
                Rest
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[var(--noggin-mint-light)] px-5 py-4 shadow-[0_8px_20px_var(--noggin-shadow)]">
          <div className="flex items-center gap-2.5 text-[var(--noggin-forest)]">
            <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="noggin-display text-[1rem] font-extrabold">
              Notebook Updated
            </span>
          </div>

          <Link
            href={notebookHref}
            className="noggin-primary-pill noggin-display inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[0.9375rem] font-bold"
          >
            <span>View Notebook</span>
          </Link>
        </footer>
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
