"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BrowserSpeechRecognition,
  getAudioContextConstructor,
  getSpeechRecognitionConstructor,
  pickRecorderMimeType,
  transcribeAudio,
} from "./voice-client";
import { STATIC_WAVEFORM_LEVELS, WAVEFORM_BAR_COUNT } from "./waveform";

const MAX_RECORDING_SECONDS = 60;
const MAX_RECORDING_MS = MAX_RECORDING_SECONDS * 1000;
const MIN_RECORDING_MS = 500;
const TIMER_POLL_MS = 250;

export type RecorderPhase = "idle" | "recording" | "transcribing" | "listening";

export interface RecorderFeedback {
  tone: "info" | "error";
  text: string;
}

export interface UseRecorderOptions {
  onTranscript: (text: string) => void;
  reducedMotion: boolean;
  hint?: string;
}

export interface UseRecorderResult {
  phase: RecorderPhase;
  elapsedSeconds: number;
  formattedTime: string;
  levels: ReadonlyArray<number>;
  announcement: string;
  feedback: RecorderFeedback | null;
  setFeedback: (feedback: RecorderFeedback | null) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, Math.min(MAX_RECORDING_SECONDS, Math.floor(totalSeconds)));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sampleLevelsFromAnalyser(analyser: AnalyserNode): number[] {
  const bins = new Uint8Array(analyser.frequencyBinCount || 32);
  analyser.getByteFrequencyData(bins);
  const step = Math.max(1, Math.floor(bins.length / WAVEFORM_BAR_COUNT));
  const nextLevels: number[] = [];
  for (let bar = 0; bar < WAVEFORM_BAR_COUNT; bar += 1) {
    const start = bar * step;
    const end = Math.min(bins.length, start + step);
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      sum += bins[i] ?? 0;
    }
    const avg = end > start ? sum / (end - start) : 0;
    nextLevels.push(Math.max(0.2, Math.min(1, avg / 255)));
  }
  return nextLevels;
}

