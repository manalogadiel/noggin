export const MIC_CONSENT_STORAGE_KEY = "noggin.micConsent";

export type MicConsentValue = "granted" | "declined";

export type TranscribeAudioResult =
  | { status: "ok"; text: string }
  | { status: "tired" }
  | { status: "too_long" }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "aborted" };

export type SpeakAudioResult =
  | { status: "ok"; blob: Blob }
  | { status: "tired" }
  | { status: "unavailable" }
  | { status: "aborted" };

export interface BrowserSpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence?: number;
}

export interface BrowserSpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item?(index: number): BrowserSpeechRecognitionAlternative | undefined;
  readonly [index: number]: BrowserSpeechRecognitionAlternative | undefined;
}

export interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  item?(index: number): BrowserSpeechRecognitionResult | undefined;
  readonly [index: number]: BrowserSpeechRecognitionResult | undefined;
}

export interface BrowserSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type VoiceWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export function readMicConsent(): MicConsentValue | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MIC_CONSENT_STORAGE_KEY);
    if (raw === "granted" || raw === "declined") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeMicConsent(value: MicConsentValue): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(MIC_CONSENT_STORAGE_KEY, value);
  } catch {
    // Storage may be blocked or unavailable; consent will be requested again next time.
  }
}

export function isVoiceRecordingSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const voiceWindow = window as VoiceWindow;
  const ctor =
    voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
  return typeof ctor === "function" ? ctor : null;
}

export function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const voiceWindow = window as VoiceWindow;
  const ctor = voiceWindow.AudioContext ?? voiceWindow.webkitAudioContext;
  return typeof ctor === "function" ? ctor : null;
}

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  if (typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Try next supported MIME type.
    }
  }
  return undefined;
}

function fileExtensionForMime(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/wav") return "wav";
  return "webm";
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError"))
  );
}

export async function transcribeAudio(
  audio: Blob,
  durationSeconds: number,
  signal?: AbortSignal,
): Promise<TranscribeAudioResult> {
  const formData = new FormData();
  const ext = fileExtensionForMime(audio.type || "audio/webm");
  formData.append("audio", audio, `lesson.${ext}`);
  const boundedDuration = Math.min(
    60,
    Math.max(0.5, Number(durationSeconds.toFixed(2))),
  );
  formData.append("durationSeconds", String(boundedDuration));

  let response: Response;
  try {
    response = await fetch("/api/voice/transcribe", {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return { status: "aborted" };
    }
    return { status: "unavailable" };
  }

  if (response.status === 429) {
    return { status: "tired" };
  }
  if (response.status === 413) {
    return { status: "too_long" };
  }
  if (response.status === 401) {
    return { status: "unauthenticated" };
  }
  if (!response.ok) {
    return { status: "unavailable" };
  }

  try {
    const data = (await response.json()) as { text?: unknown };
    if (typeof data.text !== "string") {
      return { status: "unavailable" };
    }
    return { status: "ok", text: data.text.trim() };
  } catch {
    return { status: "unavailable" };
  }
}

export async function requestSpeechAudio(
  payload: { attemptId: string } | { messageId: string },
  signal?: AbortSignal,
): Promise<SpeakAudioResult> {
  let response: Response;
  try {
    response = await fetch("/api/voice/speak", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return { status: "aborted" };
    }
    return { status: "unavailable" };
  }

  if (response.status === 429) {
    return { status: "tired" };
  }
  if (!response.ok) {
    return { status: "unavailable" };
  }

  try {
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      return { status: "unavailable" };
    }
    return { status: "ok", blob };
  } catch {
    return { status: "unavailable" };
  }
}
