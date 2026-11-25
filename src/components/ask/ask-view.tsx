"use client";

import { ChevronLeft, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import { askNogAction } from "@/app/(app)/actions/ask-actions";
import { AskAnswer, type AskCitedNote } from "@/components/ask/ask-answer";
import { useGameUi } from "@/components/game-ui/game-ui-context";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { RoomRail } from "@/components/room/room-rail";
import { MicButton } from "@/components/voice/mic-button";
import type { MicMode } from "@/core/application/ports";
import { ASK_MAX_WORDS } from "@/core/domain/ask";
import { countWords } from "@/core/domain/lesson";
import { cn } from "@/lib/utils";

export interface AskExchangeView {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface AskViewProps {
  nog: { id: string; name: string };
  topics: ReadonlyArray<{ id: string; title: string }>;
  history: ReadonlyArray<AskExchangeView>;
  micMode: MicMode;
}

type LatestAnswer = {
  answer: string;
  knows: boolean;
  citedNotes: AskCitedNote[];
  messageId: string;
  topicId: string | null;
};

type Pending = { question: string; topicId: string | null };

const IDLE_LINE = "Ask me something you taught me!";
const TIRED_LINE = "I'm all asked out for today. Let's talk tomorrow!";
const FOG_LINE = "My head's a bit foggy. Try again?";
const TOO_LONG_LINE = `Keep it under ${ASK_MAX_WORDS} words.`;

function newestFirst(list: ReadonlyArray<AskExchangeView>): AskExchangeView[] {
  return [...list].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function relativeTime(iso: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  const minutes = Math.floor(elapsed / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AskView({ nog, topics, history, micMode }: AskViewProps) {
  const router = useRouter();
  const { activeRoom } = useGameUi();
  const ids = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [topicId, setTopicId] = useState("");
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [tired, setTired] = useState(false);
  const [fog, setFog] = useState<Pending | null>(null);
  const [latest, setLatest] = useState<LatestAnswer | null>(null);
  const [exchanges, setExchanges] = useState<AskExchangeView[]>(() =>
    newestFirst(history),
  );
  const [now] = useState(() => Date.now());

  const words = useMemo(() => countWords(draft), [draft]);
  const tooLong = words > ASK_MAX_WORDS;
  const canAsk = !waiting && !tired && !tooLong && draft.trim().length > 0;

  async function send(pending: Pending) {
    setWaiting(true);
    setFog(null);
    try {
      const result = await askNogAction({
        nogId: nog.id,
        question: pending.question,
        topicId: pending.topicId,
      });

      if (result.status === "ok") {
        setLatest({
          answer: result.answer,
          knows: result.knows,
          citedNotes: result.citedCards,
          messageId: result.answerMessageId,
          topicId: pending.topicId,
        });
        setExchanges((current) => [
          {
            id: result.answerMessageId,
            question: pending.question,
            answer: result.answer,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]);
        setDraft("");
      } else if (result.status === "tired_for_today") {
        setTired(true);
      } else if (result.status === "brain_fog") {
        setFog(pending);
      } else if (
        result.status === "unauthenticated" ||
        result.status === "not_found"
      ) {
        router.refresh();
      }
    } catch {
      setFog(pending);
    } finally {
      setWaiting(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAsk) return;
    void send({ question: draft.trim(), topicId: topicId || null });
  }

  function handleTranscript(text: string) {
    const spoken = text.trim();
    if (!spoken) return;
    setDraft((current) =>
      current.trim() ? `${current.trimEnd()} ${spoken}` : spoken,
    );
  }

  const fallbackAnswer = exchanges[0]?.answer ?? null;
  const teachHref = (forTopic: string | null) =>
    `/nogs/${nog.id}/feed${forTopic ? `?topic=${encodeURIComponent(forTopic)}` : ""}`;

  let bubble: React.ReactNode;
  if (waiting) {
    bubble = (
      <span className="flex items-center gap-1.5 py-1" aria-hidden="false">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-[var(--noggin-forest)] opacity-60 motion-safe:animate-pulse"
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
        <span className="sr-only">Thinking…</span>
      </span>
    );
  } else if (tired) {
    bubble = <p>{TIRED_LINE}</p>;
  } else if (fog) {
    bubble = (
      <div className="flex flex-col items-start gap-3">
        <p>{FOG_LINE}</p>
        <button
          type="button"
          onClick={() => void send(fog)}
          className="noggin-display inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint)] motion-reduce:transition-none"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  } else if (latest) {
    bubble = (
      <AskAnswer
        nogName={nog.name}
        answer={latest.answer}
        knows={latest.knows}
        citedNotes={latest.citedNotes}
        messageId={latest.messageId}
        teachHref={teachHref(latest.topicId)}
      />
    );
  } else {
    bubble = <p className="[overflow-wrap:anywhere]">{fallbackAnswer ?? IDLE_LINE}</p>;
  }

  const topicFieldId = `${ids}-topic`;
  const questionFieldId = `${ids}-question`;
  const recentHeadingId = `${ids}-recent`;

  return (
    <div className="game-world game-world--scroll">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={activeRoom.src} alt="" className="scene-bg-img" />
      <div className="scene-bg-scrim scene-bg-scrim--soft" aria-hidden="true" />
      <RoomRail nogId={nog.id} />

      <header className="stage-top">
        <div className="flex items-center gap-3">
          <Link
            href={`/nogs/${nog.id}`}
            aria-label="Back to room"
            className="stage-close-btn"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </Link>
          <h1 className="stage-h1" style={{ fontSize: "32px" }}>
            Ask {nog.name}
          </h1>
        </div>
      </header>

      <div
        className="stage-body stage-body--with-rail"
        style={{ justifyContent: "flex-start" }}
      >
        <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-6">
          <section aria-label={`${nog.name} answer`} className="flex flex-col items-center gap-4">
            <div
              role={fog ? "alert" : "status"}
              aria-live={fog ? "assertive" : "polite"}
              className={cn(
                "relative z-10 w-full rounded-[24px] px-5 py-4 text-[0.9375rem] leading-relaxed font-semibold shadow-[0_8px_20px_var(--noggin-shadow)]",
                fog
                  ? "bg-[var(--noggin-cream)] text-[var(--noggin-forest)]"
                  : "bg-[var(--noggin-sage)] text-[var(--noggin-forest)]",
              )}
            >
              {bubble}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45",
                  fog ? "bg-[var(--noggin-cream)]" : "bg-[var(--noggin-sage)]",
                )}
              />
            </div>
            <div className="-mt-[14%] w-full max-w-[240px] shrink-0 lg:max-w-[300px]">
              <NogStage
                scene="room"
                alt={`${nog.name} ready for your question`}
                poster="/nog/blob-closeup.png"
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 300px, 240px"
                className="nog-bob w-full"
              />
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="surface-sage flex flex-col gap-3 rounded-[28px] p-5"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={topicFieldId}
                className="text-[0.8125rem] font-bold text-[var(--noggin-forest)]"
              >
                Topic
              </label>
              <select
                id={topicFieldId}
                value={topicId}
                disabled={waiting || tired}
                onChange={(event) => setTopicId(event.target.value)}
                className="g-select min-h-11 w-full cursor-pointer font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">All topics</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </div>

            <label htmlFor={questionFieldId} className="sr-only">
              Your question
            </label>
            <textarea
              id={questionFieldId}
              ref={textareaRef}
              rows={2}
              value={draft}
              disabled={waiting || tired}
              placeholder={`Ask ${nog.name} anything you've taught…`}
              aria-invalid={tooLong || undefined}
              aria-describedby={tooLong ? `${questionFieldId}-hint` : undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="g-textarea max-h-40 min-h-[4.5rem] w-full resize-none [field-sizing:content] placeholder:text-[var(--noggin-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="flex items-center justify-between gap-3">
              <p
                id={`${questionFieldId}-hint`}
                aria-live="polite"
                className="min-h-5 text-[0.8125rem] font-semibold text-[var(--noggin-danger)]"
              >
                {tooLong ? TOO_LONG_LINE : ""}
              </p>
              <div className="flex items-center gap-2">
                <MicButton
                  mode={micMode}
                  onTranscript={handleTranscript}
                  disabled={waiting || tired}
                />
                <button
                  type="submit"
                  disabled={!canAsk}
                  className="pub-cta-pill inline-flex cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{waiting ? "Thinking…" : "Ask"}</span>
                </button>
              </div>
            </div>
          </form>

          {exchanges.length > 0 && (
            <section aria-labelledby={recentHeadingId} className="surface-white flex flex-col gap-4 rounded-[28px]">
              <h2
                id={recentHeadingId}
                className="noggin-display text-[1.125rem] font-extrabold text-[var(--noggin-forest)]"
              >
                Recent
              </h2>
              <ol className="flex flex-col gap-5">
                {exchanges.map((exchange) => (
                  <li key={exchange.id} className="flex flex-col gap-2">
                    <p className="ml-auto max-w-[85%] rounded-[20px] bg-[var(--noggin-mint-light)] px-4 py-2.5 text-[0.9375rem] text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] [overflow-wrap:anywhere]">
                      {exchange.question}
                    </p>
                    <p className="mr-auto max-w-[85%] rounded-[20px] bg-[var(--noggin-sage)] px-4 py-2.5 text-[0.9375rem] font-semibold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      {exchange.answer}
                    </p>
                    <time
                      dateTime={exchange.createdAt}
                      suppressHydrationWarning
                      className="mr-auto pl-2 text-[0.75rem] text-[var(--noggin-ink)]"
                    >
                      {relativeTime(exchange.createdAt, now)}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