export function useRecorder({
  onTranscript,
  reducedMotion,
  hint,
}: UseRecorderOptions): UseRecorderResult {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [levels, setLevels] = useState<ReadonlyArray<number>>(STATIC_WAVEFORM_LEVELS);
  const [announcement, setAnnouncement] = useState("");
  const [feedback, setFeedback] = useState<RecorderFeedback | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  const reducedMotionRef = useRef(reducedMotion);
  const hintRef = useRef(hint);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    hintRef.current = hint;
  }, [hint]);

  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoStopTimeoutRef.current !== null) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  }, []);

  const releaseMediaResources = useCallback(() => {
    clearTimers();

    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track teardown errors.
        }
      }
    }

    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      try {
        void context.close();
      } catch {
        // Ignore AudioContext close errors.
      }
    }
  }, [clearTimers]);

  const stopBrowserRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Ignore recognition abort errors.
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      transcribeAbortRef.current?.abort();
      transcribeAbortRef.current = null;
      stopBrowserRecognition();
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        try {
          recorder.stop();
        } catch {
          // Ignore stop errors on unmount.
        }
      }
      releaseMediaResources();
    };
  }, [releaseMediaResources, stopBrowserRecognition]);

  const startBrowserRecognitionFallback = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
      return;
    }

    stopBrowserRecognition();

    let recognition: BrowserSpeechRecognition;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch {
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
      return;
    }

    recognitionRef.current = recognition;
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let capturedTranscript = "";
    let handledError = false;

    recognition.onresult = (event) => {
      const parts: string[] = [];
      const startIndex = Math.max(0, event.resultIndex ?? 0);
      for (let i = startIndex; i < event.results.length; i += 1) {
        const resultItem = event.results[i] ?? event.results.item?.(i);
        if (!resultItem || !resultItem.isFinal) {
          continue;
        }
        const alternative = resultItem[0] ?? resultItem.item?.(0);
        const text = alternative?.transcript?.trim();
        if (text) {
          parts.push(text);
        }
      }
      const joined = parts.join(" ").trim();
      if (joined) {
        capturedTranscript = joined;
        if (mountedRef.current) {
          onTranscriptRef.current(joined);
        }
      }
    };

    recognition.onerror = () => {
      handledError = true;
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      if (!mountedRef.current) {
        return;
      }
      setPhase("idle");
      if (capturedTranscript) {
        setFeedback(null);
      } else if (!handledError) {
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
    };

    setPhase("listening");
    setFeedback({
      tone: "info",
      text: "Trying your browser's listener…",
    });

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
    }
  }, [stopBrowserRecognition]);

  const handleStoppedRecording = useCallback(
    async (mimeType: string) => {
      const durationMs = Math.max(0, Date.now() - startedAtRef.current);
      const chunks = chunksRef.current;
      chunksRef.current = [];
      mediaRecorderRef.current = null;
      releaseMediaResources();

      if (!mountedRef.current) {
        return;
      }

      setAnnouncement("Recording stopped");

      if (durationMs < MIN_RECORDING_MS) {
        setPhase("idle");
        setElapsedSeconds(0);
        setFeedback({
          tone: "info",
          text: "Too short — hold a little longer",
        });
        return;
      }

      const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
      if (blob.size === 0) {
        setPhase("idle");
        setElapsedSeconds(0);
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
        return;
      }

      setPhase("transcribing");
      setFeedback(null);

      const controller = new AbortController();
      transcribeAbortRef.current = controller;

      const result = await transcribeAudio(
        blob,
        durationMs / 1000,
        controller.signal,
        hintRef.current,
      );

      if (transcribeAbortRef.current === controller) {
        transcribeAbortRef.current = null;
      }

      if (!mountedRef.current || result.status === "aborted") {
        return;
      }

      if (result.status === "ok") {
        setPhase("idle");
        setElapsedSeconds(0);
        if (result.text.length > 0) {
          onTranscriptRef.current(result.text);
          setFeedback(null);
        } else {
          setFeedback({
            tone: "error",
            text: "Couldn't hear that — type it instead",
          });
        }
        return;
      }

      if (result.status === "tired") {
        setPhase("idle");
        setElapsedSeconds(0);
        setFeedback({
          tone: "error",
          text: "Your Nog's ears are tired for today — type it instead",
        });
        return;
      }

      if (result.status === "too_long") {
        setPhase("idle");
        setElapsedSeconds(0);
        setFeedback({
          tone: "error",
          text: "That was too long — keep it under a minute",
        });
        return;
      }

      startBrowserRecognitionFallback();
    },
    [releaseMediaResources, startBrowserRecognitionFallback],
  );

  const stopRecording = useCallback(() => {
    if (startingRef.current) {
      pendingStopRef.current = true;
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      clearTimers();
      try {
        recorder.stop();
      } catch {
        releaseMediaResources();
        setPhase("idle");
      }
      return;
    }

    if (recognitionRef.current) {
      stopBrowserRecognition();
      setPhase("idle");
    }
  }, [clearTimers, releaseMediaResources, stopBrowserRecognition]);

  const startRecording = useCallback(async () => {
    if (startingRef.current || mediaRecorderRef.current) {
      return;
    }

    stopBrowserRecognition();
    transcribeAbortRef.current?.abort();
    transcribeAbortRef.current = null;

    startingRef.current = true;
    pendingStopRef.current = false;
    setFeedback(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      pendingStopRef.current = false;
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Mic is blocked — you can type instead",
        });
      }
      return;
    }

    startingRef.current = false;

    if (!mountedRef.current || pendingStopRef.current) {
      pendingStopRef.current = false;
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors.
        }
      }
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "info",
          text: "Too short — hold a little longer",
        });
      }
      return;
    }

    mediaStreamRef.current = stream;

    const AudioContextCtor = getAudioContextConstructor();
    if (AudioContextCtor) {
      try {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        if (!reducedMotionRef.current) {
          setLevels(sampleLevelsFromAnalyser(analyser));
        }
      } catch {
        // Waveform falls back to static levels if Web Audio is unavailable.
      }
    }

    const preferredMime = pickRecorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
    } catch {
      releaseMediaResources();
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
      return;
    }

    chunksRef.current = [];
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || preferredMime || "audio/webm";
      void handleStoppedRecording(mimeType);
    };

    recorder.onerror = () => {
      mediaRecorderRef.current = null;
      releaseMediaResources();
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
    };

    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setPhase("recording");
    setAnnouncement("Recording started");

    try {
      recorder.start();
    } catch {
      mediaRecorderRef.current = null;
      releaseMediaResources();
      if (mountedRef.current) {
        setPhase("idle");
        setFeedback({
          tone: "error",
          text: "Couldn't hear that — type it instead",
        });
      }
      return;
    }

    timerIntervalRef.current = window.setInterval(() => {
      const seconds = Math.min(
        MAX_RECORDING_SECONDS,
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
      setElapsedSeconds(seconds);
      if (!reducedMotionRef.current && analyserRef.current) {
        setLevels(sampleLevelsFromAnalyser(analyserRef.current));
      }
    }, TIMER_POLL_MS);

    autoStopTimeoutRef.current = window.setTimeout(() => {
      setElapsedSeconds(MAX_RECORDING_SECONDS);
      stopRecording();
    }, MAX_RECORDING_MS);
  }, [
    handleStoppedRecording,
    releaseMediaResources,
    stopBrowserRecognition,
    stopRecording,
  ]);

  return {
    phase,
    elapsedSeconds,
    formattedTime: formatTimer(elapsedSeconds),
    levels,
    announcement,
    feedback,
    setFeedback,
    startRecording,
    stopRecording,
  };
}
