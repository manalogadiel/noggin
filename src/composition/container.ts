import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { z } from "zod";
import { createLlmAdapters, type NogPersona } from "@/adapters/ai/fallback-llm";
import {
  askNog,
  listAskHistory,
  type AskNogInput,
  type AskNogResult,
  type ListAskHistoryResult,
} from "@/core/application/use-cases/ask-nog";
import {
  createSupabaseRepositories,
  type SupabaseRepositories,
} from "@/adapters/supabase/repositories";
import {
  createDodoPaymentGateway,
  resolveDodoProductIdsFromEnv,
} from "@/adapters/billing/dodo-payment-gateway";
import { createHitpayPaymentGateway } from "@/adapters/billing/hitpay-payment-gateway";
import { createPaymongoPaymentGateway } from "@/adapters/billing/paymongo-payment-gateway";
import {
  createPolarPaymentGateway,
  resolvePolarProductIdsFromEnv,
} from "@/adapters/billing/polar-payment-gateway";
import { createSandboxPaymentGateway } from "@/adapters/billing/sandbox-payment-gateway";
import { createActivityRepository } from "@/adapters/supabase/repositories/activity-repository";
import { createBillingRepository } from "@/adapters/supabase/repositories/billing-repository";
import { createEconomyRepository } from "@/adapters/supabase/repositories/economy-repository";
import { createProfileRepository } from "@/adapters/supabase/repositories/profile-repository";
import { createProgressRepository } from "@/adapters/supabase/repositories/progress-repository";
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
  ActivityRepository,
  AttemptRepository,
  BillingRepository,
  Clock,
  CurrentUser,
  EconomyPreferencesPatch,
  EconomyRepository,
  NogAsker,
  NogRecord,
  NotebookRepository,
  PaymentGateway,
  ProfileRepository,
  ProfileSettings,
  ProgressRepository,
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
  cancelNogginPlus,
  type CancelSubscriptionResult,
  checkoutCoinPack,
  type CheckoutProductInput,
  type CheckoutProductResult,
  getBillingSummary,
  type GetBillingSummaryResult,
  subscribeNogginPlus,
} from "@/core/application/use-cases/billing";
import {
  customizeNog,
  type CustomizeNogInput,
  type CustomizeNogResult,
} from "@/core/application/use-cases/customize-nog";
import {
  claimDailyTask,
  type ClaimDailyTaskInput,
  type ClaimDailyTaskResult,
  expandNotebookPages,
  type ExpandNotebookPagesInput,
  type ExpandNotebookPagesResult,
  getPlayerEconomy,
  type GetPlayerEconomyResult,
  purchaseShopItem,
  type PurchaseShopItemInput,
  type PurchaseShopItemResult,
  updatePlayerPreferences,
  type UpdatePlayerPreferencesResult,
  useStreakRestore,
  type UseStreakRestoreResult,
} from "@/core/application/use-cases/economy";
import {
  getLearningProgress,
  type GetLearningProgressResult,
} from "@/core/application/use-cases/get-learning-progress";
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
  getRecentActivity,
  type GetRecentActivityInput,
  type GetRecentActivityResult,
} from "@/core/application/use-cases/get-recent-activity";
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
  startRest,
  wakeNog,
  type RestNogResult,
  type StartRestInput,
  type WakeNogInput,
} from "@/core/application/use-cases/rest-nog";
import {
  listDueCards,
  reviewCard,
  type ListDueCardsInput,
  type ListDueCardsResult,
  type ReviewCardInput,
  type ReviewCardResult,
} from "@/core/application/use-cases/review-cards";
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
  updateDisplayName,
  type UpdateDisplayNameInput,
  type UpdateDisplayNameResult,
} from "@/core/application/use-cases/update-profile";
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
  "LLM_GRADER_MODEL",
  "LLM_ASKER_MODEL",
  "LLM_QUESTION_WRITER_MODEL",
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
    LLM_GRADER_MODEL: optionalTrimmedString,
    LLM_ASKER_MODEL: optionalTrimmedString,
    LLM_QUESTION_WRITER_MODEL: optionalTrimmedString,
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
    LLM_GRADER_MODEL: process.env.LLM_GRADER_MODEL,
    LLM_ASKER_MODEL: process.env.LLM_ASKER_MODEL,
    LLM_QUESTION_WRITER_MODEL: process.env.LLM_QUESTION_WRITER_MODEL,
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
  economy?: EconomyRepository;
  billing?: BillingRepository;
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

