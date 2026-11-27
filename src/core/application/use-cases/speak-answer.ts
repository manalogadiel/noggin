import type {
  AttemptRepository,
  CompanionVoice,
  CurrentUser,
  NotebookRepository,
  SynthesizedAudio,
  TextToSpeech,
  UsageRepository,
  VoiceCacheRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SpeakSource = "nog_message" | "check_attempt";

export interface SpeakAnswerDeps {
  currentUser: CurrentUser;
  notebook: Pick<NotebookRepository, "findOwnedMessage">;
  attempts: Pick<AttemptRepository, "findOwned">;
  voiceCache: VoiceCacheRepository;
  usage: UsageRepository;
  textToSpeech: TextToSpeech;
}

export interface SpeakAnswerInput {
  source: SpeakSource;
  id: string;
  voice?: CompanionVoice;
}

export type SpeakAnswerResult =
  | { status: "unauthenticated" }
  | { status: "invalid_id" }
  | { status: "not_found" }
  | { status: "tired_for_today" }
  | { status: "provider_error" }
  | ({ status: "ok"; cached: boolean } & SynthesizedAudio);

function hashVoiceText(text: string): string {
  // Deterministic 64-bit FNV-1a pair for collision-resistant pure-TS cache keys
  let h1 = BigInt("0xcbf29ce484222325");
  let h2 = BigInt("0x84222325cbf29ce4");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < text.length; i += 1) {
    const code = BigInt(text.charCodeAt(i));
    h1 = ((h1 ^ code) * prime) & mask;
    h2 = ((h2 ^ (code + BigInt(i + 1))) * prime) & mask;
  }
  return `${h1.toString(16).padStart(16, "0")}${h2.toString(16).padStart(16, "0")}`;
}

export async function speakAnswer(
  deps: SpeakAnswerDeps,
  input: SpeakAnswerInput,
): Promise<SpeakAnswerResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  if (!UUID_REGEX.test(input.id)) {
    return { status: "invalid_id" };
  }

  let text: string | null = null;
  if (input.source === "nog_message") {
    const message = await deps.notebook.findOwnedMessage(user.id, input.id);
    if (!message || message.role !== "nog") {
      return { status: "not_found" };
    }
    text = message.body;
  } else if (input.source === "check_attempt") {
    const attempt = await deps.attempts.findOwned(user.id, input.id);
    if (!attempt) {
      return { status: "not_found" };
    }
    text = attempt.nogAnswer;
  } else {
    return { status: "not_found" };
  }

  if (text.trim().length === 0) {
    return { status: "not_found" };
  }

  const cacheKey = hashVoiceText(input.voice ? `${input.voice}:${text}` : text);
  const cached = await deps.voiceCache.get(cacheKey);
  if (cached) {
    return { status: "ok", cached: true, ...cached };
  }

  const entitlement = new EntitlementService(deps.usage);
  const quota = await entitlement.consume(user.id, "tts_chars", text.length);
  if (!quota.allowed) {
    return { status: "tired_for_today" };
  }

  let synthesized: SynthesizedAudio;
  try {
    synthesized = await deps.textToSpeech.speak(
      input.voice ? { text, voice: input.voice } : { text },
    );
  } catch {
    return { status: "provider_error" };
  }

  await deps.voiceCache.put(cacheKey, synthesized);
  return { status: "ok", cached: false, ...synthesized };
}
