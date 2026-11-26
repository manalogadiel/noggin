"use client";

import { Scissors, Utensils } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { MicButton } from "@/components/voice/mic-button";
import type {
  MicMode,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import { DEFAULT_LESSON_WORD_LIMIT } from "@/core/domain/lesson";
import { cn } from "@/lib/utils";

function appendTranscript(currentDraft: string, transcript: string): string {
  const cleaned = transcript.trim();
  if (!cleaned) {
    return currentDraft;
  }
  if (currentDraft.trim().length === 0) {
    return cleaned;
  }
  return `${currentDraft.trimEnd()} ${cleaned}`;
}

export interface LessonEditorProps {
  topic: TopicSummary;
  draft: string;
  wordCount: number;
  maxWords?: number;
  isOverloaded: boolean;
  isSaving: boolean;
  fixingCard: ThoughtCardRecord | null;
  splitPartIndex: number;
  splitTotalParts: number;
  micMode?: MicMode;
  onDraftChange: (value: string) => void;
  onFeed: () => void;
  onSplit: () => void;
}

export function LessonEditor({
  topic,
  draft,
  wordCount,
  maxWords = DEFAULT_LESSON_WORD_LIMIT,
  isOverloaded,
  isSaving,
  fixingCard,
  splitPartIndex,
  splitTotalParts,
  micMode = "tap",
  onDraftChange,
  onFeed,
  onSplit,
}: LessonEditorProps) {
  const editorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const canFeed = wordCount > 0 && !isOverloaded && !isSaving;

  function handleTranscript(transcript: string) {
    const nextDraft = appendTranscript(draftRef.current, transcript);
    draftRef.current = nextDraft;
    onDraftChange(nextDraft);
  }

  return (
    <section
      aria-label="Lesson editor"
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-[28px] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] transition-colors duration-200 motion-reduce:transition-none sm:p-6",
        isOverloaded
          ? "bg-[var(--noggin-meter-low-soft)] shadow-[0_5px_0_var(--game-coral-lip),0_14px_34px_var(--noggin-shadow)]"
          : "surface-sage bg-[var(--noggin-sage)]",
      )}
    >
      {fixingCard && (
        <div className="rounded-[20px] bg-[var(--noggin-white)] px-4 py-3 shadow-[0_4px_14px_var(--noggin-shadow)]">
          <h2 className="noggin-display text-[1.0625rem] font-extrabold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
            Fixing: {fixingCard.label}
          </h2>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
            Clarify this part so it clicks cleanly.
          </p>
        </div>
      )}

      {splitTotalParts > 1 && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-[18px] bg-[var(--noggin-white)] px-4 py-2.5 text-[0.875rem] font-semibold text-[var(--noggin-forest)]"
        >
          <span>
            Part {splitPartIndex} of {splitTotalParts} — feed each chunk in order.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={editorId}
            className="noggin-display text-[0.9375rem] font-bold text-[var(--noggin-forest)]"
          >
            Your lesson
          </label>
          <span
            className={cn(
              "text-[0.8125rem] font-semibold tabular-nums",
              isOverloaded
                ? "text-[var(--noggin-danger)]"
                : "text-[var(--noggin-forest)]",
            )}
          >
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        </div>

        <textarea
          ref={textareaRef}
          id={editorId}
          aria-label="Your lesson"
          rows={8}
          placeholder={`Explain ${topic.title} in your own words…`}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={isSaving}
          className={cn(
            "g-textarea min-h-[210px] w-full resize-y rounded-[22px] p-4 text-[1rem] leading-relaxed text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] shadow-[inset_0_2px_8px_var(--noggin-shadow)] focus-visible:outline-none disabled:opacity-75",
            isOverloaded
              ? "bg-[var(--noggin-cream)] shadow-[0_4px_0_var(--game-coral-lip),inset_0_2px_8px_var(--noggin-shadow)]"
              : "bg-[var(--noggin-white)]",
          )}
        />

        {isOverloaded && (
          <p className="text-[0.875rem] font-medium text-[var(--noggin-danger)]">
            Keep each chunk under {maxWords} words, or split it into bite-sized parts.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {isOverloaded ? (
            <>
              <button
                type="button"
                onClick={onSplit}
                disabled={isSaving}
                className="gbtn gbtn--coral gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Scissors className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Split lesson</span>
              </button>

              <button
                type="button"
                disabled
                className="noggin-display inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sand)] px-5 text-[1rem] font-bold text-[var(--noggin-ink)] opacity-70"
              >
                <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Feed</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onFeed}
              disabled={!canFeed}
              className="pub-cta-pill inline-flex cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Feed</span>
            </button>
          )}
        </div>

        <MicButton
          mode={micMode}
          onTranscript={handleTranscript}
          disabled={isSaving}
          declineFocusRef={textareaRef}
          hint={topic.title}
        />
      </div>
    </section>
  );
}
