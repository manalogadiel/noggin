import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLlmAdapters, type NogPersona } from "@/adapters/ai/fallback-llm";
import { createSupabaseCurrentUser } from "@/adapters/supabase/current-user";
import {
  createSupabaseRepositories,
  type SupabaseRepositories,
} from "@/adapters/supabase/repositories";
import { createProfileRepository } from "@/adapters/supabase/repositories/profile-repository";
import { createServerSupabaseClient } from "@/adapters/supabase/server-client";
import { createServiceSupabaseClient } from "@/adapters/supabase/service-client";
import { createGeminiTts } from "@/adapters/voice/gemini-tts";
import { createGroqWhisperStt } from "@/adapters/voice/groq-whisper-stt";
import {
  computeVoiceCacheHash,
  createSupabaseVoiceCache,
} from "@/adapters/voice/voice-cache-repository";
import {
  createWhisperCppStt,
  isWhisperCppFallbackEnabled,
} from "@/adapters/voice/whisper-cpp-stt";
import type {
  AttemptRepository,
  Clock,
  CurrentUser,
  NogRecord,
  NotebookRepository,
  ProfileRepository,
  ProfileSettings,
  QuestionWriter,
  SpeechToText,
  TextToSpeech,
  TranscribeInput,
  VoiceCacheRepository,
} from "@/core/application/ports";
import {
  addTopic,
  type AddTopicInput,
  type AddTopicResult,
} from "@/core/application/use-cases/add-topic";
import {
  answerFollowUp,
  type AnswerFollowUpInput,
  type AnswerFollowUpResult,
} from "@/core/application/use-cases/answer-follow-up";
import {
  getNogAnalysis,
  type GetNogAnalysisInput,
  type GetNogAnalysisResult,
} from "@/core/application/use-cases/get-nog-analysis";
import {
  getNogRoom,
  type GetNogRoomInput,
  type GetNogRoomResult,
} from "@/core/application/use-cases/get-nog-room";
import {
  getProfileSettings,
  type GetProfileSettingsResult,
} from "@/core/application/use-cases/get-profile-settings";
import {
  getTopicNotebook,
  type GetTopicNotebookInput,
  type GetTopicNotebookResult,
} from "@/core/application/use-cases/get-topic-notebook";
import {
  hatchNog,
  type HatchNogInput,
  type HatchNogResult,
} from "@/core/application/use-cases/hatch-nog";
import {
  listNogs,
  type ListNogsResult,
} from "@/core/application/use-cases/list-nogs";
import {
  listTopics,
  type ListTopicsInput,
  type ListTopicsResult,
} from "@/core/application/use-cases/list-topics";
import {
  petNog,
  type PetNogInput,
  type PetNogResult,
} from "@/core/application/use-cases/pet-nog";
import {
  reviseLesson,
  type ReviseLessonInput,
  type ReviseLessonResult,
} from "@/core/application/use-cases/revise-lesson";
import {
  runQuickCheck,
  type RunQuickCheckInput,
  type RunQuickCheckResult,
} from "@/core/application/use-cases/run-quick-check";
import {
  speakAnswer,
  type SpeakAnswerInput,
  type SpeakAnswerResult,
} from "@/core/application/use-cases/speak-answer";
import {
  teachLesson,
  type TeachLessonInput,
  type TeachLessonResult,
} from "@/core/application/use-cases/teach-lesson";
import {
  transcribeLesson,
  type TranscribeLessonResult,
} from "@/core/application/use-cases/transcribe-lesson";
import {
  updateProfileSettings,
  type UpdateProfileSettingsResult,
} from "@/core/application/use-cases/update-profile-settings";

const ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LLM_PROVIDER",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_FALLBACK_BASE_URL",
  "LLM_FALLBACK_API_KEY",
  "LLM_FALLBACK_MODEL",
] as const;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

const optionalHttpUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().refine(isHttpUrl).optional());

const llmProviderSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.enum(["fake", "openai-compatible"]).optional());

