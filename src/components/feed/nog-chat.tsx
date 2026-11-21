"use client";

import { CheckCircle2, RefreshCw, Send } from "lucide-react";
import { type FormEvent, useId } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { countWords, DEFAULT_LESSON_WORD_LIMIT } from "@/core/domain/lesson";
import { cn } from "@/lib/utils";

export interface FollowUpItem {
  id: string;
  question: string;
  draft: string;
  answered: boolean;
  submitting: boolean;
  brainFogKey: string | null;
  error: string | null;
}

export interface NogChatProps {
  nogName: string;
  bubbleText: string;
  isDizzy?: boolean;
  showBrainFogRetry?: boolean;
  isRetrying?: boolean;
  onRetryBrainFog?: () => void;
  alertMessage?: string | null;
  followUps?: ReadonlyArray<FollowUpItem>;
  onFollowUpDraftChange?: (id: string, value: string) => void;
  onSubmitFollowUp?: (id: string) => void;
  onRetryFollowUp?: (id: string) => void;
}

export function NogChat({
  nogName,
  bubbleText,
  isDizzy = false,
  showBrainFogRetry = false,
  isRetrying = false,
  onRetryBrainFog,
  alertMessage,
  followUps = [],
  onFollowUpDraftChange,
  onSubmitFollowUp,
  onRetryFollowUp,
}: NogChatProps) {
  const baseId = useId();

  function handleFollowUpSubmit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    onSubmitFollowUp?.(id);
  }

  return (
    <section
      aria-label={`${nogName} response`}
      className="flex min-w-0 flex-col items-center gap-4"
    >
      <div className="flex w-full flex-col items-center gap-4">
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "relative w-full rounded-[24px] px-5 py-4 text-[0.9375rem] leading-relaxed font-semibold shadow-[0_8px_20px_var(--noggin-shadow)]",
            isDizzy
              ? "border-2 border-[var(--noggin-danger)] bg-[var(--noggin-cream)] text-[var(--noggin-danger)]"
              : "border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] text-[var(--noggin-forest)]",
          )}
        >
          <p className="[overflow-wrap:anywhere]">{bubbleText}</p>

          {showBrainFogRetry && onRetryBrainFog && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={onRetryBrainFog}
              className="noggin-display mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Retry</span>
            </button>
          )}

          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45",
              isDizzy
                ? "border-r-2 border-b-2 border-[var(--noggin-danger)] bg-[var(--noggin-cream)]"
                : "border-r border-b border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)]",
            )}
          />
        </div>

        <div className="w-full max-w-[300px] shrink-0 lg:max-w-[380px]">
          {isDizzy ? (
            <NogStage
              scene="dizzy"
              alt={`${nogName} looks dizzy from too many words at once`}
              poster="/nog/hatchling-dizzy.png"
              width={1024}
              height={1024}
              sizes="(min-width: 1024px) 380px, 300px"
              className="nog-bob w-full"
            />
          ) : (
            <NogStage
              scene="room"
              alt={`${nogName} listening closely to your lesson`}
              poster="/nog/blob-closeup.png"
              width={1254}
              height={1254}
              sizes="(min-width: 1024px) 380px, 300px"
              className="nog-bob w-full"
            />
          )}
        </div>
      </div>

      {alertMessage && (
        <p
          role="alert"
          className="w-full rounded-[18px] border border-[var(--noggin-danger)] bg-[var(--noggin-cream)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-danger)]"
        >
          {alertMessage}
        </p>
      )}

      {followUps.length > 0 && (
        <div className="flex w-full flex-col gap-3 rounded-[28px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-sage)] p-5 shadow-[0_12px_28px_var(--noggin-shadow)]">
          <h2 className="noggin-display text-[1rem] font-extrabold text-[var(--noggin-forest)]">
            {nogName}&rsquo;s questions
          </h2>

          <ul className="flex flex-col gap-3">
            {followUps.map((item, index) => {
              const inputId = `${baseId}-followup-${index}`;
              const answerWords = countWords(item.draft);
              const overLimit = answerWords > DEFAULT_LESSON_WORD_LIMIT;
              const canSubmit =
                answerWords > 0 && !overLimit && !item.submitting;

              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2.5 rounded-[22px] bg-[var(--noggin-cream)] p-4 shadow-[0_4px_12px_var(--noggin-shadow)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.9375rem] font-semibold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      {item.question}
                    </p>

                    {item.answered && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--noggin-forest)]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Answered</span>
                      </span>
                    )}
                  </div>

                  {!item.answered && (
                    <form
                      noValidate
                      onSubmit={(event) => handleFollowUpSubmit(event, item.id)}
                      className="flex flex-col gap-2"
                    >
                      <label htmlFor={inputId} className="sr-only">
                        Answer {nogName}…
                      </label>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          id={inputId}
                          type="text"
                          aria-label={`Answer ${nogName}…`}
                          placeholder={`Answer ${nogName}…`}
                          value={item.draft}
                          onChange={(event) =>
                            onFollowUpDraftChange?.(item.id, event.target.value)
                          }
                          disabled={item.submitting}
                          className="min-h-11 w-full flex-1 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 py-2 text-[0.9375rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] shadow-[0_4px_12px_var(--noggin-shadow)] focus-visible:outline-3 focus-visible:outline-[var(--noggin-leaf)] disabled:opacity-70"
                        />

                        <button
                          type="submit"
                          disabled={!canSubmit}
                          className="noggin-primary-pill noggin-display inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-5 text-[0.9375rem] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.submitting ? "Sending…" : "Send"}</span>
                        </button>
                      </div>

                      {overLimit && (
                        <p
                          role="alert"
                          className="text-[0.8125rem] font-medium text-[var(--noggin-danger)]"
                        >
                          Keep your answer under {DEFAULT_LESSON_WORD_LIMIT} words.
                        </p>
                      )}

                      {item.error && (
                        <div
                          role="alert"
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[var(--noggin-danger-soft)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--noggin-danger)]"
                        >
                          <span>{item.error}</span>

                          {item.brainFogKey && onRetryFollowUp && (
                            <button
                              type="button"
                              disabled={item.submitting}
                              onClick={() => onRetryFollowUp(item.id)}
                              className="noggin-display inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-3 text-[0.8125rem] font-bold text-[var(--noggin-forest)]"
                            >
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      )}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
