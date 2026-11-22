"use client";

import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Check,
  Droplets,
  Eye,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { reviewCardAction } from "@/app/(app)/nogs/[id]/water/actions";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { RoomRail } from "@/components/room/room-rail";
import type {
  NogRecord,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import { nextReviewIntervalDays } from "@/core/domain/thought-card";
import { cn } from "@/lib/utils";

export interface WaterViewProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  dueCards: ReadonlyArray<ThoughtCardRecord>;
}

type WaterStep = "select" | "review" | "done";

function formatNextInterval(days: number): string {
  return days === 1 ? "In 1 day" : `In ${days} days`;
}

export function WaterView({ nog, topics, dueCards }: WaterViewProps) {
  const router = useRouter();
  const roomHref = `/nogs/${nog.id}`;

  const [step, setStep] = useState<WaterStep>("select");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(dueCards.map((card) => card.id)),
  );
  const [queue, setQueue] = useState<ThoughtCardRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [refreshedCount, setRefreshedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const topicTitleById = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic.title])),
    [topics],
  );

  const toggleCard = useCallback((cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  const handleStartReview = useCallback(() => {
    const selected = dueCards.filter((card) => selectedIds.has(card.id));
    if (selected.length === 0) {
      return;
    }
    setQueue(selected);
    setCurrentIndex(0);
    setQuoteVisible(false);
    setRefreshedCount(0);
    setErrorMessage(null);
    setStep("review");
  }, [dueCards, selectedIds]);

  const currentCard =
    step === "review" ? (queue[currentIndex] ?? null) : null;

  const handleRemembered = useCallback(async () => {
    if (!currentCard || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await reviewCardAction({
        nogId: nog.id,
        cardId: currentCard.id,
        outcome: "remembered",
      });

      if (result.status === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(`${roomHref}/water`)}`);
        return;
      }

      if (result.status !== "ok") {
        setErrorMessage("Couldn't save that review. Try again in a moment.");
        return;
      }

      const nextCount = refreshedCount + 1;
      setRefreshedCount(nextCount);

      if (currentIndex + 1 < queue.length) {
        setCurrentIndex((idx) => idx + 1);
        setQuoteVisible(false);
      } else {
        setStep("done");
      }
    } catch {
      setErrorMessage("Couldn't save that review. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentCard,
    currentIndex,
    isSubmitting,
    nog.id,
    queue.length,
    refreshedCount,
    roomHref,
    router,
  ]);

  const handleTeachAgain = useCallback(async () => {
    if (!currentCard || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await reviewCardAction({
        nogId: nog.id,
        cardId: currentCard.id,
        outcome: "forgot",
      });

      if (result.status === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(`${roomHref}/water`)}`);
        return;
      }

      router.push(
        `${roomHref}/feed?topic=${encodeURIComponent(currentCard.topicId)}`,
      );
    } catch {
      setErrorMessage("Couldn't update that thought. Try again in a moment.");
      setIsSubmitting(false);
    }
  }, [currentCard, isSubmitting, nog.id, roomHref, router]);

  const selectedCount = dueCards.filter((card) =>
    selectedIds.has(card.id),
  ).length;

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

          <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
            <Droplets className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{nog.name} · Water</span>
          </span>
        </div>

        {step === "select" && (
          <section className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8">
            <header className="flex flex-col gap-1.5">
              <h1 className="noggin-display text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.08] text-[var(--noggin-leaf-title)]">
                What do you remember?
              </h1>
              <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                Revisit what you&apos;ve learned to help your Nog grow stronger!
              </p>
            </header>

            {dueCards.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-5 rounded-[28px] bg-[var(--noggin-white)] p-7 text-center shadow-[0_12px_28px_var(--noggin-shadow)] sm:p-9">
                <div className="w-full max-w-[190px]">
                  <NogStage
                    scene="room"
                    alt={`${nog.name} with a fresh memory`}
                    poster="/nog/blob-closeup.png"
                    width={1254}
                    height={1254}
                    sizes="190px"
                    priority
                    className="nog-bob"
                  />
                </div>
                <p className="noggin-display max-w-[38ch] text-[1.2rem] font-bold text-[var(--noggin-forest)]">
                  Nothing to water today — your Nog&apos;s memory is fresh!
                </p>
                <Link
                  href={roomHref}
                  className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center px-7 text-[1rem] font-bold"
                >
                  Back to room
                </Link>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-5">
                <ul className="flex flex-col gap-3" aria-label="Due thoughts">
                  {dueCards.map((card) => {
                    const checked = selectedIds.has(card.id);
                    const topicTitle = topicTitleById.get(card.topicId);
                    const badgeLabel =
                      card.status === "shaky" ? "Shaky" : "Dusty";

                    return (
                      <li key={card.id}>
                        <label
                          className={cn(
                            "flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-[22px] bg-[var(--noggin-white)] px-4 py-3.5 shadow-[0_6px_16px_var(--noggin-shadow)] transition-all duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                            checked &&
                              "bg-[var(--noggin-cream)] ring-2 ring-[var(--noggin-leaf-strong)]",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCard(card.id)}
                              className="h-5 w-5 shrink-0 accent-[var(--noggin-leaf-strong)]"
                            />
                            <span className="flex min-w-0 flex-col">
                              <span className="noggin-display text-[1rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                                {card.label}
                              </span>
                              {topicTitle && (
                                <span className="text-[0.8125rem] font-medium text-[var(--noggin-ink)]">
                                  {topicTitle}
                                </span>
                              )}
                            </span>
                          </span>

                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-3 py-1 text-[0.75rem] font-semibold",
                              card.status === "shaky"
                                ? "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]"
                                : "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]",
                            )}
                          >
                            {badgeLabel}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-[0.875rem] font-medium text-[var(--noggin-ink)]">
                    {selectedCount} of {dueCards.length} selected
                  </p>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleStartReview}
                    className="noggin-primary-pill noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-8 text-[1.0625rem] font-bold disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Droplets className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Start Review</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {step === "review" && currentCard && (
          <section className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="noggin-display text-[0.875rem] font-bold uppercase tracking-wide text-[var(--noggin-leaf-strong)]">
                Thought {currentIndex + 1} of {queue.length}
              </p>

              <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]">
                <CalendarClock
                  className="h-4 w-4 shrink-0 text-[var(--noggin-leaf-strong)]"
                  aria-hidden="true"
                />
                <span>
                  Next Review:{" "}
                  {formatNextInterval(
                    nextReviewIntervalDays(currentCard.intervalDays ?? 1, true),
                  )}
                </span>
              </span>
            </div>

            <div className="mt-5 rounded-[28px] bg-[var(--noggin-white)] p-6 shadow-[0_12px_28px_var(--noggin-shadow)] sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="noggin-display text-[0.875rem] font-bold uppercase tracking-wide text-[var(--noggin-leaf-title)]">
                  Recall:
                </span>
                {topicTitleById.get(currentCard.topicId) && (
                  <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.75rem] font-semibold text-[var(--noggin-ink)]">
                    {topicTitleById.get(currentCard.topicId)}
                  </span>
                )}
              </div>

              <h1 className="noggin-display mt-2 text-[clamp(1.6rem,3.6vw,2.25rem)] font-extrabold leading-tight text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                {currentCard.label}
              </h1>

              <div className="mt-5">
                {!quoteVisible ? (
                  <button
                    type="button"
                    onClick={() => setQuoteVisible(true)}
                    className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-5 py-2.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
                  >
                    <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Show my words</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-3 rounded-[22px] bg-[var(--noggin-cream)] p-5">
                    <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--noggin-leaf-strong)]">
                      Your words
                    </p>
                    <blockquote className="text-[1rem] leading-relaxed text-[var(--noggin-forest)]">
                      {currentCard.quote || currentCard.paraphrase}
                    </blockquote>
                    {currentCard.quote &&
                      currentCard.paraphrase &&
                      currentCard.paraphrase !== currentCard.quote && (
                        <p className="text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                          {nog.name}&apos;s takeaway: {currentCard.paraphrase}
                        </p>
                      )}
                  </div>
                )}
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  className="mt-4 rounded-[18px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
                >
                  {errorMessage}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleRemembered()}
                  className="noggin-primary-pill noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-7 text-[1rem] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>I still know this</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleTeachAgain()}
                  className="noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-6 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-panel)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                >
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Teach it again</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {step === "done" && (
          <section className="flex flex-col items-center gap-5 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-7 text-center shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--noggin-mint-light)] text-[var(--noggin-leaf-strong)]">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>

            <div className="w-full max-w-[200px]">
              <NogStage
                scene="room"
                alt={`${nog.name} feeling refreshed`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="200px"
                priority
                className="nog-bob"
              />
            </div>

            <h1 className="noggin-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-[var(--noggin-forest)]">
              Watered! {refreshedCount}{" "}
              {refreshedCount === 1 ? "thought" : "thoughts"} refreshed
            </h1>

            <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
              {nog.name}&apos;s memory is stronger now. Come back when the next
              review is ready.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link
                href={roomHref}
                className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center px-7 text-[1rem] font-bold"
              >
                Back to room
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStep("select");
                  setCurrentIndex(0);
                  setQuoteVisible(false);
                }}
                className="noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-6 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-cream)] motion-reduce:transition-none"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Review list</span>
              </button>
            </div>
          </section>
        )}
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
