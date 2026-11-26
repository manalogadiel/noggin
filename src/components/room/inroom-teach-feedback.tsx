"use client";

import { Loader2, MessageCircleQuestion, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestSpeechAudio } from "@/components/voice/voice-client";
import type { DigestOperation, ThoughtCardRecord } from "@/core/application/ports";
import type { CitedCard } from "@/core/application/use-cases/ask-nog";

export type SanctuaryNogMood =
  | "happy"
  | "excited"
  | "proud"
  | "confused"
  | "shocked"
  | "sleepy"
  | "curious";

export type InRoomChatMode = "teach" | "ask";

const VALID_MOODS = new Set<SanctuaryNogMood>([
  "happy",
  "excited",
  "proud",
  "confused",
  "shocked",
  "sleepy",
  "curious",
]);

export const MOOD_LABELS: Record<SanctuaryNogMood, string> = {
  happy: "Happy",
  excited: "Excited",
  proud: "Proud",
  confused: "Confused",
  shocked: "Shocked",
  sleepy: "Sleepy",
  curious: "Curious",
};

export function normalizeNogMood(raw?: string | null): SanctuaryNogMood {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase() as SanctuaryNogMood;
    if (VALID_MOODS.has(normalized)) {
      return normalized;
    }
  }
  return "happy";
}

export interface InRoomModeToggleProps {
  mode: InRoomChatMode;
  onChange: (mode: InRoomChatMode) => void;
  disabled?: boolean;
}

export function InRoomModeToggle({
  mode,
  onChange,
  disabled = false,
}: InRoomModeToggleProps) {
  return (
    <div
      className="inroom-mode-toggle"
      role="group"
      aria-label="In-room chat mode"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={mode === "teach"}
        onClick={() => onChange("teach")}
        className={`inroom-mode-btn ${mode === "teach" ? "is-active" : ""}`}
      >
        Teach
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={mode === "ask"}
        onClick={() => onChange("ask")}
        className={`inroom-mode-btn ${mode === "ask" ? "is-active" : ""}`}
      >
        Ask
      </button>
    </div>
  );
}

export interface InRoomReplySpeakerProps {
  messageId: string | null;
  fallbackText: string;
  voiceEnabled: boolean;
  volume?: number;
}

