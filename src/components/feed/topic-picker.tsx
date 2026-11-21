"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { RoomRail } from "@/components/room/room-rail";
import type { NogRecord, TopicSummary } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export interface TopicPickerProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  draftTitle: string;
  onDraftTitleChange: (value: string) => void;
  onSubmitTopic: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  fieldError: string | null;
  statusAlert: string | null;
}

export function TopicPicker({
  nog,
  topics,
  draftTitle,
  onDraftTitleChange,
  onSubmitTopic,
  isSubmitting,
  fieldError,
  statusAlert,
}: TopicPickerProps) {
  const inputId = useId();
  const fieldErrorId = useId();
  const roomHref = `/nogs/${nog.id}`;
  const feedBaseHref = `/nogs/${nog.id}/feed`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
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

        <section className="grid grid-cols-1 items-center gap-6 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,340px)] lg:gap-8 lg:p-10">
          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <h1 className="noggin-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.06] text-[var(--noggin-leaf-title)]">
                What will you teach me?
              </h1>
              <p className="mt-2 max-w-[44ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                Enter a new topic for {nog.name} or pick one you&rsquo;ve already started.
              </p>
            </div>

            <form
              noValidate
              onSubmit={onSubmitTopic}
              className="flex flex-col gap-3 rounded-[28px] bg-[var(--noggin-white)] p-5 shadow-[0_10px_26px_var(--noggin-shadow)]"
            >
              <label
                htmlFor={inputId}
                className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]"
              >
                Enter a Topic
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id={inputId}
                  name="topic"
                  type="text"
                  maxLength={60}
                  placeholder="e.g. TCP handshake"
                  value={draftTitle}
                  onChange={(event) => onDraftTitleChange(event.target.value)}
                  aria-invalid={fieldError ? "true" : undefined}
                  aria-describedby={fieldError ? fieldErrorId : undefined}
                  disabled={isSubmitting}
                  className={cn(
                    "min-h-12 w-full flex-1 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-4 py-2.5 text-[1rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus-visible:outline-3 focus-visible:outline-[var(--noggin-leaf)]",
                    fieldError && "ring-2 ring-[var(--noggin-danger)]",
                  )}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="noggin-primary-pill noggin-display inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 px-6 text-[1rem] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{isSubmitting ? "Starting…" : "Start Teaching"}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>

              {fieldError && (
                <p
                  id={fieldErrorId}
                  role="alert"
                  className="text-[0.875rem] font-medium text-[var(--noggin-danger)]"
                >
                  {fieldError}
                </p>
              )}

              {statusAlert && (
                <p
                  role="alert"
                  className="rounded-[18px] bg-[var(--noggin-danger-soft)] px-4 py-2.5 text-[0.875rem] font-medium text-[var(--noggin-danger)]"
                >
                  {statusAlert}
                </p>
              )}
            </form>

            {topics.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                  Or pick one
                </p>

                <ul className="flex flex-wrap gap-2.5">
                  {topics.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        href={`${feedBaseHref}?topic=${encodeURIComponent(topic.id)}`}
                        className="noggin-feature-pill noggin-display inline-flex min-h-11 items-center gap-2 px-4 py-2 text-[0.9375rem] font-bold transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      >
                        <span className="[overflow-wrap:anywhere]">{topic.title}</span>
                        {topic.status === "pending" && (
                          <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-meter-mid-soft)] px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--noggin-meter-mid-ink)]">
                            Writing…
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-[280px] lg:max-w-[320px]">
            <NogStage
              scene="peek"
              alt={`${nog.name} peeking out excitedly to learn a new topic`}
              poster="/nog/egg-peek.png"
              width={1192}
              height={1320}
              sizes="(min-width: 1024px) 320px, 280px"
              priority
              className="nog-bob"
            />
          </div>
        </section>
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
