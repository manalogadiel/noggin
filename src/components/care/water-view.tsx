"use client";

import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Check,
  Eye,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { reviewCardAction } from "@/app/(app)/nogs/[id]/water/actions";
import { useGameUi } from "@/components/game-ui/game-ui-context";
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
  const { activeRoom } = useGameUi();
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
    <div className="game-world game-world--scroll">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={activeRoom.src} alt="" className="scene-bg-img" />
      <div className="scene-bg-scrim scene-bg-scrim--soft" aria-hidden="true" />
      <RoomRail nogId={nog.id} />

      <header className="stage-top">
        <div className="flex items-center gap-3">
          <Link
            href={roomHref}
            aria-label={`Back to ${nog.name}'s room`}
            className="stage-close-btn"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <span className="pill pill--dark">
            Water
          </span>
        </div>
      </header>

      <div
        className="stage-body stage-body--with-rail"
        style={{ justifyContent: "flex-start" }}
      >
        {step === "select" && (
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <header className="flex min-w-0 flex-col gap-2">
                <h1 className="stage-h1">
                  Let&apos;s test what you know!
                </h1>
                <p className="stage-sub max-w-[52ch]">
                  Revisit what you&apos;ve learned to help your Nog grow
                  stronger!
                </p>
              </header>

              {dueCards.length > 0 && (
                <div className="mx-auto w-full max-w-[240px] shrink-0 lg:mx-0 lg:max-w-[360px]">
                  <Image
                    src="/nog/hatchling-confused.png"
                    alt={`${nog.name} wondering what you remember`}
                    width={1024}
                    height={1024}
                    sizes="(min-width: 1024px) 360px, 240px"
                    priority
                    className="nog-bob h-auto w-full object-contain"
                  />
                </div>
              )}
            </div>

            {dueCards.length === 0 ? (
              <div className="mt-1 flex flex-col items-center gap-3 py-2 text-center">
                <div className="w-full max-w-[200px] lg:max-w-[230px]">
                  <NogStage
                    scene="room"
                    alt={`${nog.name} with a fresh memory`}
                    poster="/nog/blob-closeup.png"
                    width={1254}
                    height={1254}
                    sizes="(min-width: 1024px) 230px, 200px"
                    priority
                    className="nog-bob w-full"
                  />
                </div>
                <p className="noggin-display max-w-[38ch] text-[1.25rem] font-bold text-[var(--noggin-forest)]">
                  Nothing to water today — your Nog&apos;s memory is fresh!
                </p>
                <Link
                  href={roomHref}
                  className="pub-cta-pill pub-cta-pill--md"
                >
                  Back to room
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <ul
                  className="flex flex-col gap-3"
                  aria-label="Due thoughts"
                >
                  {dueCards.map((card) => {
                    const checked = selectedIds.has(card.id);
                    const topicTitle = topicTitleById.get(card.topicId);
                    const badgeLabel =
                      card.status === "shaky" ? "Shaky" : "Dusty";

                    return (
                      <li key={card.id}>
                        <label
                          className={cn(
                            "surface-white flex min-h-15 cursor-pointer items-center justify-between gap-4 rounded-[var(--noggin-radius-pill)] border px-6 py-3.5 transition-all duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                            checked
                              ? "border-[var(--noggin-leaf-strong)] ring-2 ring-[var(--noggin-leaf-strong)]"
                              : "border-[var(--noggin-sage-strong)]",
                          )}
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="noggin-display text-[1rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                              {card.label}
                            </span>
                            {topicTitle && (
                              <span className="text-[0.875rem] font-medium text-[var(--noggin-ink)]">
                                {topicTitle}
                              </span>
                            )}
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-2.5 py-0.5 text-[0.75rem] font-semibold",
                                card.status === "shaky"
                                  ? "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]"
                                  : "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]",
                              )}
                            >
                              {badgeLabel}
                            </span>
                          </span>

                          <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCard(card.id)}
                              className="peer h-6 w-6 cursor-pointer appearance-none rounded-[8px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] transition-colors checked:bg-[var(--noggin-leaf-strong)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)]"
                            />
                            <Check
                              aria-hidden="true"
                              className="pointer-events-none absolute h-3.5 w-3.5 text-[var(--noggin-white)] opacity-0 transition-opacity peer-checked:opacity-100"
                              strokeWidth={3}
                            />
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-col items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleStartReview}
                    className="pub-cta-pill pub-cta-pill--md inline-flex cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Start Reviewing →
                  </button>
                  <p className="text-[0.875rem] font-medium text-[var(--noggin-ink)]">
                    {selectedCount} of {dueCards.length} selected
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "review" && currentCard && (
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="noggin-display text-[0.9375rem] font-bold uppercase tracking-wide text-[var(--noggin-leaf-strong)]">
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

            <section className="surface-sage rounded-[28px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="noggin-display text-[0.9375rem] font-extrabold uppercase tracking-wide text-[var(--noggin-forest)]">
                  Recall:
                </span>
                {topicTitleById.get(currentCard.topicId) && (
                  <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-3.5 py-1 text-[0.8125rem] font-semibold text-[var(--noggin-forest)]">
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
                    className="gbtn gbtn--white gap-2"
                  >
                    <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Show my words</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-3 rounded-[22px] bg-[var(--noggin-white)] p-5 shadow-[0_6px_16px_var(--noggin-shadow)]">
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
                  className="mt-4 rounded-[18px] border border-[var(--noggin-danger)] bg-[var(--noggin-white)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
                >
                  {errorMessage}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleRemembered()}
                  className="pub-cta-pill pub-cta-pill--md inline-flex cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>I still know this</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleTeachAgain()}
                  className="gbtn gbtn--white gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Teach it again</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--noggin-sage)] text-[var(--noggin-forest)]">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>

            <div className="w-full max-w-[280px] lg:max-w-[360px]">
              <NogStage
                scene="room"
                alt={`${nog.name} feeling refreshed`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 360px, 280px"
                priority
                className="nog-bob w-full"
              />
            </div>

            <h1 className="stage-h1" style={{ fontSize: "38px" }}>
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
                className="pub-cta-pill pub-cta-pill--md"
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
                className="gbtn gbtn--white gap-2"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Review list</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