export function InRoomReplySpeaker({
  messageId,
  fallbackText,
  voiceEnabled,
  volume = 0.9,
}: InRoomReplySpeakerProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stopPlayback = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser TTS cancellation issues.
      }
    }
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback, messageId]);

  if (!voiceEnabled || !messageId) {
    return null;
  }

  const speakWithBrowser = () => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !fallbackText.trim()
    ) {
      setStatus("idle");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(fallbackText);
      utterance.volume = Math.max(0, Math.min(1, volume));
      utterance.onend = () => setStatus("idle");
      utterance.onerror = () => setStatus("idle");
      setStatus("playing");
      window.speechSynthesis.speak(utterance);
    } catch {
      setStatus("idle");
    }
  };

  const handleToggle = async () => {
    if (status !== "idle") {
      stopPlayback();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");

    const res = await requestSpeechAudio({ messageId }, controller.signal);
    if (abortRef.current === controller) {
      abortRef.current = null;
    }
    if (res.status === "aborted") {
      setStatus("idle");
      return;
    }

    if (res.status === "ok" && typeof URL.createObjectURL === "function") {
      try {
        const objectUrl = URL.createObjectURL(res.blob);
        urlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        audio.volume = Math.max(0, Math.min(1, volume));
        audioRef.current = audio;
        audio.onended = () => stopPlayback();
        audio.onerror = () => {
          stopPlayback();
          speakWithBrowser();
        };
        setStatus("playing");
        await audio.play();
        return;
      } catch {
        stopPlayback();
      }
    }

    speakWithBrowser();
  };

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      className="inroom-speaker-btn"
      aria-label={status === "playing" ? "Stop Nog voice" : "Hear Nog reply"}
      title={status === "playing" ? "Stop" : "Hear reply"}
    >
      {status === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : status === "playing" ? (
        <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

export interface InRoomTeachFeedbackProps {
  chatMode: InRoomChatMode;
  topicTitle: string;
  thoughtCards: ReadonlyArray<ThoughtCardRecord>;
  followUpQuestions: ReadonlyArray<string>;
  operations: ReadonlyArray<DigestOperation>;
  offTopic: boolean;
  questionsPendingNotice: string | null;
  citedCards: ReadonlyArray<CitedCard>;
  askUntaught: boolean;
  onResetThread: () => void;
  onClarifyConflict: (cardId: string, label: string) => void;
  onRetryPending: () => void;
  onSwitchToTeach: () => void;
}

function resolveCardLabel(
  cardId: string,
  cards: ReadonlyArray<ThoughtCardRecord>,
): string {
  const match = cards.find((card) => card.id === cardId);
  return match?.label ?? "Memory";
}

export function InRoomTeachFeedback({
  chatMode,
  topicTitle,
  thoughtCards,
  followUpQuestions,
  operations,
  offTopic,
  questionsPendingNotice,
  citedCards,
  askUntaught,
  onResetThread,
  onClarifyConflict,
  onRetryPending,
  onSwitchToTeach,
}: InRoomTeachFeedbackProps) {
  const showFollowUps = chatMode === "teach" && followUpQuestions.length > 0;
  const showOps = chatMode === "teach" && operations.length > 0;
  const showOffTopic = chatMode === "teach" && offTopic;
  const showPending = chatMode === "teach" && Boolean(questionsPendingNotice);
  const showCited = chatMode === "ask" && citedCards.length > 0;
  const showUntaught = chatMode === "ask" && askUntaught;

  if (
    !showFollowUps &&
    !showOps &&
    !showOffTopic &&
    !showPending &&
    !showCited &&
    !showUntaught
  ) {
    return null;
  }

  return (
    <div className="inroom-feedback-stack">
      {showPending && (
        <div className="inroom-notice inroom-notice--honey" role="status">
          <span>{questionsPendingNotice}</span>
          <button
            type="button"
            onClick={onRetryPending}
            className="inroom-chip-action"
          >
            Retry
          </button>
        </div>
      )}

      {showOffTopic && (
        <div className="inroom-notice inroom-notice--honey" role="status">
          <span>
            This doesn&rsquo;t sound like {topicTitle}. Saved as shaky.
          </span>
        </div>
      )}

      {showOps && (
        <div
          className="inroom-feedback-bar"
          aria-label="Thought card updates"
        >
          {operations.map((op, index) => {
            if (op.type === "create") {
              return (
                <span
                  key={`create-${index}-${op.label}`}
                  className="inroom-chip inroom-chip--learned"
                >
                  <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>+ Learned: {op.label}</span>
                </span>
              );
            }
            if (op.type === "reinforce") {
              const label = resolveCardLabel(op.cardId, thoughtCards);
              return (
                <span
                  key={`reinforce-${index}-${op.cardId}`}
                  className="inroom-chip inroom-chip--stronger"
                >
                  <span>Stronger: {label}</span>
                </span>
              );
            }
            if (op.type === "update") {
              const label = op.label ?? resolveCardLabel(op.cardId, thoughtCards);
              return (
                <span
                  key={`update-${index}-${op.cardId}`}
                  className="inroom-chip inroom-chip--updated"
                >
                  <span>Updated: {label}</span>
                </span>
              );
            }
            const conflictLabel = resolveCardLabel(op.cardId, thoughtCards);
            return (
              <span
                key={`conflict-${index}-${op.cardId}`}
                className="inroom-chip inroom-chip--conflict"
              >
                <span>Conflict: {conflictLabel}</span>
                <button
                  type="button"
                  onClick={() => onClarifyConflict(op.cardId, conflictLabel)}
                  className="inroom-chip-action"
                >
                  Clarify
                </button>
              </span>
            );
          })}
        </div>
      )}

      {showFollowUps && (
        <div className="inroom-thread-bar" aria-label="Follow-up thread">
          <div className="inroom-thread-prompts">
            {followUpQuestions.map((question, index) => (
              <span
                key={`fq-${index}-${question}`}
                className="inroom-chip inroom-chip--followup"
              >
                <MessageCircleQuestion
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{question}</span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onResetThread}
            className="inroom-new-note-btn"
          >
            New note
          </button>
        </div>
      )}

      {showCited && (
        <div className="inroom-feedback-bar" aria-label="Cited memories">
          {citedCards.map((card) => (
            <span
              key={card.id}
              className="inroom-chip inroom-chip--cited"
              title={card.quote ?? card.label}
            >
              <strong>{card.label}</strong>
              {card.quote ? (
                <span className="inroom-chip__quote">
                  &ldquo;{card.quote.slice(0, 72)}
                  {card.quote.length > 72 ? "…" : ""}&rdquo;
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}

      {showUntaught && (
        <div className="inroom-notice inroom-notice--mint" role="status">
          <span>Not in my notebook yet — want to teach me?</span>
          <button
            type="button"
            onClick={onSwitchToTeach}
            className="inroom-chip-action"
          >
            Teach this
          </button>
        </div>
      )}
    </div>
  );
}
