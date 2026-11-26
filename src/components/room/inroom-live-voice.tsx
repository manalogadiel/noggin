"use client";

import { Mic, MicOff, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type InRoomChatMode,
  InRoomModeToggle,
  type SanctuaryNogMood,
} from "@/components/room/inroom-teach-feedback";
import { ConsentDialog } from "@/components/voice/consent-dialog";
import { useRecorder } from "@/components/voice/use-recorder";
import {
  isVoiceRecordingSupported,
  readMicConsent,
  requestSpeechAudio,
  writeMicConsent,
} from "@/components/voice/voice-client";
import { Waveform } from "@/components/voice/waveform";
import type { CompanionVoice } from "@/core/application/ports";

export interface LiveVoiceReplyOutcome {
  reply: string;
  mood: SanctuaryNogMood;
  replyMessageId: string | null;
  followUpMessageIds: string[];
  followUpText: string | null;
}

export interface InRoomLiveVoiceProps {
  nogName: string;
  topicTitle: string;
  chatMode: InRoomChatMode;
  voiceEnabled: boolean;
  voiceName?: CompanionVoice;
  voiceVolume: number;
  sending: boolean;
  onChangeMode: (mode: InRoomChatMode) => void;
  onSubmitTranscript: (text: string) => Promise<LiveVoiceReplyOutcome | null>;
  onCaptionChange: (caption: string | null) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onExitToFeed: (feedbackMessage?: string) => void;
}

