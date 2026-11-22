"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  PencilLine,
  Play,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { reviseLessonAction } from "@/app/(app)/actions/lesson-actions";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { RoomRail } from "@/components/room/room-rail";
import type { NogRecord } from "@/core/application/ports";
import { countWords, DEFAULT_LESSON_WORD_LIMIT } from "@/core/domain/lesson";
import { cn } from "@/lib/utils";

export interface BathItem {
  id: string;
  kind: "card" | "attempt";
  topicId: string;
  topicTitle: string;
  title: string;
  statusLabel: "Shaky" | "Confused" | "Missed check";
  nogAnswer: string;
  missedConcepts: string[];
  cardId: string | null;
  lessonId: string | null;
  originalLessonBody: string;
}

export interface BathViewProps {
  nog: NogRecord;
  items: ReadonlyArray<BathItem>;
  initialSelectedId: string | null;
}

type BathMode = "detail" | "revise";

type SaveFeedback =
  | { kind: "ok"; reply: string }
  | { kind: "overload"; wordCount: number; limit: number }
  | { kind: "empty" }
  | { kind: "tired_for_today" }
  | { kind: "brain_fog" }
  | { kind: "error"; message: string };

function createRevisionKey(lessonId: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `bath-revise-${lessonId}-${suffix}`;
}

