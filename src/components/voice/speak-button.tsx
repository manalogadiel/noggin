"use client";

import { Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { requestSpeechAudio } from "./voice-client";

export interface SpeakButtonProps {
  attemptId?: string;
  messageId?: string;
  text: string;
  nogName: string;
}

type SpeakState = "idle" | "loading" | "playing";

export function SpeakButton({
  attemptId,
  messageId,
  text,
  nogName,
}: SpeakButtonProps) {
  const [state, setState] = useState<SpeakState>("idle");
  const [unavailable, setUnavailable] = useState(false);

  const mountedRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const usingSynthesisRef = useRef(false);

  const revokeActiveUrl = useCallback(() => {
    const url = objectUrlRef.current;
    objectUrlRef.current = null;
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore URL revocation errors.
      }
    }
  }, []);

  const stopPlayback = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        // Ignore pause errors.
      }
    }
    revokeActiveUrl();

    if (usingSynthesisRef.current) {
      usingSynthesisRef.current = false;
      if (typeof window !== "undefined" && typeof window.speechSynthesis?.cancel === "function") {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore speechSynthesis cancel errors.
        }
      }
    }

    if (mountedRef.current) {
      setState("idle");
    }
  }, [revokeActiveUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPlayback();
    };
  }, [stopPlayback]);

  const speakWithBrowserFallback = useCallback(
    (content: string) => {
      const canSynthesize =
        typeof window !== "undefined" &&
        typeof window.speechSynthesis !== "undefined" &&
        typeof window.speechSynthesis.speak === "function" &&
        typeof SpeechSynthesisUtterance !== "undefined";

      if (!canSynthesize) {
        if (mountedRef.current) {
          setState("idle");
          setUnavailable(true);
        }
        return;
      }

      try {
        window.speechSynthesis.cancel?.();
        const utterance = new SpeechSynthesisUtterance(content);
        usingSynthesisRef.current = true;
        utterance.onend = () => {
          usingSynthesisRef.current = false;
          if (mountedRef.current) {
            setState("idle");
          }
        };
        utterance.onerror = () => {
          usingSynthesisRef.current = false;
          if (mountedRef.current) {
            setState("idle");
            setUnavailable(true);
          }
        };
        if (mountedRef.current) {
          setUnavailable(false);
          setState("playing");
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        usingSynthesisRef.current = false;
        if (mountedRef.current) {
          setState("idle");
          setUnavailable(true);
        }
      }
    },
    [],
  );

  async function handleClick() {
    if (state === "playing" || state === "loading") {
      stopPlayback();
      return;
    }

    const spokenText = text.trim();
    if (!spokenText) {
      setUnavailable(true);
      return;
    }

    setUnavailable(false);
    setState("loading");

    const payload = attemptId
      ? { attemptId }
      : messageId
        ? { messageId }
        : null;

    if (!payload) {
      speakWithBrowserFallback(spokenText);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const result = await requestSpeechAudio(payload, controller.signal);

    if (abortControllerRef.current === controller) {
      abortControllerRef.current = null;
    }

    if (!mountedRef.current || result.status === "aborted") {
      return;
    }

    if (result.status !== "ok") {
      speakWithBrowserFallback(spokenText);
      return;
    }

    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(result.blob);
    } catch {
      speakWithBrowserFallback(spokenText);
      return;
    }

    objectUrlRef.current = objectUrl;
    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      revokeActiveUrl();
      if (mountedRef.current) {
        setState("idle");
      }
    };

    audio.onerror = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      revokeActiveUrl();
      speakWithBrowserFallback(spokenText);
    };

    try {
      await audio.play();
      if (mountedRef.current && audioRef.current === audio) {
        setState("playing");
      }
    } catch {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      revokeActiveUrl();
      speakWithBrowserFallback(spokenText);
    }
  }

  const isPlaying = state === "playing";
  const isLoading = state === "loading";
  const label = isPlaying ? "Stop" : `Hear ${nogName}'s answer`;

  return (
    <div className="inline-flex items-center gap-2">
      {unavailable && (
        <span
          role="status"
          className="text-[0.75rem] font-semibold text-[var(--noggin-ink)]"
        >
          Voice unavailable
        </span>
      )}

      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label={label}
        title={label}
        aria-pressed={isPlaying}
        className={cn(
          "inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors duration-150 motion-reduce:transition-none",
          isPlaying
            ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)]"
            : "bg-[var(--noggin-mint)] text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint-light)]",
          isLoading && "opacity-75",
        )}
      >
        {isPlaying ? (
          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