export function InRoomLiveVoice({
  nogName,
  topicTitle,
  chatMode,
  voiceEnabled,
  voiceName = "Puck",
  voiceVolume,
  sending,
  onChangeMode,
  onSubmitTranscript,
  onCaptionChange,
  onSpeakingChange,
  onExitToFeed,
}: InRoomLiveVoiceProps) {
  const [consentOpen, setConsentOpen] = useState(
    () => readMicConsent() !== "granted",
  );
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const speakAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const speechGenRef = useRef(0);
  const resumeTimerRef = useRef<number | null>(null);
  const onSpeakingChangeRef = useRef(onSpeakingChange);

  useEffect(() => {
    onSpeakingChangeRef.current = onSpeakingChange;
  }, [onSpeakingChange]);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const stopSpeechPlayback = useCallback(() => {
    clearResumeTimer();
    speechGenRef.current += 1;
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser TTS cancellation errors.
      }
    }
    if (mountedRef.current) {
      setSpeaking(false);
    }
    onSpeakingChangeRef.current?.(false);
  }, [clearResumeTimer]);

  const speakWithBrowserFallback = useCallback(
    (text: string, gen: number): Promise<void> => {
      return new Promise((resolve) => {
        if (
          !mountedRef.current ||
          mutedRef.current ||
          speechGenRef.current !== gen ||
          typeof window === "undefined" ||
          !("speechSynthesis" in window) ||
          !text.trim()
        ) {
          resolve();
          return;
        }
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.volume = Math.max(0, Math.min(1, voiceVolume));
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        } catch {
          resolve();
        }
      });
    },
    [voiceVolume],
  );

  const speakSavedOrFallback = useCallback(
    async (
      messageId: string | null,
      fallbackText: string,
      gen: number,
    ): Promise<void> => {
      if (
        !mountedRef.current ||
        mutedRef.current ||
        speechGenRef.current !== gen
      ) {
        return;
      }

      if (messageId) {
        const controller = new AbortController();
        speakAbortRef.current = controller;
        const payload =
          voiceName && voiceName !== "Puck"
            ? { messageId, voice: voiceName }
            : { messageId };
        const result = await requestSpeechAudio(payload, controller.signal);
        if (speakAbortRef.current === controller) {
          speakAbortRef.current = null;
        }
        if (
          result.status === "aborted" ||
          !mountedRef.current ||
          mutedRef.current ||
          speechGenRef.current !== gen
        ) {
          return;
        }

        if (result.status === "ok" && typeof URL.createObjectURL === "function") {
          const played = await new Promise<boolean>((resolve) => {
            try {
              const url = URL.createObjectURL(result.blob);
              objectUrlRef.current = url;
              const audio = new Audio(url);
              audio.volume = Math.max(0, Math.min(1, voiceVolume));
              audioRef.current = audio;

              const cleanup = (ok: boolean) => {
                if (audioRef.current === audio) {
                  audioRef.current = null;
                }
                if (objectUrlRef.current === url) {
                  URL.revokeObjectURL(url);
                  objectUrlRef.current = null;
                }
                resolve(ok);
              };

              audio.onended = () => cleanup(true);
              audio.onerror = () => cleanup(false);
              const playPromise = audio.play();
              if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch(() => cleanup(false));
              }
            } catch {
              resolve(false);
            }
          });

          if (played) {
            return;
          }
        }
      }

      await speakWithBrowserFallback(fallbackText, gen);
    },
    [speakWithBrowserFallback, voiceName, voiceVolume],
  );

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const cleaned = transcript.trim();
      if (!cleaned || !mountedRef.current) {
        return;
      }

      onCaptionChange(
        chatMode === "ask"
          ? `Checking notes for "${cleaned}"…`
          : `Thinking about what you said…`,
      );

      const outcome = await onSubmitTranscript(cleaned);
      if (!mountedRef.current || !outcome) {
        return;
      }

      const fullCaption = outcome.followUpText
        ? `${outcome.reply} ${outcome.followUpText}`
        : outcome.reply;
      onCaptionChange(fullCaption);

      if (!voiceEnabled || mutedRef.current) {
        return;
      }

      stopSpeechPlayback();
      const gen = speechGenRef.current;
      setSpeaking(true);
      onSpeakingChangeRef.current?.(true);
      try {
        await speakSavedOrFallback(outcome.replyMessageId, outcome.reply, gen);
        if (
          mountedRef.current &&
          !mutedRef.current &&
          speechGenRef.current === gen &&
          (outcome.followUpMessageIds[0] || outcome.followUpText)
        ) {
          await speakSavedOrFallback(
            outcome.followUpMessageIds[0] ?? null,
            outcome.followUpText ?? "",
            gen,
          );
        }
      } finally {
        if (mountedRef.current && speechGenRef.current === gen) {
          setSpeaking(false);
          onSpeakingChangeRef.current?.(false);
          if (!mutedRef.current && isVoiceRecordingSupported()) {
            clearResumeTimer();
            resumeTimerRef.current = window.setTimeout(() => {
              resumeTimerRef.current = null;
              if (
                mountedRef.current &&
                !mutedRef.current &&
                speechGenRef.current === gen
              ) {
                void startRecordingRef.current();
              }
            }, 450);
          }
        }
      }
    },
    [
      chatMode,
      clearResumeTimer,
      onCaptionChange,
      onSubmitTranscript,
      speakSavedOrFallback,
      stopSpeechPlayback,
      voiceEnabled,
    ],
  );

  const recorder = useRecorder({
    onTranscript: (text) => {
      void handleTranscript(text);
    },
    reducedMotion,
    hint: topicTitle,
    autoStopOnSilenceMs: 1600,
  });

  const startRecordingRef = useRef(recorder.startRecording);
  const cancelRecordingRef = useRef(recorder.cancelRecording);
  useEffect(() => {
    startRecordingRef.current = recorder.startRecording;
    cancelRecordingRef.current = recorder.cancelRecording;
  }, [recorder.cancelRecording, recorder.startRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRecordingRef.current();
      stopSpeechPlayback();
    };
  }, [stopSpeechPlayback]);

  // Auto-start recording when consent is already granted
  useEffect(() => {
    if (consentOpen || muted) {
      return;
    }
    if (!isVoiceRecordingSupported()) {
      onCaptionChange("Your browser doesn't support recording — try typing in Feed!");
      return;
    }
    void startRecordingRef.current();
  }, [consentOpen, muted, onCaptionChange]);

  useEffect(() => {
    if (recorder.phase === "transcribing") {
      onCaptionChange("Transcribing…");
    } else if (recorder.phase === "recording") {
      onCaptionChange(
        chatMode === "ask"
          ? `Listening… ask ${nogName} anything!`
          : `Listening… explain ${topicTitle} to ${nogName}!`,
      );
    } else if (recorder.feedback?.text) {
      onCaptionChange(recorder.feedback.text);
    }
  }, [
    chatMode,
    nogName,
    onCaptionChange,
    recorder.feedback?.text,
    recorder.phase,
    topicTitle,
  ]);

  const handleAllowMic = () => {
    writeMicConsent("granted");
    setConsentOpen(false);
  };

  const handleDeclineMic = () => {
    writeMicConsent("declined");
    setConsentOpen(false);
    recorder.cancelRecording();
    stopSpeechPlayback();
    onExitToFeed("Typing works great too!");
  };

  const handleToggleMute = () => {
    if (!muted) {
      mutedRef.current = true;
      setMuted(true);
      recorder.cancelRecording();
      stopSpeechPlayback();
      onCaptionChange("Mic muted — tap Unmute whenever you're ready!");
    } else {
      mutedRef.current = false;
      setMuted(false);
    }
  };

  const handleEndLive = () => {
    recorder.cancelRecording();
    stopSpeechPlayback();
    onExitToFeed();
  };

  const isRecording = recorder.phase === "recording";
  const isTranscribing = recorder.phase === "transcribing";

  return (
    <>
      <ConsentDialog
        open={consentOpen}
        onAllow={handleAllowMic}
        onDecline={handleDeclineMic}
      />

      <div className="live-voice-hud" aria-label="Live Voice Mode">
        <InRoomModeToggle
          mode={chatMode}
          onChange={onChangeMode}
          disabled={isTranscribing || sending}
        />

        <div
          className={`live-orb-wrap ${muted ? "is-muted" : ""}`}
          data-voice-phase={recorder.phase}
        >
          <span className="live-orb-ring" aria-hidden="true" />
          <Waveform
            levels={recorder.levels}
            reducedMotion={reducedMotion || muted || !isRecording}
          />
        </div>

        <div className="live-voice-timer tnum" role="status" aria-live="polite">
          {isTranscribing
            ? "Transcribing…"
            : sending
              ? "Thinking…"
              : speaking
                ? "Speaking…"
                : isRecording
                  ? `Recording ${recorder.formattedTime}`
                  : muted
                    ? "Muted"
                    : "Ready"}
        </div>

        <div className="live-voice-actions">
          {!muted && isRecording && (
            <button
              type="button"
              onClick={() => recorder.stopRecording()}
              className="gbtn gbtn--leaf gbtn--sm"
              aria-label="Stop and send voice"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Send</span>
            </button>
          )}

          {!muted && !isRecording && !isTranscribing && !sending && (
            <button
              type="button"
              onClick={() => {
                stopSpeechPlayback();
                void recorder.startRecording();
              }}
              className="gbtn gbtn--leaf gbtn--sm"
              aria-label="Start speaking"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Speak</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            className="gbtn gbtn--white gbtn--sm"
          >
            {muted ? (
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{muted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            type="button"
            onClick={handleEndLive}
            className="live-end-btn"
            aria-label="End Live Voice"
          >
            End Live
          </button>
        </div>
      </div>
    </>
  );
}