function normalizeFeatureFlags(raw: unknown): Record<string, boolean> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const normalized: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") {
      normalized[key] = value;
    }
  }
  return normalized;
}

const FEATURE_FLAGS_TTL_MS = 60_000;
let cachedFeatureFlags: { value: Record<string, boolean>; expiresAt: number } | null = null;

async function readFeatureFlags(
  repositories: (SupabaseRepositories & OptionalAuxRepositories) | null,
  session: SupabaseClient,
): Promise<Record<string, boolean>> {
  const canUseMemoryCache =
    process.env.NODE_ENV !== "test" &&
    typeof repositories?.appConfig?.getFeatures !== "function";

  if (canUseMemoryCache && cachedFeatureFlags && Date.now() < cachedFeatureFlags.expiresAt) {
    return { ...cachedFeatureFlags.value };
  }

  try {
    if (typeof repositories?.appConfig?.getFeatures === "function") {
      const features = await repositories.appConfig.getFeatures();
      return normalizeFeatureFlags(features);
    }

    if (typeof session.from === "function") {
      const { data, error } = await session
        .from("app_config")
        .select("value")
        .eq("key", "features")
        .maybeSingle<{ value: unknown }>();
      if (error || !data) {
        return {};
      }
      const normalized = normalizeFeatureFlags(data.value);
      if (canUseMemoryCache) {
        cachedFeatureFlags = {
          value: normalized,
          expiresAt: Date.now() + FEATURE_FLAGS_TTL_MS,
        };
      }
      return { ...normalized };
    }
  } catch {
    return {};
  }

  return {};
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

async function readProfileHeader(
  session: SupabaseClient,
  userId: string,
): Promise<{ displayName: string | null; birthDate: string | null }> {
  if (typeof session.from !== "function") {
    return { displayName: null, birthDate: null };
  }

  try {
    const { data, error } = await session
      .from("profiles")
      .select("display_name, birth_date")
      .eq("id", userId)
      .maybeSingle<{ display_name: unknown; birth_date?: unknown }>();
    if (error || !data) {
      return { displayName: null, birthDate: null };
    }
    const displayName =
      typeof data.display_name === "string" && data.display_name.trim().length > 0
        ? data.display_name.trim()
        : null;
    const birthDate =
      typeof data.birth_date === "string" && data.birth_date.trim().length > 0
        ? data.birth_date.trim()
        : null;
    return { displayName, birthDate };
  } catch {
    return { displayName: null, birthDate: null };
  }
}

function computeAgeTierFromBirthDate(birthDate: string | null): "under_13" | "standard" {
  if (!birthDate) return "standard";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) return "standard";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const mDiff = now.getUTCMonth() + 1 - month;
  if (mDiff < 0 || (mDiff === 0 && now.getUTCDate() < day)) {
    age -= 1;
  }
  return age < 13 ? "under_13" : "standard";
}