export function BathView({ nog, items, initialSelectedId }: BathViewProps) {
  const router = useRouter();
  const roomHref = `/nogs/${nog.id}`;

  const defaultId =
    initialSelectedId && items.some((item) => item.id === initialSelectedId)
      ? initialSelectedId
      : (items[0]?.id ?? null);

  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const [mode, setMode] = useState<BathMode>("detail");
  const [draft, setDraft] = useState<string>(() => {
    const initial = items.find((item) => item.id === defaultId);
    return initial?.originalLessonBody ?? "";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const wordCount = countWords(draft);
  const isOverload = wordCount > DEFAULT_LESSON_WORD_LIMIT;

  const handleSelectItem = useCallback((item: BathItem) => {
    setSelectedId(item.id);
    setMode("detail");
    setDraft(item.originalLessonBody);
    setSaveFeedback(null);
    idempotencyKeyRef.current = null;
  }, []);

  const handleOpenRevise = useCallback(() => {
    if (!selected) {
      return;
    }
    setDraft(selected.originalLessonBody);
    setSaveFeedback(null);
    idempotencyKeyRef.current = null;
    setMode("revise");
  }, [selected]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    setSaveFeedback(null);
    idempotencyKeyRef.current = null;
  }, []);

  const handleSaveRevision = useCallback(async () => {
    if (!selected || !selected.lessonId || isSaving) {
      return;
    }

    const trimmedWords = countWords(draft);
    if (trimmedWords === 0) {
      setSaveFeedback({ kind: "empty" });
      return;
    }
    if (trimmedWords > DEFAULT_LESSON_WORD_LIMIT) {
      setSaveFeedback({
        kind: "overload",
        wordCount: trimmedWords,
        limit: DEFAULT_LESSON_WORD_LIMIT,
      });
      return;
    }

    const key =
      idempotencyKeyRef.current ?? createRevisionKey(selected.lessonId);
    idempotencyKeyRef.current = key;

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const result = await reviseLessonAction({
        nogId: nog.id,
        topicId: selected.topicId,
        lessonId: selected.lessonId,
        body: draft,
        idempotencyKey: key,
      });

      if (result.status === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(`${roomHref}/bath`)}`);
        return;
      }

      if (result.status === "ok") {
        setSaveFeedback({
          kind: "ok",
          reply:
            result.digest.reply ||
            `${nog.name} updated its notes with your clearer explanation!`,
        });
        return;
      }

      if (result.status === "overload") {
        setSaveFeedback({
          kind: "overload",
          wordCount: result.wordCount,
          limit: result.limit,
        });
        return;
      }

      if (result.status === "empty") {
        setSaveFeedback({ kind: "empty" });
        return;
      }

      if (result.status === "tired_for_today") {
        setSaveFeedback({ kind: "tired_for_today" });
        return;
      }

      if (result.status === "brain_fog") {
        setSaveFeedback({ kind: "brain_fog" });
        return;
      }

      setSaveFeedback({
        kind: "error",
        message: "Couldn't save that revision right now. Try again.",
      });
    } catch {
      setSaveFeedback({
        kind: "error",
        message: "Couldn't save that revision right now. Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [draft, isSaving, nog.id, nog.name, roomHref, router, selected]);

  const feedHref = selected
    ? selected.cardId
      ? `${roomHref}/feed?card=${encodeURIComponent(selected.cardId)}&topic=${encodeURIComponent(selected.topicId)}`
      : `${roomHref}/feed?topic=${encodeURIComponent(selected.topicId)}`
    : `${roomHref}/feed`;

  const rerunHref = selected
    ? `${roomHref}/play?topic=${encodeURIComponent(selected.topicId)}`
    : `${roomHref}/play`;

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
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{nog.name} · Bath</span>
          </span>
        </div>

        {!selected ? (
          <section className="flex flex-col items-center gap-5 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-7 text-center shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-10">
            <div className="w-full max-w-[200px]">
              <NogStage
                scene="room"
                alt={`${nog.name} squeaky clean`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="200px"
                priority
                className="nog-bob"
              />
            </div>

            <h1 className="noggin-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-[var(--noggin-leaf-title)]">
              Squeaky clean! Nothing to fix.
            </h1>

            <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
              {nog.name} has no shaky thoughts or missed quiz concepts right
              now.
            </p>

            <Link
              href={roomHref}
              className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center px-7 text-[1rem] font-bold"
            >
              Back to room
            </Link>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)] xl:items-start">
            <aside
              aria-label="Thoughts to fix"
              className="rounded-[28px] bg-[var(--noggin-white)] p-4 shadow-[0_12px_28px_var(--noggin-shadow)]"
            >
              <h2 className="noggin-display px-2 text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                Needs a bath ({items.length})
              </h2>

              <ul className="mt-3 flex flex-col gap-2">
                {items.map((item) => {
                  const isActive = item.id === selected.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => handleSelectItem(item)}
                        className={cn(
                          "flex w-full min-h-12 cursor-pointer flex-col items-start gap-1 rounded-[18px] px-3.5 py-3 text-left transition-colors duration-150 motion-reduce:transition-none",
                          isActive
                            ? "bg-[var(--noggin-mint-light)] ring-2 ring-[var(--noggin-leaf-strong)]"
                            : "bg-[var(--noggin-mint)] hover:bg-[var(--noggin-cream)]",
                        )}
                      >
                        <span className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                          {item.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[0.75rem] font-semibold">
                          <span className="text-[var(--noggin-ink)]">
                            {item.topicTitle}
                          </span>
                          <span
                            className={cn(
                              "rounded-[var(--noggin-radius-pill)] px-2 py-0.5",
                              item.statusLabel === "Confused"
                                ? "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]"
                                : "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
                            )}
                          >
                            {item.statusLabel}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {mode === "detail" ? (
              <section className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="noggin-display text-[clamp(1.85rem,4vw,2.6rem)] font-extrabold leading-[1.08] text-[var(--noggin-leaf-title)]">
                      Missed Concept
                    </h1>
                    <p className="mt-1 text-[0.9375rem] font-semibold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      {selected.title} ·{" "}
                      <span className="font-medium text-[var(--noggin-ink)]">
                        {selected.topicTitle}
                      </span>
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-3.5 py-1 text-[0.8125rem] font-bold",
                      selected.statusLabel === "Confused"
                        ? "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]"
                        : "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
                    )}
                  >
                    {selected.statusLabel}
                  </span>
                </header>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <article className="flex flex-col gap-2.5 rounded-[24px] bg-[var(--noggin-white)] p-5 shadow-[0_10px_24px_var(--noggin-shadow)]">
                    <h2 className="noggin-display text-[0.9375rem] font-bold uppercase tracking-wide text-[var(--noggin-leaf-strong)]">
                      Nog Answer
                    </h2>
                    <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      {selected.nogAnswer}
                    </p>
                  </article>

                  <article className="flex flex-col gap-3 rounded-[24px] bg-[var(--noggin-white)] p-5 shadow-[0_10px_24px_var(--noggin-shadow)]">
                    <h2 className="noggin-display text-[0.9375rem] font-bold uppercase tracking-wide text-[var(--noggin-meter-mid-ink)]">
                      What it missed
                    </h2>
                    <p className="text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                      Explain these in your own words
                    </p>

                    {selected.missedConcepts.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {selected.missedConcepts.map((concept) => (
                          <li
                            key={concept}
                            className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-meter-mid-soft)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-[var(--noggin-meter-mid-ink)]"
                          >
                            {concept}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-[16px] bg-[var(--noggin-cream)] px-3.5 py-2.5 text-[0.875rem] text-[var(--noggin-forest)]">
                        Give {nog.name} a clearer explanation of{" "}
                        <span className="font-semibold">{selected.title}</span>.
                      </p>
                    )}
                  </article>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {selected.lessonId && (
                    <button
                      type="button"
                      onClick={handleOpenRevise}
                      className="noggin-primary-pill noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-7 text-[1rem] font-bold"
                    >
                      <PencilLine
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Revise</span>
                    </button>
                  )}

                  <Link
                    href={feedHref}
                    className="noggin-display inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-6 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
                  >
                    <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Fix this thought</span>
                  </Link>
                </div>
              </section>
            ) : (
              <section className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_16px_38px_var(--noggin-shadow)] sm:p-8">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="noggin-display text-[clamp(1.85rem,4vw,2.6rem)] font-extrabold leading-[1.08] text-[var(--noggin-leaf-title)]">
                      Revise
                    </h1>
                    <p className="mt-1 text-[0.9375rem] text-[var(--noggin-ink)]">
                      Update your lesson for{" "}
                      <span className="font-semibold text-[var(--noggin-forest)]">
                        {selected.title}
                      </span>{" "}
                      in {selected.topicTitle}.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMode("detail")}
                    className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-cream)] motion-reduce:transition-none"
                  >
                    Back to concept
                  </button>
                </header>

                <div className="mt-5 flex flex-col gap-3 rounded-[24px] bg-[var(--noggin-white)] p-5 shadow-[0_12px_28px_var(--noggin-shadow)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="bath-revise-editor"
                      className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]"
                    >
                      Your revised lesson
                    </label>
                    <span
                      className={cn(
                        "rounded-[var(--noggin-radius-pill)] px-3 py-1 text-[0.8125rem] font-semibold",
                        isOverload
                          ? "bg-[var(--noggin-danger-soft)] text-[var(--noggin-danger)]"
                          : "bg-[var(--noggin-mint)] text-[var(--noggin-ink)]",
                      )}
                    >
                      {wordCount} / {DEFAULT_LESSON_WORD_LIMIT} words
                    </span>
                  </div>

                  <textarea
                    id="bath-revise-editor"
                    rows={6}
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    placeholder={`Explain ${selected.title} in your own words…`}
                    className="w-full resize-y rounded-[18px] border border-[var(--noggin-panel)] bg-[var(--noggin-cream)] p-4 text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--noggin-leaf-strong)]"
                  />

                  {saveFeedback?.kind === "ok" && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-start gap-2.5 rounded-[18px] bg-[var(--noggin-mint-light)] p-4 text-[var(--noggin-forest)]"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--noggin-leaf-strong)]"
                        aria-hidden="true"
                      />
                      <div className="flex flex-col gap-0.5">
                        <p className="noggin-display text-[0.9375rem] font-bold">
                          Revision saved!
                        </p>
                        <p className="text-[0.875rem] leading-relaxed">
                          {saveFeedback.reply}
                        </p>
                      </div>
                    </div>
                  )}

                  {saveFeedback?.kind === "overload" && (
                    <p
                      role="alert"
                      className="flex items-center gap-2 rounded-[18px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
                    >
                      <AlertCircle
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Too much, boss! Keep it within {saveFeedback.limit}{" "}
                        words (currently {saveFeedback.wordCount}).
                      </span>
                    </p>
                  )}

                  {saveFeedback?.kind === "empty" && (
                    <p
                      role="alert"
                      className="rounded-[18px] bg-[var(--noggin-meter-mid-soft)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-meter-mid-ink)]"
                    >
                      Write a short explanation before saving.
                    </p>
                  )}

                  {saveFeedback?.kind === "tired_for_today" && (
                    <p
                      role="alert"
                      className="rounded-[18px] bg-[var(--noggin-meter-mid-soft)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-meter-mid-ink)]"
                    >
                      {nog.name} is tired for today — try again tomorrow.
                    </p>
                  )}

                  {saveFeedback?.kind === "brain_fog" && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[var(--noggin-danger)]"
                    >
                      <span className="text-[0.875rem] font-semibold">
                        Brain fog — your revision was saved, try again in a bit.
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleSaveRevision()}
                        className="noggin-display inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)]"
                      >
                        <RefreshCw
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {saveFeedback?.kind === "error" && (
                    <p
                      role="alert"
                      className="rounded-[18px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
                    >
                      {saveFeedback.message}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isSaving || isOverload || wordCount === 0}
                      onClick={() => void handleSaveRevision()}
                      className="noggin-primary-pill noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-7 text-[1rem] font-bold disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span>{isSaving ? "Saving…" : "Save Revision"}</span>
                    </button>

                    <Link
                      href={rerunHref}
                      className="noggin-display inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-6 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-panel)] motion-reduce:transition-none"
                    >
                      <Play
                        className="h-4 w-4 shrink-0 fill-current"
                        aria-hidden="true"
                      />
                      <span>Rerun Check</span>
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
