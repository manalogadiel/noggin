"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId } from "react";
import { useGameUi } from "@/components/game-ui/game-ui-context";
import { NogStage } from "@/components/nog-3d/nog-stage";
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
  const { activeRoom } = useGameUi();
  const feedBaseHref = `/nogs/${nog.id}/feed`;

  return (
    <div className="game-world game-world--scroll">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={activeRoom.src} alt="" className="scene-bg-img" />
      <div className="scene-bg-scrim scene-bg-scrim--soft" aria-hidden="true" />

      <header className="stage-top">
        <div className="flex items-center gap-3">
          <span className="pill pill--dark">
            {nog.name}
          </span>
        </div>
      </header>

      <div
        className="stage-body"
        style={{ justifyContent: "flex-start" }}
      >
        <section className="surface-sage grid grid-cols-1 items-center gap-6 rounded-[var(--noggin-radius-card)] p-6 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,340px)] lg:gap-8 lg:p-10">
          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <h1 className="stage-h1">
                What will you teach me?
              </h1>
              <p className="stage-sub mt-2 max-w-[44ch]">
                Enter a new topic for {nog.name} or pick one you&rsquo;ve already started.
              </p>
            </div>

            <form
              noValidate
              onSubmit={onSubmitTopic}
              className="surface-white flex flex-col gap-3 rounded-[28px] p-5"
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
                    "g-input min-h-12 w-full flex-1 rounded-[var(--noggin-radius-pill)] px-4 py-2.5 text-[1rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus-visible:outline-none",
                    fieldError ? "bg-[var(--noggin-danger-soft)]" : "bg-[var(--noggin-mint)]",
                  )}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="pub-cta-pill inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="gbtn gbtn--white inline-flex min-h-11 items-center gap-2 px-4 py-2 text-[0.9375rem]"
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
              tint={nog.colors?.body ?? null}
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
    </div>
  );
}