async function readEmail(session: SupabaseClient): Promise<string | null> {
  if (typeof session.auth?.getUser !== "function") {
    return null;
  }

  try {
    const { data, error } = await session.auth.getUser();
    if (error || !data?.user || typeof data.user.email !== "string") {
      return null;
    }
    const trimmed = data.user.email.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export interface AppContainer {
  currentUser: CurrentUser;
  clock?: Clock;
  getDisplayName: () => Promise<string | null>;
  getAgeTier?: () => Promise<"under_13" | "standard">;
  getEmail: () => Promise<string | null>;
  getFeatures: () => Promise<Record<string, boolean>>;
  getProfileSettings: () => Promise<GetProfileSettingsResult>;
  updateProfileSettings: (
    settings: ProfileSettings,
  ) => Promise<UpdateProfileSettingsResult>;
  updateDisplayName: (
    input: UpdateDisplayNameInput,
  ) => Promise<UpdateDisplayNameResult>;
  getLearningProgress: () => Promise<GetLearningProgressResult>;
  getRecentActivity: (
    input?: GetRecentActivityInput,
  ) => Promise<GetRecentActivityResult>;
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
  customizeNog: (input: CustomizeNogInput) => Promise<CustomizeNogResult>;
  startRest: (input: StartRestInput) => Promise<RestNogResult>;
  wakeNog: (input: WakeNogInput) => Promise<RestNogResult>;
  listDueCards: (input: ListDueCardsInput) => Promise<ListDueCardsResult>;
  reviewCard: (input: ReviewCardInput) => Promise<ReviewCardResult>;
  teachLesson: (input: TeachLessonInput) => Promise<TeachLessonResult>;
  answerFollowUp: (input: AnswerFollowUpInput) => Promise<AnswerFollowUpResult>;
  askNog: (input: AskNogInput) => Promise<AskNogResult>;
  listAskHistory: (input: {
    nogId: string;
    limit?: number;
  }) => Promise<ListAskHistoryResult>;
  reviseLesson: (input: ReviseLessonInput) => Promise<ReviseLessonResult>;
  runQuickCheck: (input: RunQuickCheckInput) => Promise<RunQuickCheckResult>;
  transcribeLesson: (input: TranscribeInput) => Promise<TranscribeLessonResult>;
  speakAnswer: (input: SpeakAnswerInput) => Promise<SpeakAnswerResult>;
  getPlayerEconomy: (input?: {
    ledgerLimit?: number;
  }) => Promise<GetPlayerEconomyResult>;
  purchaseShopItem: (
    input: PurchaseShopItemInput,
  ) => Promise<PurchaseShopItemResult>;
  expandNotebookPages: (
    input: ExpandNotebookPagesInput,
  ) => Promise<ExpandNotebookPagesResult>;
  claimDailyTask: (input: ClaimDailyTaskInput) => Promise<ClaimDailyTaskResult>;
  useStreakRestore: () => Promise<UseStreakRestoreResult>;
  updatePlayerPreferences: (
    patch: EconomyPreferencesPatch,
  ) => Promise<UpdatePlayerPreferencesResult>;
  getBillingSummary: () => Promise<GetBillingSummaryResult>;
  checkoutCoinPack: (
    input: CheckoutProductInput,
  ) => Promise<CheckoutProductResult>;
  subscribeNogginPlus: (
    input: CheckoutProductInput,
  ) => Promise<CheckoutProductResult>;
  cancelNogginPlus: () => Promise<CancelSubscriptionResult>;
}

/** Used when no answering model is configured; the ask flow reports brain fog. */
const unavailableAsker: NogAsker = {
  async ask() {
    throw new Error("No answering model is configured.");
  },
};

const reactCache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof React.cache === "function" ? React.cache : (fn) => fn;

async function buildContainer(): Promise<AppContainer> {
  validateContainerEnv();

  const session = await createServerSupabaseClient();
  let authenticatedUser: { id: string } | null = null;
  let authenticatedEmail: string | null = null;
  if (typeof session.auth?.getUser === "function") {
    const {
      data: { user },
      error,
    } = await session.auth.getUser();
    if (!error && user?.id) {
      authenticatedUser = { id: user.id };
      if (typeof user.email === "string") {
        const trimmed = user.email.trim();
        authenticatedEmail = trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  if (!authenticatedUser) {
    const anonymousUser: CurrentUser = {
      async get() {
        return null;
      },
    };
    return {
      currentUser: anonymousUser,
      getDisplayName: async () => null,
      getAgeTier: async () => "standard",
      getEmail: async () => null,
      getFeatures: async () => ({}),
      getProfileSettings: async () => ({ status: "unauthenticated" }),
      updateProfileSettings: async () => ({ status: "unauthenticated" }),
      updateDisplayName: async () => ({ status: "unauthenticated" }),
      getLearningProgress: async () => ({ status: "unauthenticated" }),
      getRecentActivity: async () => ({ status: "unauthenticated" }),
      listNogs: async () => ({ status: "unauthenticated" }),
      hatchNog: async () => ({ status: "unauthenticated" }),
      addTopic: async () => ({ status: "unauthenticated" }),
      listTopics: async () => ({ status: "unauthenticated" }),
      getTopicNotebook: async () => ({ status: "unauthenticated" }),
      getNogRoom: async () => ({ status: "unauthenticated" }),
      getNogAnalysis: async () => ({ status: "unauthenticated" }),
      petNog: async () => ({ status: "unauthenticated" }),
      customizeNog: async () => ({ status: "unauthenticated" }),
      startRest: async () => ({ status: "unauthenticated" }),
      wakeNog: async () => ({ status: "unauthenticated" }),
      listDueCards: async () => ({ status: "unauthenticated" }),
      reviewCard: async () => ({ status: "unauthenticated" }),
      teachLesson: async () => ({ status: "unauthenticated" }),
      answerFollowUp: async () => ({ status: "unauthenticated" }),
      askNog: async () => ({ status: "unauthenticated" }),
      listAskHistory: async () => ({ status: "unauthenticated" }),
      reviseLesson: async () => ({ status: "unauthenticated" }),
      runQuickCheck: async () => ({ status: "unauthenticated" }),
      transcribeLesson: async () => ({ status: "unauthenticated" }),
      speakAnswer: async () => ({ status: "unauthenticated" }),
      getPlayerEconomy: async () => ({ status: "unauthenticated" }),
      purchaseShopItem: async () => ({ status: "unauthenticated" }),
      expandNotebookPages: async () => ({ status: "unauthenticated" }),
      claimDailyTask: async () => ({ status: "unauthenticated" }),
      useStreakRestore: async () => ({ status: "unauthenticated" }),
      updatePlayerPreferences: async () => ({ status: "unauthenticated" }),
      getBillingSummary: async () => ({ status: "unauthenticated" }),
      checkoutCoinPack: async () => ({ status: "unauthenticated" }),
      subscribeNogginPlus: async () => ({ status: "unauthenticated" }),
      cancelNogginPlus: async () => ({ status: "unauthenticated" }),
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

  const features = await readFeatureFlags(repositories, session);
  const speechMimicry = Boolean(features.speech_mimicry);

  // Per-request read deduplication so layouts and parallel page loaders never repeat identical queries.
  const nogOwnedCache = new Map<string, Promise<NogRecord | null>>();
  let nogListCache: Promise<NogRecord[]> | null = null;
  const cardsByNogCache = new Map<string, Promise<Awaited<ReturnType<NonNullable<SupabaseRepositories["thoughtCards"]["listByNog"]>>>>>();
  const cardsByTopicCache = new Map<string, Promise<Awaited<ReturnType<SupabaseRepositories["thoughtCards"]["listByTopic"]>>>>();
  let profileHeaderCache: Promise<{ displayName: string | null; birthDate: string | null }> | null = null;
  let profileSettingsCache: Promise<GetProfileSettingsResult> | null = null;
  let learningProgressCache: Promise<GetLearningProgressResult> | null = null;
  let listNogsCache: Promise<ListNogsResult> | null = null;

  function clearReadCaches() {
    nogOwnedCache.clear();
    nogListCache = null;
    cardsByNogCache.clear();
    cardsByTopicCache.clear();
    profileHeaderCache = null;
    profileSettingsCache = null;
    learningProgressCache = null;
    listNogsCache = null;
  }

  const cachedNogs = repositories.nogs
    ? {
        ...repositories.nogs,
        findOwned: (ownerId: string, nogId: string) => {
          const key = `${ownerId}:${nogId}`;
          const existing = nogOwnedCache.get(key);
          if (existing) return existing;
          const pending = repositories.nogs.findOwned(ownerId, nogId);
          nogOwnedCache.set(key, pending);
          return pending;
        },
        listByOwner: (ownerId: string) => {
          if (ownerId === userId && nogListCache) return nogListCache;
          const pending = repositories.nogs.listByOwner(ownerId);
          if (ownerId === userId) nogListCache = pending;
          return pending;
        },
      }
    : repositories.nogs;

  const cachedThoughtCards = repositories.thoughtCards
    ? {
        ...repositories.thoughtCards,
        ...(typeof repositories.thoughtCards.listByNog === "function"
          ? {
              listByNog: (nogId: string) => {
                const existing = cardsByNogCache.get(nogId);
                if (existing) return existing;
                const pending = repositories.thoughtCards.listByNog!(nogId);
                cardsByNogCache.set(nogId, pending);
                return pending;
              },
            }
          : {}),
        ...(typeof repositories.thoughtCards.listByTopic === "function"
          ? {
              listByTopic: (nogId: string, topicId: string) => {
                const key = `${nogId}:${topicId}`;
                const existing = cardsByTopicCache.get(key);
                if (existing) return existing;
                const pending = repositories.thoughtCards.listByTopic(nogId, topicId);
                cardsByTopicCache.set(key, pending);
                return pending;
              },
            }
          : {}),
      }
    : repositories.thoughtCards;

  const llm = createLlmAdapters({
    getPersona: (nogId: string) =>
      resolvePersona(
        nogId,
        userId,
        { ...repositories, nogs: cachedNogs },
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
    typeof repositories.profiles?.saveSettings === "function" &&
    typeof repositories.profiles?.updateDisplayName === "function"
      ? (repositories.profiles as ProfileRepository)
      : createProfileRepository({ session, userId });

  const progressRepo: ProgressRepository =
    typeof repositories.progress?.listMastery === "function"
      ? repositories.progress
      : createProgressRepository({ session, service, userId });

  const activityRepo: ActivityRepository =
    typeof repositories.activity?.listRecent === "function"
      ? repositories.activity
      : createActivityRepository({ session, service, userId });

  const economyRepo: EconomyRepository =
    typeof repositories.economy?.getOrInit === "function"
      ? repositories.economy
      : createEconomyRepository({ session, userId });

  const billingRepo: BillingRepository =
    typeof repositories.billing?.listProducts === "function"
      ? repositories.billing
      : createBillingRepository({ session, service, userId });

  const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY?.trim() ?? "";
  const dodoEnv = (process.env.DODO_PAYMENTS_ENV ?? "test").trim().toLowerCase();
  const dodoTestMode =
    dodoEnv !== "live" && dodoEnv !== "live_mode" && dodoEnv !== "production";
  const polarAccessToken = process.env.POLAR_ACCESS_TOKEN?.trim() ?? "";
  const polarEnv = (process.env.POLAR_ENV ?? "sandbox").trim().toLowerCase();
  const polarSandbox = polarEnv !== "live" && polarEnv !== "production";
  const hitpayApiKey = process.env.HITPAY_API_KEY?.trim() ?? "";
  const hitpayEnv = (process.env.HITPAY_ENV ?? "sandbox").trim().toLowerCase();
  const hitpaySandbox = hitpayEnv !== "live" && hitpayEnv !== "production";
  const paymongoSecret = process.env.PAYMONGO_SECRET_KEY?.trim() ?? "";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const paymentGateway: PaymentGateway = dodoApiKey
    ? createDodoPaymentGateway({
        apiKey: dodoApiKey,
        appUrl,
        productIds: resolveDodoProductIdsFromEnv(process.env),
        testMode: dodoTestMode,
      })
    : polarAccessToken
      ? createPolarPaymentGateway({
          accessToken: polarAccessToken,
          appUrl,
          productIds: resolvePolarProductIdsFromEnv(process.env),
          sandbox: polarSandbox,
        })
      : hitpayApiKey
        ? createHitpayPaymentGateway({
            apiKey: hitpayApiKey,
            appUrl,
            sandbox: hitpaySandbox,
          })
        : paymongoSecret
          ? createPaymongoPaymentGateway({ secretKey: paymongoSecret, appUrl })
          : createSandboxPaymentGateway();

  return {
    currentUser,
    clock,
    getDisplayName: async () => {
      if (!profileHeaderCache) {
        profileHeaderCache = readProfileHeader(session, userId);
      }
      return (await profileHeaderCache).displayName;
    },
    getAgeTier: async () => {
      if (!profileHeaderCache) {
        profileHeaderCache = readProfileHeader(session, userId);
      }
      return computeAgeTierFromBirthDate((await profileHeaderCache).birthDate);
    },
    getEmail: async () => authenticatedEmail ?? readEmail(session),
    getFeatures: async () => ({ ...features }),
    getProfileSettings: () => {
      if (!profileSettingsCache) {
        profileSettingsCache = getProfileSettings({
          currentUser,
          profiles: profilesRepo,
        });
      }
      return profileSettingsCache;
    },
    updateProfileSettings: async (settings) => {
      clearReadCaches();
      return updateProfileSettings(
        {
          currentUser,
          profiles: profilesRepo,
        },
        settings,
      );
    },
    updateDisplayName: async (input) => {
      clearReadCaches();
      return updateDisplayName(
        {
          currentUser,
          profiles: profilesRepo,
        },
        input,
      );
    },
    getLearningProgress: () => {
      if (!learningProgressCache) {
        learningProgressCache = getLearningProgress({
          currentUser,
          nogs: cachedNogs,
          progress: progressRepo,
        });
      }
      return learningProgressCache;
    },
    getRecentActivity: (input) =>
      getRecentActivity(
        {
          currentUser,
          activity: activityRepo,
          nogs: cachedNogs,
        },
        input,
      ),
    listNogs: () => {
      if (!listNogsCache) {
        listNogsCache = listNogs({
          currentUser,
          nogs: cachedNogs,
        });
      }
      return listNogsCache;
    },
    hatchNog: async (input) => {
      clearReadCaches();
      return hatchNog(
        {
          currentUser,
          nogs: repositories.nogs,
          subjects: repositories.subjects,
        },
        input,
      );
    },
    addTopic: async (input) => {
      clearReadCaches();
      return addTopic(
        {
          currentUser,
          nogs: cachedNogs,
          subjects: repositories.subjects,
          topics: repositories.topics,
          usage: repositories.usage,
          questionWriter,
        },
        input,
      );
    },
    listTopics: (input) =>
      listTopics(
        {
          currentUser,
          nogs: cachedNogs,
          topics: repositories.topics,
        },
        input,
      ),
    getTopicNotebook: (input) =>
      getTopicNotebook(
        {
          currentUser,
          nogs: cachedNogs,
          topics: repositories.topics,
          notebook: repositories.notebook,
          thoughtCards: cachedThoughtCards,
        },
        input,
      ),
    getNogRoom: (input) =>
      getNogRoom(
        {
          currentUser,
          clock,
          nogs: cachedNogs,
          thoughtCards: cachedThoughtCards,
        },
        input,
      ),
    getNogAnalysis: (input) =>
      getNogAnalysis(
        {
          currentUser,
          clock,
          nogs: cachedNogs,
          thoughtCards: cachedThoughtCards,
          attempts: repositories.attempts,
        },
        input,
      ),
    petNog: async (input) => {
      clearReadCaches();
      return petNog(
        {
          currentUser,
          clock,
          nogs: repositories.nogs,
        },
        input,
      );
    },
    customizeNog: async (input) => {
      clearReadCaches();
      return customizeNog(
        {
          currentUser,
          nogs: repositories.nogs,
        },
        input,
      );
    },
    startRest: async (input) => {
      clearReadCaches();
      return startRest(
        {
          currentUser,
          nogs: repositories.nogs,
          clock,
        },
        input,
      );
    },
    wakeNog: async (input) => {
      clearReadCaches();
      return wakeNog(
        {
          currentUser,
          nogs: repositories.nogs,
          clock,
        },
        input,
      );
    },
    listDueCards: (input) =>
      listDueCards(
        {
          currentUser,
          clock,
          nogs: cachedNogs,
          thoughtCards: cachedThoughtCards,
        },
        input,
      ),
    reviewCard: async (input) => {
      clearReadCaches();
      return reviewCard(
        {
          currentUser,
          clock,
          nogs: repositories.nogs,
          thoughtCards: repositories.thoughtCards,
        },
        input,
      );
    },
    teachLesson: async (input) => {
      clearReadCaches();
      return teachLesson(
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
      );
    },
    answerFollowUp: async (input) => {
      clearReadCaches();
      return answerFollowUp(
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
      );
    },
    askNog: async (input) => {
      clearReadCaches();
      return askNog(
        {
          currentUser,
          nogs: repositories.nogs,
          topics: repositories.topics,
          thoughtCards: repositories.thoughtCards,
          notebook: repositories.notebook,
          usage: repositories.usage,
          asker: llm.asker ?? unavailableAsker,
          askHistory: repositories.askHistory,
        },
        input,
      );
    },
    listAskHistory: (input) =>
      listAskHistory(
        {
          currentUser,
          nogs: cachedNogs,
          askHistory: repositories.askHistory,
        },
        input,
      ),
    reviseLesson: async (input) => {
      clearReadCaches();
      return reviseLesson(
        {
          currentUser,
          nogs: repositories.nogs,
          notebook: repositories.notebook,
          thoughtCards: repositories.thoughtCards,
          usage: repositories.usage,
          listener: llm.listener,
        },
        input,
      );
    },
    runQuickCheck: async (input) => {
      clearReadCaches();
      return runQuickCheck(
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
      );
    },
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
    getPlayerEconomy: (input) =>
      getPlayerEconomy({ currentUser, economy: economyRepo }, input),
    purchaseShopItem: (input) =>
      purchaseShopItem({ currentUser, economy: economyRepo }, input),
    expandNotebookPages: (input) =>
      expandNotebookPages({ currentUser, economy: economyRepo }, input),
    claimDailyTask: (input) =>
      claimDailyTask({ currentUser, economy: economyRepo }, input),
    useStreakRestore: () =>
      useStreakRestore({ currentUser, economy: economyRepo }),
    updatePlayerPreferences: (patch) =>
      updatePlayerPreferences({ currentUser, economy: economyRepo }, patch),
    getBillingSummary: () =>
      getBillingSummary({ currentUser, billing: billingRepo }),
    checkoutCoinPack: (input) =>
      checkoutCoinPack(
        { currentUser, billing: billingRepo, paymentGateway },
        input,
      ),
    subscribeNogginPlus: (input) =>
      subscribeNogginPlus(
        { currentUser, billing: billingRepo, paymentGateway },
        input,
      ),
    cancelNogginPlus: () =>
      cancelNogginPlus({ currentUser, billing: billingRepo }),
  };
}

export const createContainer = reactCache(buildContainer);
