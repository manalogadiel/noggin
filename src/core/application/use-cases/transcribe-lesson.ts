import type {
  CurrentUser,
  SpeechToText,
  TranscribeInput,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 60;

export interface TranscribeLessonDeps {
  currentUser: CurrentUser;
  usage: UsageRepository;
  speechToText: SpeechToText;
}

export type TranscribeLessonResult =
  | { status: "unauthenticated" }
  | { status: "invalid_audio" }
  | { status: "payload_too_large" }
  | { status: "tired_for_today" }
  | { status: "provider_error" }
  | { status: "ok"; text: string };

export async function transcribeLesson(
  deps: TranscribeLessonDeps,
  input: TranscribeInput,
): Promise<TranscribeLessonResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  if (
    input.audio.byteLength === 0 ||
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0
  ) {
    return { status: "invalid_audio" };
  }

  if (
    input.audio.byteLength > MAX_AUDIO_BYTES ||
    input.durationSeconds > MAX_AUDIO_DURATION_SECONDS
  ) {
    return { status: "payload_too_large" };
  }

  const billableSeconds = Math.ceil(input.durationSeconds);
  const entitlement = new EntitlementService(deps.usage);
  const quota = await entitlement.consume(
    user.id,
    "stt_seconds",
    billableSeconds,
  );
  if (!quota.allowed) {
    return { status: "tired_for_today" };
  }

  try {
    const result = await deps.speechToText.transcribe(input);
    return { status: "ok", text: result.text };
  } catch {
    return { status: "provider_error" };
  }
}