const containerEnvSchema = z
  .object({
    NODE_ENV: optionalTrimmedString.default("development"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().trim().min(1).refine(isHttpUrl),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
    LLM_PROVIDER: llmProviderSchema,
    LLM_BASE_URL: optionalHttpUrl,
    LLM_API_KEY: optionalTrimmedString,
    LLM_MODEL: optionalTrimmedString,
    LLM_FALLBACK_BASE_URL: optionalHttpUrl,
    LLM_FALLBACK_API_KEY: optionalTrimmedString,
    LLM_FALLBACK_MODEL: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (data.LLM_PROVIDER === "fake" && data.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["LLM_PROVIDER"],
        message: "fake_in_production",
      });
    }

    if (data.LLM_PROVIDER !== "fake") {
      if (!data.LLM_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["LLM_BASE_URL"],
          message: "required",
        });
      }
      if (!data.LLM_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["LLM_API_KEY"],
          message: "required",
        });
      }
      if (!data.LLM_MODEL) {
        ctx.addIssue({
          code: "custom",
          path: ["LLM_MODEL"],
          message: "required",
        });
      }
    }

    if (Boolean(data.LLM_FALLBACK_BASE_URL) !== Boolean(data.LLM_FALLBACK_MODEL)) {
      ctx.addIssue({
        code: "custom",
        path: [
          data.LLM_FALLBACK_BASE_URL
            ? "LLM_FALLBACK_MODEL"
            : "LLM_FALLBACK_BASE_URL",
        ],
        message: "required_pair",
      });
    }
  });

type ContainerEnv = z.infer<typeof containerEnvSchema>;

export class ContainerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContainerConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let cachedEnv: { snapshot: string; parsed: ContainerEnv } | null = null;

function validateContainerEnv(): ContainerEnv {
  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_FALLBACK_BASE_URL: process.env.LLM_FALLBACK_BASE_URL,
    LLM_FALLBACK_API_KEY: process.env.LLM_FALLBACK_API_KEY,
    LLM_FALLBACK_MODEL: process.env.LLM_FALLBACK_MODEL,
  };

  const snapshot = ENV_KEYS.map((key) => {
    const value = raw[key];
    return value === undefined ? "\0u" : `\0s:${value.length}:${value}`;
  }).join("");

  if (cachedEnv && cachedEnv.snapshot === snapshot) {
    return cachedEnv.parsed;
  }

  const parsed = containerEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const invalidKeys = Array.from(
      new Set(
        parsed.error.issues
          .map((issue) => issue.path[0])
          .filter((key): key is string => typeof key === "string"),
      ),
    );
    const hasFakeInProd = parsed.error.issues.some(
      (issue) => issue.message === "fake_in_production",
    );
    const keyList =
      invalidKeys.length > 0 ? invalidKeys.join(", ") : "environment";
    const detail = hasFakeInProd
      ? " (fake provider is not allowed in production)"
      : "";
    throw new ContainerConfigError(
      `Invalid or missing environment configuration: ${keyList}${detail}`,
    );
  }

  cachedEnv = { snapshot, parsed: parsed.data };
  return parsed.data;
}

interface OptionalAuxRepositories {
  profiles?: Partial<ProfileRepository> & {
    findById?: (
      id: string,
    ) => Promise<{ grillMode?: unknown; grill_mode?: unknown } | null>;
  };
  appConfig?: {
    getFeatures?: () => Promise<Record<string, unknown> | null>;
  };
}

function parseGrillMode(raw: unknown): "roast" | "gentle" {
  return raw === "gentle" ? "gentle" : "roast";
}

