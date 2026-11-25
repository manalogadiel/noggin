"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Play,
  RefreshCw,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { reviseLessonAction } from "@/app/(app)/actions/lesson-actions";
import { useGameUi } from "@/components/game-ui/game-ui-context";
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
  fullTitle?: string;
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
  const { activeRoom } = useGameUi();
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

          <h1 className="stage-h1" style={{ fontSize: "32px" }}>
            Bath
          </h1>
        </div>
      </header>

      <div
        className="stage-body stage-body--with-rail gap-6"
        style={{ justifyContent: "flex-start" }}
      >
        {!selected ? (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="w-full max-w-[280px] lg:max-w-[360px]">
              <NogStage
                scene="room"
                alt={`${nog.name} squeaky clean`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 360px, 280px"
                priority
                className="nog-bob w-full"
              />
            </div>

            <h2 className="stage-h1" style={{ fontSize: "36px" }}>
              Squeaky clean! Nothing to fix.
            </h2>

            <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
              {nog.name} has no shaky thoughts or missed quiz concepts right
              now.
            </p>

            <Link
              href={roomHref}
              className="pub-cta-pill pub-cta-pill--md"
            >
              Back to room
            </Link>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            <aside
              aria-label="Thoughts to fix"
              className="surface-mint rounded-[24px] border border-[var(--noggin-sage-strong)] p-4"
            >
              <h2 className="noggin-display px-1 text-[0.9375rem] font-extrabold text-[var(--noggin-forest)]">
                Needs a bath ({items.length})
              </h2>

              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const isActive = item.id === selected.id;
                  const fullLabel = item.fullTitle ?? item.title;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        title={fullLabel}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => handleSelectItem(item)}
                        className={cn(
                          "flex h-full w-full min-h-12 cursor-pointer flex-col items-start justify-between gap-1.5 rounded-[18px] px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none",
                          isActive
                            ? "bg-[var(--noggin-sage)] ring-2 ring-[var(--noggin-leaf-strong)]"
                            : "bg-[var(--noggin-white)] hover:bg-[var(--noggin-cream)]",
                        )}
                      >
                        <span className="noggin-display text-[0.9375rem] font-bold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                          {item.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[0.75rem] font-semibold">
                          <span
                            className={cn(
                              isActive
                                ? "text-[var(--noggin-forest)]"
                                : "text-[var(--noggin-ink)]",
                            )}
                          >
                            {item.topicTitle}
                          </span>
                          <span
                            className={cn(
                              "rounded-[var(--noggin-radius-pill)] px-2 py-0.5",
                              item.statusLabel === "Confused"
                                ? "bg-[var(--noggin-white)] text-[var(--noggin-danger)]"
                                : "bg-[var(--noggin-cream)] text-[var(--noggin-meter-mid-ink)]",
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
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:items-start">
                <div className="flex flex-col items-center gap-4 lg:items-start">
                  <div className="w-full min-w-0">
                    <h2 className="stage-h1" style={{ fontSize: "36px" }}>
                      Missed Concept
                    </h2>
                    <p
                      title={selected.fullTitle ?? selected.title}
                      className="mt-2 text-[1rem] font-bold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]"
                    >
                      {selected.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[0.875rem] font-medium text-[var(--noggin-ink)]">
                        {selected.topicTitle}
                      </span>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-3 py-0.5 text-[0.75rem] font-bold",
                          selected.statusLabel === "Confused"
                            ? "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]"
                            : "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
                        )}
                      >
                        {selected.statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="w-full max-w-[300px] lg:max-w-[360px]">
                    <NogStage
                      scene="thinking"
                      alt={`${nog.name} thinking about ${selected.fullTitle ?? selected.title}`}
                      poster="/nog/thinking.png"
                      width={1024}
                      height={1024}
                      sizes="(min-width: 1024px) 360px, 300px"
                      priority
                      className="nog-bob w-full"
                    />
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <article className="surface-sage flex min-h-[260px] flex-col gap-3 rounded-[28px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-6 shadow-[0_12px_28px_var(--noggin-shadow)]">
                      <h3 className="noggin-display text-[1rem] font-extrabold uppercase tracking-wide text-[var(--noggin-forest)]">
                        Nog Answer
                      </h3>
                      <p className="text-[1rem] leading-relaxed text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                        {selected.nogAnswer}
                      </p>
                    </article>

                    <article className="surface-sage flex min-h-[260px] flex-col gap-3 rounded-[28px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-6 shadow-[0_12px_28px_var(--noggin-shadow)]">
                      <h3 className="noggin-display text-[1rem] font-extrabold uppercase tracking-wide text-[var(--noggin-forest)]">
                        What it missed
                      </h3>
                      <p className="text-[0.875rem] font-medium leading-relaxed text-[var(--noggin-forest)]">
                        Explain these in your own words
                      </p>

                      {selected.missedConcepts.length > 0 ? (
                        <ul className="flex flex-wrap gap-2">
                          {selected.missedConcepts.map((concept) => (
                            <li
                              key={concept}
                              className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)]"
                            >
                              {concept}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-[18px] bg-[var(--noggin-white)] px-4 py-3 text-[0.875rem] text-[var(--noggin-forest)]">
                          Give {nog.name} a clearer explanation of{" "}
                          <span className="font-semibold">{selected.title}</span>.
                        </p>
                      )}
                    </article>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {selected.lessonId && (
                      <button
                        type="button"
                        onClick={handleOpenRevise}
                        className="pub-cta-pill pub-cta-pill--md cursor-pointer"
                      >
                        Start Revising →
                      </button>
                    )}

                    <Link
                      href={feedHref}
                      className="gbtn gbtn--white gap-2"
                    >
                      <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Fix this thought</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="stage-h1" style={{ fontSize: "34px" }}>
                      Revise
                    </h2>
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
                    className="gbtn gbtn--white gbtn--sm cursor-pointer"
                  >
                    Back to concept
                  </button>
                </header>

                <div className="surface-sage flex flex-col gap-4 rounded-[28px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-6">
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
                          ? "bg-[var(--noggin-danger)] text-[var(--noggin-white)]"
                          : "bg-[var(--noggin-white)] text-[var(--noggin-forest)]",
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
                    className="g-textarea w-full resize-y rounded-[20px] bg-[var(--noggin-white)] p-4 text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] shadow-[inset_0_2px_8px_var(--noggin-shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--noggin-leaf-strong)]"
                  />

                  {saveFeedback?.kind === "ok" && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-start gap-2.5 rounded-[18px] bg-[var(--noggin-white)] p-4 text-[var(--noggin-forest)]"
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
                      className="flex items-center gap-2 rounded-[18px] border border-[var(--noggin-danger)] bg-[var(--noggin-white)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
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
                      className="rounded-[18px] bg-[var(--noggin-cream)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-meter-mid-ink)]"
                    >
                      Write a short explanation before saving.
                    </p>
                  )}

                  {saveFeedback?.kind === "tired_for_today" && (
                    <p
                      role="alert"
                      className="rounded-[18px] bg-[var(--noggin-cream)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-meter-mid-ink)]"
                    >
                      {nog.name} is tired for today — try again tomorrow.
                    </p>
                  )}

                  {saveFeedback?.kind === "brain_fog" && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--noggin-danger)] bg-[var(--noggin-white)] px-4 py-3 text-[var(--noggin-danger)]"
                    >
                      <span className="text-[0.875rem] font-semibold">
                        Brain fog — your revision was saved, try again in a bit.
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleSaveRevision()}
                        className="gbtn gbtn--white gbtn--sm cursor-pointer gap-1.5"
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
                      className="rounded-[18px] border border-[var(--noggin-danger)] bg-[var(--noggin-white)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
                    >
                      {saveFeedback.message}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isSaving || isOverload || wordCount === 0}
                      onClick={() => void handleSaveRevision()}
                      className="pub-cta-pill pub-cta-pill--md inline-flex cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span>{isSaving ? "Saving…" : "Save Revision"}</span>
                    </button>

                    <Link
                      href={rerunHref}
                      className="gbtn gbtn--white gap-2"
                    >
                      <Play
                        className="h-4 w-4 shrink-0 fill-current"
                        aria-hidden="true"
                      />
                      <span>Rerun Check</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
