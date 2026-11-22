"use client";

import { Mic, Square } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { MicMode } from "@/core/application/ports";
import { cn } from "@/lib/utils";
import { ConsentDialog } from "./consent-dialog";
import { useRecorder } from "./use-recorder";
import {
  isVoiceRecordingSupported,
  readMicConsent,
  writeMicConsent,
} from "./voice-client";
import { Waveform } from "./waveform";

function subscribeNoop(): () => void {
  return () => {};
}

function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface MicButtonProps {
  mode: MicMode | "push_to_talk";
  onTranscript: (text: string) => void;
  disabled?: boolean;
  declineFocusRef?: RefObject<HTMLElement | null>;
  hint?: string;
}

export function MicButton({
  mode,
  onTranscript,
  disabled = false,
  declineFocusRef,
  hint,
}: MicButtonProps) {
  const normalizedMode: MicMode =
    mode === "hold" || mode === "push_to_talk" ? "hold" : "tap";

  const supported = useSyncExternalStore(
    subscribeNoop,
    isVoiceRecordingSupported,
    () => false,
  );

  const [reducedMotion, setReducedMotion] = useState<boolean>(detectReducedMotion);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      setReducedMotion(query.matches);
    };
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  const {
    phase,
    formattedTime,
    levels,
    announcement,
    feedback,
    setFeedback,
    startRecording,
    stopRecording,
  } = useRecorder({
    onTranscript,
    reducedMotion,
    hint,
  });

  function ensureConsentThenStart(): boolean {
    if (disabled || !supported) {
      return false;
    }
    if (readMicConsent() !== "granted") {
      setConsentOpen(true);
      return false;
    }
    void startRecording();
    return true;
  }

  function handleAllowConsent() {
    writeMicConsent("granted");
    setConsentOpen(false);
    setFeedback(null);
    if (normalizedMode === "tap") {
      void startRecording();
    }
  }

  function handleDeclineConsent() {
    writeMicConsent("declined");
    setConsentOpen(false);
    setFeedback({
      tone: "info",
      text: "Typing works great too!",
    });
    declineFocusRef?.current?.focus();
  }

  function handleHoldPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || !supported || phase === "transcribing") {
      return;
    }
    if (event.button !== undefined && event.button !== 0 && event.pointerType === "mouse") {
      return;
    }
    if (ensureConsentThenStart()) {
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Ignore pointer capture errors when unsupported.
      }
    }
  }

  function handleHoldPointerEnd() {
    if (phase === "recording") {
      stopRecording();
    }
  }

  function handleHoldKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (event.repeat || disabled || !supported || phase === "transcribing") {
      return;
    }
    ensureConsentThenStart();
  }

  function handleHoldKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (phase === "recording") {
      stopRecording();
    }
  }

  if (!supported) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          disabled
          title="Voice isn't supported in this browser"
          aria-label="Voice input"
          className="inline-flex h-12 w-12 min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-ink)] opacity-60 shadow-[0_6px_14px_var(--noggin-shadow)]"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const isBusy = phase === "transcribing" || phase === "listening";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {phase === "transcribing" ? (
        <div
          role="status"
          className="inline-flex min-h-12 items-center gap-2.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 py-2 text-[0.875rem] font-semibold text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)]"
        >
          <span>Transcribing…</span>
          <span aria-hidden="true" className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--noggin-leaf-strong)] motion-safe:animate-bounce motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--noggin-leaf-strong)] [animation-delay:120ms] motion-safe:animate-bounce motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--noggin-leaf-strong)] [animation-delay:240ms] motion-safe:animate-bounce motion-reduce:animate-none" />
          </span>
        </div>
      ) : normalizedMode === "hold" ? (
        <button
          type="button"
          disabled={disabled || isBusy}
          aria-label="Hold to talk"
          aria-pressed={phase === "recording"}
          onPointerDown={handleHoldPointerDown}
          onPointerUp={handleHoldPointerEnd}
          onPointerLeave={handleHoldPointerEnd}
          onPointerCancel={handleHoldPointerEnd}
          onKeyDown={handleHoldKeyDown}
          onKeyUp={handleHoldKeyUp}
          className={cn(
            "noggin-display inline-flex min-h-12 cursor-pointer touch-none select-none items-center justify-center gap-2.5 rounded-[var(--noggin-radius-pill)] px-4 py-2 text-[0.875rem] font-bold shadow-[0_6px_14px_var(--noggin-shadow)] transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60",
            phase === "recording"
              ? "bg-[var(--noggin-danger)] text-[var(--noggin-white)]"
              : "bg-[var(--noggin-white)] text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
          )}
        >
          {phase === "recording" ? (
            <>
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--noggin-white)] motion-safe:animate-pulse motion-reduce:animate-none"
              />
              <span>Recording</span>
              <Waveform levels={levels} reducedMotion={reducedMotion} />
              <span aria-live="off" className="tabular-nums">
                {formattedTime}
              </span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Hold to talk</span>
            </>
          )}
        </button>
      ) : phase === "recording" ? (
        <div className="inline-flex min-h-12 flex-wrap items-center gap-2.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-danger)] py-1.5 pr-1.5 pl-4 text-[0.875rem] font-bold text-[var(--noggin-white)] shadow-[0_8px_18px_var(--noggin-shadow)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--noggin-white)] motion-safe:animate-pulse motion-reduce:animate-none"
          />
          <span className="noggin-display">Recording</span>
          <Waveform levels={levels} reducedMotion={reducedMotion} />
          <span aria-live="off" className="tabular-nums">
            {formattedTime}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-danger)] shadow-[0_2px_8px_var(--noggin-shadow)] transition-transform duration-150 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || isBusy}
          onClick={() => {
            ensureConsentThenStart();
          }}
          aria-label="Record voice lesson"
          title="Record voice lesson"
          className="inline-flex h-12 w-12 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "text-right text-[0.8125rem] font-semibold",
            feedback.tone === "error"
              ? "text-[var(--noggin-danger)]"
              : "text-[var(--noggin-forest)]",
          )}
        >
          {feedback.text}
        </p>
      )}

      <ConsentDialog
        open={consentOpen}
        onAllow={handleAllowConsent}
        onDecline={handleDeclineConsent}
        declineFocusRef={declineFocusRef}
      />
    </div>
  );
}