function extractSpeechPhrases(raw: unknown): string[] {
  const source = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && "phrases" in raw
      ? (raw as { phrases?: unknown }).phrases
      : undefined;

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function readSpeechMimicryFlag(
  repositories: SupabaseRepositories & OptionalAuxRepositories,
  session: SupabaseClient,
): Promise<boolean> {
  if (typeof repositories.appConfig?.getFeatures === "function") {
    const features = await repositories.appConfig.getFeatures();
    return Boolean(features?.speech_mimicry);
  }

  if (typeof session.from === "function") {
    const { data, error } = await session
      .from("app_config")
      .select("value")
      .eq("key", "features")
      .maybeSingle<{ value: unknown }>();
    if (error || !data || typeof data.value !== "object" || data.value === null) {
      return false;
    }
    return Boolean((data.value as Record<string, unknown>).speech_mimicry);
  }

  return false;
}

async function readGrillMode(
  repositories: SupabaseRepositories & OptionalAuxRepositories,
  session: SupabaseClient,
  userId: string,
): Promise<"roast" | "gentle"> {
  if (typeof repositories.profiles?.findById === "function") {
    const profile = await repositories.profiles.findById(userId);
    return parseGrillMode(profile?.grillMode ?? profile?.grill_mode);
  }

  if (typeof session.from === "function") {
    const { data, error } = await session
      .from("profiles")
      .select("grill_mode")
      .eq("id", userId)
      .maybeSingle<{ grill_mode: unknown }>();
    if (error || !data) {
      return "roast";
    }
    return parseGrillMode(data.grill_mode);
  }

  return "roast";
}

async function resolvePersona(
  nogId: string,
  userId: string,
  repositories: SupabaseRepositories & OptionalAuxRepositories,
  session: SupabaseClient,
  speechMimicry: boolean,
): Promise<NogPersona> {
  const [nog, grillMode] = await Promise.all([
    repositories.nogs.findOwned(userId, nogId),
    readGrillMode(repositories, session, userId),
  ]);

  if (!nog) {
    return {
      nogName: "Nog",
      stage: "hatchling",
      grillMode,
      speechPhrases: [],
    };
  }

  let speechPhrases: string[] = [];
  if (speechMimicry) {
    const nogWithStyle = nog as NogRecord & {
      speechStyle?: unknown;
      speech_style?: unknown;
    };
    const inlineStyle = nogWithStyle.speechStyle ?? nogWithStyle.speech_style;
    if (inlineStyle !== undefined) {
      speechPhrases = extractSpeechPhrases(inlineStyle);
    } else if (typeof session.from === "function") {
      const { data } = await session
        .from("nogs")
        .select("speech_style")
        .eq("id", nogId)
        .eq("owner_id", userId)
        .maybeSingle<{ speech_style: unknown }>();
      speechPhrases = extractSpeechPhrases(data?.speech_style);
    }
  }

  return {
    nogName: nog.name,
    stage: nog.stage,
    grillMode,
    speechPhrases,
  };
}

async function readDisplayName(
  session: SupabaseClient,
  userId: string,
): Promise<string | null> {
  if (typeof session.from !== "function") {
    return null;
  }

  try {
    const { data, error } = await session
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle<{ display_name: unknown }>();
    if (error || !data || typeof data.display_name !== "string") {
      return null;
    }
    const trimmed = data.display_name.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export interface AppContainer {
  currentUser: CurrentUser;
  getDisplayName: () => Promise<string | null>;
  getProfileSettings: () => Promise<GetProfileSettingsResult>;
  updateProfileSettings: (
    settings: ProfileSettings,
  ) => Promise<UpdateProfileSettingsResult>;
  listNogs: () => Promise<ListNogsResult>;
  hatchNog: (input: HatchNogInput) => Promise<HatchNogResult>;
  addTopic: (input: AddTopicInput) => Promise<AddTopicResult>;
  listTopics: (input: ListTopicsInput) => Promise<ListTopicsResult>;
  getTopicNotebook: (
    input: GetTopicNotebookInput,
  ) => Promise<GetTopicNotebookResult>;
  getNogRoom: (input: GetNogRoomInput) => Promise<GetNogRoomResult>;
  getNogAnalysis: (input: GetNogAnalysisInput) => Promise<GetNogAnalysisResult>;
  petNog: (input: PetNogInput) => Promise<PetNogResult>;
  teachLesson: (input: TeachLessonInput) => Promise<TeachLessonResult>;
  answerFollowUp: (input: AnswerFollowUpInput) => Promise<AnswerFollowUpResult>;
  reviseLesson: (input: ReviseLessonInput) => Promise<ReviseLessonResult>;
  runQuickCheck: (input: RunQuickCheckInput) => Promise<RunQuickCheckResult>;
  transcribeLesson: (input: TranscribeInput) => Promise<TranscribeLessonResult>;
  speakAnswer: (input: SpeakAnswerInput) => Promise<SpeakAnswerResult>;
}

export async function createContainer(): Promise<AppContainer> {
  validateContainerEnv();

  const session = await createServerSupabaseClient();
  const authenticatedUser = await createSupabaseCurrentUser(session).get();

  if (!authenticatedUser) {
    const anonymousUser: CurrentUser = {
      async get() {
        return null;
      },
    };
    return {
      currentUser: anonymousUser,
      getDisplayName: async () => null,
      getProfileSettings: async () => ({ status: "unauthenticated" }),
      updateProfileSettings: async () => ({ status: "unauthenticated" }),
      listNogs: async () => ({ status: "unauthenticated" }),
      hatchNog: async () => ({ status: "unauthenticated" }),
      addTopic: async () => ({ status: "unauthenticated" }),
      listTopics: async () => ({ status: "unauthenticated" }),
      getTopicNotebook: async () => ({ status: "unauthenticated" }),
      getNogRoom: async () => ({ status: "unauthenticated" }),
      getNogAnalysis: async () => ({ status: "unauthenticated" }),
      petNog: async () => ({ status: "unauthenticated" }),
      teachLesson: async () => ({ status: "unauthenticated" }),
      answerFollowUp: async () => ({ status: "unauthenticated" }),
      reviseLesson: async () => ({ status: "unauthenticated" }),
      runQuickCheck: async () => ({ status: "unauthenticated" }),
      transcribeLesson: async () => ({ status: "unauthenticated" }),
      speakAnswer: async () => ({ status: "unauthenticated" }),
    };
  }

  const userId = authenticatedUser.id;
  const service = createServiceSupabaseClient();
  const currentUser: CurrentUser = {
    async get() {
      return authenticatedUser;
    },
  };
  const clock: Clock = {
    now() {
      return new Date();
    },
  };

  const repositories = createSupabaseRepositories({
    session,
    service,
    userId,
  }) as SupabaseRepositories & OptionalAuxRepositories;

  const speechMimicry = await readSpeechMimicryFlag(repositories, session);
  const llm = createLlmAdapters({
    getPersona: (nogId: string) =>
      resolvePersona(
        nogId,
        userId,
        repositories,
        session,
        speechMimicry,
      ),
    speechMimicry,
  });

  async function recordAdditionalSttSeconds(
    preChargedSeconds: number,
    reportedDurationSeconds: number | undefined,
  ): Promise<void> {
    if (
      reportedDurationSeconds === undefined ||
      !Number.isFinite(reportedDurationSeconds) ||
      reportedDurationSeconds <= 0
    ) {
      return;
    }

    const actualBillableSeconds = Math.ceil(reportedDurationSeconds);
    const delta = actualBillableSeconds - preChargedSeconds;
    if (delta <= 0) {
      return;
    }

    try {
      const quota = await repositories.usage.consumeQuota(
        userId,
        "stt_seconds",
        delta,
      );
      if (!quota.allowed && typeof service.from === "function") {
        await service.from("usage_events").insert({
          user_id: userId,
          kind: "stt_seconds",
          amount: delta,
          model: process.env.STT_MODEL?.trim() || null,
        });
      }
    } catch {
      // Pre-check already charged declared seconds; never drop a completed transcript.
    }
  }

  const speechToText: SpeechToText = {
    async transcribe(input: TranscribeInput): Promise<{ text: string }> {
      const preChargedSeconds = Math.ceil(input.durationSeconds);

      try {
        const result = await createGroqWhisperStt().transcribe(input);
        await recordAdditionalSttSeconds(
          preChargedSeconds,
          result.durationSeconds,
        );
        return { text: result.text };
      } catch (primaryError) {
        if (!isWhisperCppFallbackEnabled()) {
          throw primaryError;
        }
        const fallbackResult = await createWhisperCppStt().transcribe(input);
        await recordAdditionalSttSeconds(
          preChargedSeconds,
          fallbackResult.durationSeconds,
        );
        return { text: fallbackResult.text };
      }
    },
  };

  const questionWriter: QuestionWriter = llm.questionWriter ?? {
    async generate() {
      throw new Error("Question writer adapter is not configured.");
    },
  };

  const profilesRepo: ProfileRepository =
    typeof repositories.profiles?.getSettings === "function" &&
    typeof repositories.profiles?.saveSettings === "function"
      ? (repositories.profiles as ProfileRepository)
      : createProfileRepository({ session, userId });

  return {
    currentUser,
    getDisplayName: () => readDisplayName(session, userId),
    getProfileSettings: () =>
      getProfileSettings({
        currentUser,
        profiles: profilesRepo,
      }),
    updateProfileSettings: (settings) =>
      updateProfileSettings(
        {
          currentUser,
          profiles: profilesRepo,
        },
        settings,
      ),
    listNogs: () =>
      listNogs({
        currentUser,
        nogs: repositories.nogs,
      }),
    hatchNog: (input) =>
      hatchNog(
        {
          currentUser,
          nogs: repositories.nogs,
          subjects: repositories.subjects,
        },
        input,
      ),
    addTopic: (input) =>
      addTopic(
        {
          currentUser,
          nogs: repositories.nogs,
          subjects: repositories.subjects,
          topics: repositories.topics,
          usage: repositories.usage,
          questionWriter,
        },
        input,
      ),
    listTopics: (input) =>
      listTopics(
        {
          currentUser,
          nogs: repositories.nogs,
          topics: repositories.topics,
        },
        input,
      ),
    getTopicNotebook: (input) =>
      getTopicNotebook(
        {
          currentUser,
          nogs: repositories.nogs,
          topics: repositories.topics,
          notebook: repositories.notebook,
          thoughtCards: repositories.thoughtCards,
        },
        input,
      ),
    getNogRoom: (input) =>
      getNogRoom(
        {
          currentUser,
          clock,
          nogs: repositories.nogs,
          thoughtCards: repositories.thoughtCards,
        },
        input,
      ),
    getNogAnalysis: (input) =>
      getNogAnalysis(
        {
          currentUser,
          clock,
          nogs: repositories.nogs,
          thoughtCards: repositories.thoughtCards,
          attempts: repositories.attempts,
        },
        input,
      ),
    petNog: (input) =>
      petNog(
        {
          currentUser,
          clock,
          nogs: repositories.nogs,
        },
        input,
      ),
    teachLesson: (input) =>
      teachLesson(
        {
          currentUser,
          nogs: repositories.nogs,
          notebook: repositories.notebook,
          thoughtCards: repositories.thoughtCards,
          topics: repositories.topics,
          usage: repositories.usage,
          listener: llm.listener,
        },
        input,
      ),
    answerFollowUp: (input) =>
      answerFollowUp(
        {
          currentUser,
          nogs: repositories.nogs,
          notebook: repositories.notebook,
          thoughtCards: repositories.thoughtCards,
          usage: repositories.usage,
          listener: llm.listener,
        },
        input,
      ),
    reviseLesson: (input) =>
      reviseLesson(
        {
          currentUser,
          nogs: repositories.nogs,
          notebook: repositories.notebook,
          thoughtCards: repositories.thoughtCards,
          usage: repositories.usage,
          listener: llm.listener,
        },
        input,
      ),
    runQuickCheck: (input) =>
      runQuickCheck(
        {
          currentUser,
          clock,
          nogs: repositories.nogs,
          notebook: repositories.notebook,
          thoughtCards: repositories.thoughtCards,
          questions: repositories.questions,
          topics: repositories.topics,
          attempts: repositories.attempts,
          usage: repositories.usage,
          brain: llm.brain,
          grader: llm.grader,
        },
        input,
      ),
    transcribeLesson: (input) =>
      transcribeLesson(
        {
          currentUser,
          usage: repositories.usage,
          speechToText,
        },
        input,
      ),
    speakAnswer: (input) => {
      const ttsModel = process.env.TTS_MODEL?.trim() ?? "";
      const storageCache = createSupabaseVoiceCache({
        service,
        model: ttsModel,
      });
      let resolvedText: string | null = null;

      const trackedNotebook: Pick<NotebookRepository, "findOwnedMessage"> = {
        async findOwnedMessage(userId, messageId) {
          const message = await repositories.notebook.findOwnedMessage(
            userId,
            messageId,
          );
          if (message && message.role === "nog") {
            resolvedText = message.body;
          }
          return message;
        },
      };

      const trackedAttempts: Pick<AttemptRepository, "findOwned"> = {
        async findOwned(userId, attemptId) {
          const attempt = await repositories.attempts.findOwned(
            userId,
            attemptId,
          );
          if (attempt) {
            resolvedText = attempt.nogAnswer;
          }
          return attempt;
        },
      };

      const modelScopedVoiceCache: VoiceCacheRepository = {
        get(fallbackKey) {
          if (!ttsModel) {
            return Promise.resolve(null);
          }
          const cacheHash = computeVoiceCacheHash(
            ttsModel,
            resolvedText ?? fallbackKey,
          );
          return storageCache.get(cacheHash);
        },
        put(fallbackKey, audio) {
          if (!ttsModel) {
            return Promise.resolve();
          }
          const cacheHash = computeVoiceCacheHash(
            ttsModel,
            resolvedText ?? fallbackKey,
          );
          return storageCache.put(cacheHash, audio);
        },
      };

      const textToSpeech: TextToSpeech = {
        speak(speakInput) {
          return createGeminiTts().speak(speakInput);
        },
      };

      return speakAnswer(
        {
          currentUser,
          notebook: trackedNotebook,
          attempts: trackedAttempts,
          voiceCache: modelScopedVoiceCache,
          usage: repositories.usage,
          textToSpeech,
        },
        input,
      );
    },
  };
}
