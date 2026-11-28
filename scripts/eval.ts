import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { groundQuote } from "../src/core/domain/quote-grounding";
import type {
  AnswerInput,
  AskInput,
  AskOutput,
  DigestOperation,
  GenerateQuestionsInput,
  GradeInput,
  GraderResult,
  ListenInput,
  ListenerDigest,
  NogStageSlug,
} from "../src/core/application/ports";
import { createFakeLlmAdapters } from "../src/adapters/ai/fake-llm";
import {
  createOpenAiCompatibleAdapters,
  LlmConfigError,
  type LlmAdapters,
  type LlmUsageEvent,
} from "../src/adapters/ai/openai-compatible-llm";
import {
  buildAnswererMessages,
  PROMPT_VERSION as ANSWERER_PROMPT_VERSION,
} from "../src/adapters/ai/prompts/answerer";
import {
  buildAskerMessages,
  PROMPT_VERSION as ASKER_PROMPT_VERSION,
} from "../src/adapters/ai/prompts/asker";
import {
  buildGraderMessages,
  PROMPT_VERSION as GRADER_PROMPT_VERSION,
} from "../src/adapters/ai/prompts/grader";
import {
  buildListenerMessages,
  PROMPT_VERSION as LISTENER_PROMPT_VERSION,
  type NogPersona,
} from "../src/adapters/ai/prompts/listener";
import {
  buildQuestionWriterMessages,
  PROMPT_VERSION as QUESTION_WRITER_PROMPT_VERSION,
} from "../src/adapters/ai/prompts/question-writer";
import {
  parseListenerDigest,
  questionWriterResponseSchema,
} from "../src/adapters/ai/schemas";

export type EvalPort =
  | "listener"
  | "answerer"
  | "grader"
  | "asker"
  | "question-writer";

export const EVAL_PORTS: readonly EvalPort[] = [
  "listener",
  "answerer",
  "grader",
  "asker",
  "question-writer",
];

export type PersonaOverride = Partial<NogPersona>;

export type GoldenCase = {
  id: string;
  required?: boolean;
  persona?: Record<string, unknown>;
} & (
  | {
      port: "listener";
      input: ListenInput;
      providerResponse?: unknown;
      expected: {
        operation?: Partial<DigestOperation>;
        operationStatuses?: string[];
        offTopic?: boolean;
        minFollowUpQuestions?: number;
        minCreateOps?: number;
        allQuotesGrounded?: boolean;
        replyPatterns?: string[];
        replyNotMatch?: string[];
        followUpPatterns?: string[];
        output?: ListenerDigest;
      };
    }
  | {
      port: "grader";
      input: GradeInput;
      expected: { output: GraderResult; sameVerdictAs?: string };
    }
  | {
      port: "answerer";
      input: AnswerInput;
      expected: {
        answers: {
          questionId: string;
          nogAnswerPattern: string;
          nogAnswerNotMatch?: string[];
        }[];
      };
    }
  | {
      port: "asker";
      input: AskInput;
      expected: {
        knows: boolean;
        citedCardIds: string[];
        answerPattern?: string;
        answerNotMatch?: string[];
      };
    }
  | {
      port: "question-writer";
      input: GenerateQuestionsInput;
      expected?: { questionCount?: number };
    }
);

interface GoldenSuite {
  cases: GoldenCase[];
}

export interface CaseOutcome {
  id: string;
  port: EvalPort;
  required: boolean;
  passed: boolean;
  reason?: string;
  debugSnippet?: string;
}

export interface RoleUsageStats {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  fallbackCalls: number;
}

export interface RoleSummary {
  n: number;
  passed: number;
  misses: number;
  allowedMisses: number;
  ok: boolean;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  fallbackCalls: number;
}

export interface EvalSummary {
  roles: Record<EvalPort, RoleSummary>;
  totalCount: number;
  passedCount: number;
  requiredCount: number;
  requiredPassedCount: number;
  requiredPassed: boolean;
  fallbackCalls: number;
  overallPassed: boolean;
  gateFailureReason?: string;
}

export interface PromptVersionsMap {
  listener: string;
  answerer: string;
  asker: string;
  grader: string;
  questionWriter: string;
}

export interface EvalReport {
  timestamp: string;
  live: boolean;
  partial: boolean;
  modelId: string;
  roleModels: Partial<Record<EvalPort, string>>;
  promptVersions: PromptVersionsMap;
  goldenCaseCount: number;
  delayMs: number;
  systemPromptChars: Record<string, number>;
  totals: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    fallbackCalls: number;
  };
  overallPassed: boolean;
  gateFailureReason?: string;
  roles: Record<EvalPort, RoleSummary>;
  cases: Array<{
    id: string;
    port: EvalPort;
    required: boolean;
    passed: boolean;
    reason?: string;
    debugSnippet?: string;
  }>;
}

export const EVAL_PERSONA: NogPersona = {
  nogName: "Pingu",
  stage: "sprout",
  grillMode: "roast",
  speechPhrases: [],
};

const VALID_STAGES = new Set<NogStageSlug>([
  "hatchling",
  "sprout",
  "scholar",
  "genius",
]);
const ALLOWED_PERSONA_KEYS = new Set([
  "grillMode",
  "stage",
  "nogName",
  "speechPhrases",
]);
const DEFAULT_LIVE_DELAY_MS = 1200;
const MIN_LIVE_DELAY_MS = 500;
const MAX_DELAY_MS = 60000;
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*?{]/;

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readNonNegativeNumberEnv(key: string): number {
  const raw = readEnv(key);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function validateHttpUrl(key: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LlmConfigError(`Invalid ${key}: must be a valid http(s) URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LlmConfigError(`Invalid ${key}: must use http or https.`);
  }
  return value;
}

export function parseDelayMs(
  raw: string | number | undefined,
  live: boolean,
): number {
  const defaultDelay = live ? DEFAULT_LIVE_DELAY_MS : 0;
  if (raw === undefined || raw === "") {
    return defaultDelay;
  }
  const parsed = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultDelay;
  }
  const clamped = Math.min(MAX_DELAY_MS, Math.max(0, Math.round(parsed)));
  return live ? Math.max(MIN_LIVE_DELAY_MS, clamped) : clamped;
}

export function validatePersonaOverride(
  raw: unknown,
): { ok: true; value: NogPersona } | { ok: false; reason: "invalid persona override" } {
  if (raw === undefined) {
    return { ok: true, value: { ...EVAL_PERSONA, speechPhrases: [...EVAL_PERSONA.speechPhrases] } };
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid persona override" };
  }

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_PERSONA_KEYS.has(key)) {
      return { ok: false, reason: "invalid persona override" };
    }
  }

  const merged: NogPersona = {
    ...EVAL_PERSONA,
    speechPhrases: [...EVAL_PERSONA.speechPhrases],
  };

  if ("grillMode" in record) {
    if (record.grillMode !== "roast" && record.grillMode !== "gentle") {
      return { ok: false, reason: "invalid persona override" };
    }
    merged.grillMode = record.grillMode;
  }

  if ("stage" in record) {
    if (
      typeof record.stage !== "string" ||
      !VALID_STAGES.has(record.stage as NogStageSlug)
    ) {
      return { ok: false, reason: "invalid persona override" };
    }
    merged.stage = record.stage as NogStageSlug;
  }

  if ("nogName" in record) {
    if (
      typeof record.nogName !== "string" ||
      record.nogName.trim().length === 0 ||
      record.nogName.length > 60
    ) {
      return { ok: false, reason: "invalid persona override" };
    }
    merged.nogName = record.nogName;
  }

  if ("speechPhrases" in record) {
    if (
      !Array.isArray(record.speechPhrases) ||
      record.speechPhrases.length > 10 ||
      !record.speechPhrases.every((item) => typeof item === "string")
    ) {
      return { ok: false, reason: "invalid persona override" };
    }
    merged.speechPhrases = [...record.speechPhrases];
  }

  return { ok: true, value: merged };
}

export function compileSafeRegex(pattern: string): RegExp | null {
  if (typeof pattern !== "string" || NESTED_QUANTIFIER.test(pattern)) {
    return null;
  }
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function emptyRoleUsage(): Record<EvalPort, RoleUsageStats> {
  return {
    listener: { calls: 0, promptTokens: 0, completionTokens: 0, fallbackCalls: 0 },
    answerer: { calls: 0, promptTokens: 0, completionTokens: 0, fallbackCalls: 0 },
    grader: { calls: 0, promptTokens: 0, completionTokens: 0, fallbackCalls: 0 },
    asker: { calls: 0, promptTokens: 0, completionTokens: 0, fallbackCalls: 0 },
    "question-writer": { calls: 0, promptTokens: 0, completionTokens: 0, fallbackCalls: 0 },
  };
}

export function summarizeByRole(
  outcomes: ReadonlyArray<CaseOutcome>,
  options: {
    requirePerfect?: boolean;
    onlyRole?: EvalPort;
    roleUsage?: Partial<Record<EvalPort, Partial<RoleUsageStats>>>;
  } = {},
): EvalSummary {
  const activePorts = options.onlyRole ? [options.onlyRole] : EVAL_PORTS;
  const roles = {} as Record<EvalPort, RoleSummary>;
  let fallbackCalls = 0;

  for (const port of EVAL_PORTS) {
    const portOutcomes = outcomes.filter((item) => item.port === port);
    const n = portOutcomes.length;
    const passed = portOutcomes.filter((item) => item.passed).length;
    const misses = n - passed;
    const allowedMisses = options.requirePerfect ? 0 : Math.floor(0.1 * n);
    const usage = options.roleUsage?.[port];
    const roleFallback = usage?.fallbackCalls ?? 0;
    fallbackCalls += roleFallback;
    const ok = n >= 1 && misses <= allowedMisses && roleFallback === 0;
    roles[port] = {
      n,
      passed,
      misses,
      allowedMisses,
      ok,
      calls: usage?.calls ?? 0,
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      fallbackCalls: roleFallback,
    };
  }

  const totalCount = outcomes.length;
  const passedCount = outcomes.filter((item) => item.passed).length;
  const requiredOutcomes = outcomes.filter((item) => item.required);
  const requiredPassedCount = requiredOutcomes.filter((item) => item.passed).length;
  const requiredPassed = requiredPassedCount === requiredOutcomes.length;
  const allRolesOk = activePorts.every((port) => roles[port].ok);

  let gateFailureReason: string | undefined;
  if (fallbackCalls > 0) {
    gateFailureReason = `fallback model served ${fallbackCalls} calls`;
  } else if (!requiredPassed) {
    gateFailureReason = "required case failed";
  } else if (!allRolesOk) {
    gateFailureReason = "role miss limit exceeded";
  }

  const overallPassed =
    fallbackCalls === 0 && requiredPassed && allRolesOk && totalCount > 0;

  return {
    roles,
    totalCount,
    passedCount,
    requiredCount: requiredOutcomes.length,
    requiredPassedCount,
    requiredPassed,
    fallbackCalls,
    overallPassed,
    ...(gateFailureReason ? { gateFailureReason } : {}),
  };
}

export function measureSystemPromptChars(): Record<string, number> {
  const roast: NogPersona = { ...EVAL_PERSONA, grillMode: "roast", speechPhrases: [] };
  const gentle: NogPersona = { ...EVAL_PERSONA, grillMode: "gentle", speechPhrases: [] };
  const samplePage = {
    id: "p-sample",
    nogId: "nog-1",
    topicId: "t-1",
    body: "Sample.",
    wordCount: 1,
    kind: "lesson" as const,
    idempotencyKey: "k-sample",
    createdAt: "2026-11-26T00:00:00.000Z",
    updatedAt: "2026-11-26T00:00:00.000Z",
  };
  return {
    listenerRoast: buildListenerMessages(
      { nogId: "nog-1", topicId: "t-1", page: samplePage, existingCards: [] },
      roast,
      false,
    )[0].content.length,
    listenerGentle: buildListenerMessages(
      { nogId: "nog-1", topicId: "t-1", page: samplePage, existingCards: [] },
      gentle,
      false,
    )[0].content.length,
    answererRoast: buildAnswererMessages(
      {
        nogId: "nog-1",
        topicId: "t-1",
        pages: [],
        cards: [],
        questions: [{ id: "q1", prompt: "Q?" }],
      },
      roast,
      false,
    )[0].content.length,
    answererGentle: buildAnswererMessages(
      {
        nogId: "nog-1",
        topicId: "t-1",
        pages: [],
        cards: [],
        questions: [{ id: "q1", prompt: "Q?" }],
      },
      gentle,
      false,
    )[0].content.length,
    askerRoast: buildAskerMessages(
      { nogId: "nog-1", question: "Q?", cards: [], pages: [] },
      roast,
      false,
    )[0].content.length,
    askerGentle: buildAskerMessages(
      { nogId: "nog-1", question: "Q?", cards: [], pages: [] },
      gentle,
      false,
    )[0].content.length,
    grader: buildGraderMessages({
      topicId: "t-1",
      pages: [],
      questions: [],
      answers: [],
    })[0].content.length,
    questionWriter: buildQuestionWriterMessages({
      subjectName: "S",
      topicTitle: "T",
    })[0].content.length,
  };
}

function sanitizeSegment(raw: string): string {
  return raw.replace(/[^a-z0-9.-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "v";
}

export function reportFileName(
  timestampIso: string,
  versions: PromptVersionsMap,
): string {
  const datePart = sanitizeSegment(timestampIso.slice(0, 10));
  const timePart = sanitizeSegment(timestampIso.slice(11, 19).replaceAll(":", ""));
  const versionPart = [
    versions.listener,
    versions.answerer,
    versions.grader,
    versions.asker,
    versions.questionWriter,
  ]
    .map(sanitizeSegment)
    .join("-");
  return `${datePart}-${timePart}-${versionPart}.json`;
}

export function resolveReportPath(baseDir: string, fileName: string): string {
  const safeBase = resolve(baseDir);
  const safeName = sanitizeSegment(fileName.replace(/\.json$/i, "")) + ".json";
  const candidate = resolve(safeBase, safeName);
  const prefix = safeBase.endsWith(sep) ? safeBase : `${safeBase}${sep}`;
  if (!candidate.startsWith(prefix)) {
    throw new LlmConfigError("Invalid report output path.");
  }
  return candidate;
}

export interface BuildReportInput {
  timestamp: string;
  live: boolean;
  partial?: boolean;
  modelId: string;
  roleModels?: Partial<Record<EvalPort, string>>;
  promptVersions: PromptVersionsMap;
  goldenCaseCount: number;
  delayMs: number;
  outcomes: ReadonlyArray<CaseOutcome>;
  roleUsage?: Partial<Record<EvalPort, Partial<RoleUsageStats>>>;
  systemPromptChars?: Record<string, number>;
}

export function buildReport(input: BuildReportInput): EvalReport {
  if (input.live && input.modelId === "fake") {
    throw new LlmConfigError("--live requires a real provider");
  }

  const summary = summarizeByRole(input.outcomes, {
    requirePerfect: input.modelId === "fake",
    roleUsage: input.roleUsage,
  });

  let calls = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  for (const port of EVAL_PORTS) {
    calls += summary.roles[port].calls;
    promptTokens += summary.roles[port].promptTokens;
    completionTokens += summary.roles[port].completionTokens;
  }

  const cleanRoleModels: Partial<Record<EvalPort, string>> = {};
  if (input.roleModels) {
    for (const port of EVAL_PORTS) {
      const value = input.roleModels[port];
      if (typeof value === "string" && value.trim().length > 0) {
        cleanRoleModels[port] = value.trim();
      }
    }
  }

  return {
    timestamp: input.timestamp,
    live: Boolean(input.live),
    partial: Boolean(input.partial),
    modelId: input.modelId,
    roleModels: cleanRoleModels,
    promptVersions: {
      listener: input.promptVersions.listener,
      answerer: input.promptVersions.answerer,
      asker: input.promptVersions.asker,
      grader: input.promptVersions.grader,
      questionWriter: input.promptVersions.questionWriter,
    },
    goldenCaseCount: input.goldenCaseCount,
    delayMs: input.delayMs,
    systemPromptChars: input.systemPromptChars ?? measureSystemPromptChars(),
    totals: {
      calls,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      fallbackCalls: summary.fallbackCalls,
    },
    overallPassed: summary.overallPassed,
    ...(summary.gateFailureReason
      ? { gateFailureReason: summary.gateFailureReason }
      : {}),
    roles: summary.roles,
    cases: input.outcomes.map((item) => ({
      id: item.id,
      port: item.port,
      required: item.required,
      passed: item.passed,
      ...(item.reason ? { reason: item.reason } : {}),
      ...(!item.passed && item.debugSnippet
        ? { debugSnippet: item.debugSnippet.slice(0, 300) }
        : {}),
    })),
  };
}

function parseCliArgs(argv: ReadonlyArray<string>): {
  live: boolean;
  role?: EvalPort;
  delayRaw?: string;
} {
  let live = false;
  let role: EvalPort | undefined;
  let delayRaw: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--live") {
      live = true;
    } else if (arg === "--role" && argv[i + 1]) {
      const candidate = argv[++i] as EvalPort;
      if (EVAL_PORTS.includes(candidate)) {
        role = candidate;
      } else {
        throw new LlmConfigError(`Unknown --role: ${candidate}`);
      }
    } else if (arg.startsWith("--role=")) {
      const candidate = arg.slice("--role=".length) as EvalPort;
      if (EVAL_PORTS.includes(candidate)) {
        role = candidate;
      } else {
        throw new LlmConfigError(`Unknown --role: ${candidate}`);
      }
    } else if (arg === "--delay-ms" && argv[i + 1]) {
      delayRaw = argv[++i];
    } else if (arg.startsWith("--delay-ms=")) {
      delayRaw = arg.slice("--delay-ms=".length);
    }
  }

  return { live, role, delayRaw };
}

function buildEvalAdapters(
  live: boolean,
  getActivePersona: () => NogPersona,
  onUsage: (event: LlmUsageEvent) => void,
): {
  adapters: LlmAdapters;
  modelId: string;
  roleModels: Partial<Record<EvalPort, string>>;
} {
  const provider = readEnv("LLM_PROVIDER")?.toLowerCase();
  const offlineByDefault = !provider && !live && !readEnv("LLM_BASE_URL");

  if (provider === "fake" || offlineByDefault) {
    if (live) {
      throw new LlmConfigError("--live requires a real provider");
    }
    if (process.env.NODE_ENV === "production") {
      throw new LlmConfigError(
        "LLM_PROVIDER=fake cannot be enabled when NODE_ENV is production.",
      );
    }
    return {
      adapters: createFakeLlmAdapters({
        getPersona: async () => getActivePersona(),
        speechMimicry: true,
      }),
      modelId: "fake",
      roleModels: {},
    };
  }

  const baseUrl = readEnv("LLM_BASE_URL");
  const apiKey = readEnv("LLM_API_KEY");
  const model = readEnv("LLM_MODEL");
  const graderModel = readEnv("LLM_GRADER_MODEL");
  const askerModel = readEnv("LLM_ASKER_MODEL");
  const questionWriterModel = readEnv("LLM_QUESTION_WRITER_MODEL");

  const missing = [
    !baseUrl ? "LLM_BASE_URL" : null,
    !apiKey ? "LLM_API_KEY" : null,
    !model ? "LLM_MODEL" : null,
  ].filter((item): item is string => item !== null);

  if (missing.length > 0) {
    throw new LlmConfigError(
      `Missing required language provider configuration: ${missing.join(", ")}`,
    );
  }

  const fallbackBaseUrl = readEnv("LLM_FALLBACK_BASE_URL");
  const fallbackModel = readEnv("LLM_FALLBACK_MODEL");
  const fallbackApiKey = readEnv("LLM_FALLBACK_API_KEY");

  const fallback =
    fallbackBaseUrl && fallbackModel
      ? {
          baseUrl: validateHttpUrl("LLM_FALLBACK_BASE_URL", fallbackBaseUrl),
          apiKey: fallbackApiKey,
          model: fallbackModel,
        }
      : undefined;

  const adapterRoleModels: {
    grader?: string;
    asker?: string;
    questionWriter?: string;
  } = {};
  const roleModels: Partial<Record<EvalPort, string>> = {};
  if (graderModel) {
    adapterRoleModels.grader = graderModel;
    roleModels.grader = graderModel;
  }
  if (askerModel) {
    adapterRoleModels.asker = askerModel;
    roleModels.asker = askerModel;
  }
  if (questionWriterModel) {
    adapterRoleModels.questionWriter = questionWriterModel;
    roleModels["question-writer"] = questionWriterModel;
  }

  return {
    adapters: createOpenAiCompatibleAdapters(
      {
        primary: {
          baseUrl: validateHttpUrl("LLM_BASE_URL", baseUrl!),
          apiKey: apiKey!,
          model: model!,
        },
        fallback,
        ...(Object.keys(adapterRoleModels).length > 0
          ? { roleModels: adapterRoleModels }
          : {}),
      },
      {
        getPersona: async () => getActivePersona(),
        speechMimicry: true,
        onUsage,
      },
    ),
    modelId: model!,
    roleModels,
  };
}

function operationMatchesPartial(
  actual: DigestOperation,
  expected: Partial<DigestOperation>,
): boolean {
  const actualRecord = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    if (value !== undefined && actualRecord[key] !== value) {
      return false;
    }
  }
  return true;
}

export function evaluateListenerOutput(
  testCase: Extract<GoldenCase, { port: "listener" }>,
  actual: ListenerDigest,
): { passed: boolean; reason?: string; debugSnippet?: string } {
  const { expected } = testCase;
  const snippet = actual.reply.slice(0, 300);

  if (
    expected.offTopic !== undefined &&
    (actual.offTopic ?? false) !== expected.offTopic
  ) {
    return { passed: false, reason: "unexpected topic fit verdict", debugSnippet: snippet };
  }

  if (expected.output !== undefined) {
    if (!isDeepStrictEqual(actual, expected.output)) {
      return { passed: false, reason: "output mismatch", debugSnippet: snippet };
    }
  }

  if (expected.operation !== undefined) {
    const matched = actual.operations.some((op) =>
      operationMatchesPartial(op, expected.operation!),
    );
    if (!matched) {
      return {
        passed: false,
        reason: "expected operation not found",
        debugSnippet: JSON.stringify(actual.operations).slice(0, 300),
      };
    }
  }

  if (expected.operationStatuses !== undefined) {
    const allowed = new Set(expected.operationStatuses);
    const hasStatus = actual.operations.some(
      (op) => "status" in op && op.status !== undefined && allowed.has(op.status),
    );
    if (!hasStatus) {
      return {
        passed: false,
        reason: "expected operation status not found",
        debugSnippet: JSON.stringify(actual.operations).slice(0, 300),
      };
    }
  }

  if (expected.minFollowUpQuestions !== undefined) {
    if (actual.followUpQuestions.length < expected.minFollowUpQuestions) {
      return {
        passed: false,
        reason: "insufficient follow-up questions",
        debugSnippet: snippet,
      };
    }
  }

  if (expected.followUpPatterns !== undefined) {
    for (const pattern of expected.followUpPatterns) {
      const regex = compileSafeRegex(pattern);
      if (!regex) {
        return { passed: false, reason: "invalid pattern" };
      }
      if (!actual.followUpQuestions.some((q) => regex.test(q))) {
        return {
          passed: false,
          reason: "follow-up did not match pattern",
          debugSnippet: actual.followUpQuestions.join(" | ").slice(0, 300),
        };
      }
    }
  }

  if (expected.minCreateOps !== undefined) {
    const createCount = actual.operations.filter((op) => op.type === "create").length;
    if (createCount < expected.minCreateOps) {
      return {
        passed: false,
        reason: "insufficient create operations",
        debugSnippet: JSON.stringify(actual.operations).slice(0, 300),
      };
    }
  }

  if (expected.replyPatterns !== undefined) {
    for (const pattern of expected.replyPatterns) {
      const regex = compileSafeRegex(pattern);
      if (!regex) {
        return { passed: false, reason: "invalid pattern" };
      }
      if (!regex.test(actual.reply)) {
        return {
          passed: false,
          reason: "reply did not match pattern",
          debugSnippet: snippet,
        };
      }
    }
  }

  if (expected.replyNotMatch !== undefined) {
    for (const pattern of expected.replyNotMatch) {
      const regex = compileSafeRegex(pattern);
      if (!regex) {
        return { passed: false, reason: "invalid pattern" };
      }
      if (regex.test(actual.reply)) {
        return {
          passed: false,
          reason: "reply matched forbidden pattern",
          debugSnippet: snippet,
        };
      }
    }
  }

  if (expected.allQuotesGrounded && actual.operations.length === 0) {
    return {
      passed: false,
      reason: "expected at least one grounded operation",
      debugSnippet: snippet,
    };
  }

  const ungrounded = actual.operations.some(
    (op) =>
      "quote" in op &&
      op.quote !== undefined &&
      groundQuote(testCase.input.page.body, op.quote) === null,
  );
  if (ungrounded) {
    return {
      passed: false,
      reason: "operation quote not found in lesson page",
      debugSnippet: JSON.stringify(actual.operations).slice(0, 300),
    };
  }

  return { passed: true };
}

function evaluateAskerOutput(
  { expected }: Extract<GoldenCase, { port: "asker" }>,
  { knows, citedCardIds, answer }: AskOutput,
): { passed: boolean; reason?: string; debugSnippet?: string } {
  const snippet = answer.slice(0, 300);
  if (knows !== expected.knows) {
    return { passed: false, reason: "unexpected knowledge verdict", debugSnippet: snippet };
  }
  const validCitations = knows
    ? citedCardIds.length > 0 &&
      citedCardIds.every((id) => expected.citedCardIds.includes(id))
    : citedCardIds.length === 0;
  if (!validCitations) {
    return {
      passed: false,
      reason: "unexpected citations",
      debugSnippet: JSON.stringify(citedCardIds).slice(0, 300),
    };
  }
  if (expected.answerPattern) {
    const regex = compileSafeRegex(expected.answerPattern);
    if (!regex) {
      return { passed: false, reason: "invalid pattern" };
    }
    if (!regex.test(answer)) {
      return {
        passed: false,
        reason: "answer did not match expected pattern",
        debugSnippet: snippet,
      };
    }
  }
  if (expected.answerNotMatch) {
    for (const pattern of expected.answerNotMatch) {
      const regex = compileSafeRegex(pattern);
      if (!regex) {
        return { passed: false, reason: "invalid pattern" };
      }
      if (regex.test(answer)) {
        return {
          passed: false,
          reason: "answer matched forbidden pattern",
          debugSnippet: snippet,
        };
      }
    }
  }
  return { passed: true };
}

function mapUsageRoleToPort(role: LlmUsageEvent["role"]): EvalPort {
  return role;
}

export interface RunEvalOptions {
  live?: boolean;
  role?: EvalPort;
  delayMs?: number;
  writeReport?: boolean;
  cases?: GoldenCase[];
}

export async function runEval(options: RunEvalOptions = {}): Promise<boolean> {
  const cli = parseCliArgs(process.argv.slice(2));
  const live = options.live ?? cli.live;
  const onlyRole = options.role ?? cli.role;
  const delayMs =
    options.delayMs !== undefined
      ? parseDelayMs(options.delayMs, live)
      : parseDelayMs(cli.delayRaw ?? readEnv("EVAL_DELAY_MS"), live);

  const goldenPath = new URL("../evals/golden.json", import.meta.url);
  const suite = options.cases
    ? { cases: options.cases }
    : (JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenSuite);

  const selectedCases = onlyRole
    ? suite.cases.filter((item) => item.port === onlyRole)
    : suite.cases;

  const roleUsage = emptyRoleUsage();
  const totals = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  let activePersona: NogPersona = { ...EVAL_PERSONA, speechPhrases: [] };
  let expectedModelForPort: (port: EvalPort) => string = () => "fake";
  // Server-header-driven rate-limit pacer (reads x-ratelimit-remaining-tokens
  // and x-ratelimit-reset-tokens directly so we never send a request whose
  // prompt + max_tokens reserve exceeds the provider's remaining bucket).
  const LIVE_ROLE_RESERVE_TOKENS: Record<EvalPort, number> = {
    listener: 2_600,
    answerer: 2_400,
    grader: 2_900,
    asker: 1_600,
    "question-writer": 2_800,
  };
  let lastRemainingTokens: number | null = null;
  let lastRateLimitAt = 0;
  let lastRateLimitResetMs = 0;
  let lastCallFailed = false;

  const { adapters, modelId, roleModels } = buildEvalAdapters(
    live,
    () => activePersona,
    (event) => {
      const port = mapUsageRoleToPort(event.role);
      if (live) {
        if (typeof event.rateLimitRemainingTokens === "number") {
          lastRemainingTokens = event.rateLimitRemainingTokens;
          lastRateLimitAt = Date.now();
          lastRateLimitResetMs = Math.min(
            MAX_DELAY_MS,
            Math.max(0, event.rateLimitResetTokensMs ?? 60_000),
          );
        }
        if (event.totalTokens === 0) {
          lastCallFailed = true;
        }
      }
      totals.calls += 1;
      totals.promptTokens += event.promptTokens;
      totals.completionTokens += event.completionTokens;
      totals.totalTokens += event.totalTokens;
      roleUsage[port].calls += 1;
      roleUsage[port].promptTokens += event.promptTokens;
      roleUsage[port].completionTokens += event.completionTokens;
      if (live) {
        const expected = expectedModelForPort(port);
        if (event.model !== expected) {
          roleUsage[port].fallbackCalls += 1;
        }
      }
    },
  );

  expectedModelForPort = (port: EvalPort) => roleModels[port] ?? modelId;

  const promptVersions: PromptVersionsMap = {
    listener: LISTENER_PROMPT_VERSION,
    answerer: ANSWERER_PROMPT_VERSION,
    asker: ASKER_PROMPT_VERSION,
    grader: GRADER_PROMPT_VERSION,
    questionWriter: QUESTION_WRITER_PROMPT_VERSION,
  };

  console.log(`Model: ${modelId}`);
  console.log(
    `Prompt versions: listener=${promptVersions.listener}, answerer=${promptVersions.answerer}, asker=${promptVersions.asker}, grader=${promptVersions.grader}, questionWriter=${promptVersions.questionWriter}`,
  );
  if (onlyRole) {
    console.log(`Partial run (${onlyRole}): not a gate run`);
  }

  const graderResults = new Map<string, GraderResult>();
  const outcomes: CaseOutcome[] = [];
  let providerCallsStarted = 0;

  for (const testCase of selectedCases) {
    const required = Boolean(testCase.required);
    const personaCheck = validatePersonaOverride(testCase.persona);
    if (!personaCheck.ok) {
      outcomes.push({
        id: testCase.id,
        port: testCase.port,
        required,
        passed: false,
        reason: personaCheck.reason,
      });
      console.log(`FAIL ${testCase.id} — ${personaCheck.reason}`);
      continue;
    }

    const usesProviderCall =
      testCase.port !== "listener" || testCase.providerResponse === undefined;
    if (usesProviderCall && providerCallsStarted > 0 && delayMs > 0) {
      await new Promise((resolveTimer) => setTimeout(resolveTimer, delayMs));
      if (live) {
        if (lastCallFailed) {
          await new Promise((resolveTimer) => setTimeout(resolveTimer, 15_000));
        }
        const reserve = LIVE_ROLE_RESERVE_TOKENS[testCase.port];
        if (lastRemainingTokens !== null && lastRemainingTokens < reserve) {
          const resetTarget = lastRateLimitAt + lastRateLimitResetMs + 1_000;
          while (Date.now() < resetTarget) {
            const sleepMs = Math.min(
              MAX_DELAY_MS,
              Math.max(250, resetTarget - Date.now()),
            );
            await new Promise((resolveTimer) => setTimeout(resolveTimer, sleepMs));
          }
          lastRemainingTokens = null;
        }
      }
    }
    if (usesProviderCall) {
      lastCallFailed = false;
      providerCallsStarted += 1;
    }

    activePersona = personaCheck.value;
    try {
      if (testCase.port === "listener") {
        let digest: ListenerDigest;
        if (testCase.providerResponse !== undefined) {
          const parsed = parseListenerDigest(testCase.providerResponse);
          if (!parsed.ok) {
            outcomes.push({
              id: testCase.id,
              port: testCase.port,
              required,
              passed: false,
              reason: parsed.error,
            });
            console.log(`FAIL ${testCase.id} — ${parsed.error}`);
            continue;
          }
          digest = parsed.value;
        } else {
          digest = await adapters.listener.listen(testCase.input);
        }

        const check = evaluateListenerOutput(testCase, digest);
        outcomes.push({ id: testCase.id, port: testCase.port, required, ...check });
        console.log(
          check.passed
            ? `PASS ${testCase.id}`
            : `FAIL ${testCase.id} — ${check.reason ?? "failed"}`,
        );
      } else if (testCase.port === "asker") {
        if (!adapters.asker) {
          outcomes.push({
            id: testCase.id,
            port: testCase.port,
            required,
            passed: false,
            reason: "asker adapter not configured",
          });
          console.log(`FAIL ${testCase.id} — asker adapter not configured`);
          continue;
        }
        const result = await adapters.asker.ask(testCase.input);
        const check = evaluateAskerOutput(testCase, result);
        outcomes.push({ id: testCase.id, port: testCase.port, required, ...check });
        console.log(
          check.passed
            ? `PASS ${testCase.id}`
            : `FAIL ${testCase.id} — ${check.reason ?? "failed"}`,
        );
      } else if (testCase.port === "answerer") {
        const result = await adapters.brain.answer(testCase.input);
        const byId = new Map(
          result.answers.map((entry) => [entry.questionId, entry.nogAnswer]),
        );
        let reason: string | undefined;
        let debugSnippet: string | undefined;
        for (const expectedAnswer of testCase.expected.answers) {
          const actualAnswer = byId.get(expectedAnswer.questionId);
          if (actualAnswer === undefined) {
            reason = `missing answer for ${expectedAnswer.questionId}`;
            break;
          }
          const regex = compileSafeRegex(expectedAnswer.nogAnswerPattern);
          if (!regex) {
            reason = "invalid pattern";
            break;
          }
          if (!regex.test(actualAnswer)) {
            reason = `answer for ${expectedAnswer.questionId} did not match expected pattern`;
            debugSnippet = actualAnswer.slice(0, 300);
            break;
          }
          if (expectedAnswer.nogAnswerNotMatch) {
            for (const forbidden of expectedAnswer.nogAnswerNotMatch) {
              const forbidRegex = compileSafeRegex(forbidden);
              if (!forbidRegex) {
                reason = "invalid pattern";
                break;
              }
              if (forbidRegex.test(actualAnswer)) {
                reason = `answer for ${expectedAnswer.questionId} matched forbidden pattern`;
                debugSnippet = actualAnswer.slice(0, 300);
                break;
              }
            }
            if (reason) break;
          }
        }
        const passed = reason === undefined;
        outcomes.push({
          id: testCase.id,
          port: testCase.port,
          required,
          passed,
          reason,
          debugSnippet,
        });
        console.log(
          passed ? `PASS ${testCase.id}` : `FAIL ${testCase.id} — ${reason}`,
        );
      } else if (testCase.port === "question-writer") {
        if (!adapters.questionWriter) {
          outcomes.push({
            id: testCase.id,
            port: testCase.port,
            required,
            passed: false,
            reason: "questionWriter adapter not configured",
          });
          console.log(
            `FAIL ${testCase.id} — questionWriter adapter not configured`,
          );
          continue;
        }
        const generated = await adapters.questionWriter.generate(testCase.input);
        const schemaCheck = questionWriterResponseSchema.safeParse({
          questions: generated.map(
            ({ prompt, referenceAnswer, sourceExcerpt, keyConcepts }) => ({
              prompt,
              referenceAnswer,
              sourceExcerpt,
              keyConcepts,
            }),
          ),
        });
        const expectedCount = testCase.expected?.questionCount ?? 8;
        const positionsValid =
          generated.length === expectedCount &&
          generated.every((item, index) => item.position === index + 1);
        const passed = schemaCheck.success && positionsValid;
        const reason = !schemaCheck.success
          ? "generated questions failed schema validation"
          : !positionsValid
            ? "generated questions had invalid count or positions"
            : undefined;
        outcomes.push({ id: testCase.id, port: testCase.port, required, passed, reason });
        console.log(
          passed ? `PASS ${testCase.id}` : `FAIL ${testCase.id} — ${reason}`,
        );
      } else {
        const result = await adapters.grader.grade(testCase.input);
        graderResults.set(testCase.id, result);

        let passed = isDeepStrictEqual(result, testCase.expected.output);
        let reason: string | undefined = passed ? undefined : "grade verdict mismatch";
        const debugSnippet = passed ? undefined : JSON.stringify(result).slice(0, 300);

        if (passed && testCase.expected.sameVerdictAs) {
          const baseline = graderResults.get(testCase.expected.sameVerdictAs);
          if (!baseline || !isDeepStrictEqual(result, baseline)) {
            passed = false;
            reason = `verdict diverged from ${testCase.expected.sameVerdictAs}`;
          }
        }

        outcomes.push({
          id: testCase.id,
          port: testCase.port,
          required,
          passed,
          reason,
          debugSnippet,
        });
        console.log(
          passed ? `PASS ${testCase.id}` : `FAIL ${testCase.id} — ${reason}`,
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.name : "unexpected error";
      outcomes.push({
        id: testCase.id,
        port: testCase.port,
        required,
        passed: false,
        reason,
      });
      console.log(`FAIL ${testCase.id} — ${reason}`);
    } finally {
      activePersona = { ...EVAL_PERSONA, speechPhrases: [] };
    }
  }

  const summary = summarizeByRole(outcomes, {
    requirePerfect: modelId === "fake",
    onlyRole,
    roleUsage,
  });

  const portsToLog = onlyRole ? [onlyRole] : EVAL_PORTS;
  for (const port of portsToLog) {
    const stat = summary.roles[port];
    console.log(
      `Role ${port}: ${stat.passed}/${stat.n} (misses ${stat.misses}/${stat.allowedMisses}) ${stat.ok ? "ok" : "over"}`,
    );
  }

  const passRate =
    summary.totalCount > 0 ? summary.passedCount / summary.totalCount : 0;
  const avgTokens =
    totals.calls > 0 ? Math.round(totals.totalTokens / totals.calls) : 0;
  const inputRatePerMillion = readNonNegativeNumberEnv("LLM_INPUT_COST_PER_1M");
  const outputRatePerMillion = readNonNegativeNumberEnv(
    "LLM_OUTPUT_COST_PER_1M",
  );
  const totalCostUsd =
    (totals.promptTokens * inputRatePerMillion +
      totals.completionTokens * outputRatePerMillion) /
    1_000_000;
  const costPerCallUsd = totals.calls > 0 ? totalCostUsd / totals.calls : 0;

  console.log(
    `Summary: ${summary.passedCount}/${summary.totalCount} passed (${Math.round(passRate * 100)}%), required: ${summary.requiredPassedCount}/${summary.requiredCount}`,
  );
  console.log(
    `Tokens: prompt=${totals.promptTokens}, completion=${totals.completionTokens}, total=${totals.totalTokens} (avg ${avgTokens} tokens/call across ${totals.calls} calls, est. $${costPerCallUsd.toFixed(6)}/call)`,
  );
  if (summary.gateFailureReason) {
    console.log(`Gate: ${summary.gateFailureReason}`);
  }

  const shouldWriteReport = (options.writeReport ?? live) && !onlyRole;
  if (shouldWriteReport) {
    const timestamp = new Date().toISOString();
    const report = buildReport({
      timestamp,
      live,
      partial: false,
      modelId,
      roleModels,
      promptVersions,
      goldenCaseCount: selectedCases.length,
      delayMs,
      outcomes,
      roleUsage,
    });
    const resultsDir = fileURLToPath(new URL("../evals/results", import.meta.url));
    mkdirSync(resultsDir, { recursive: true });
    const fileName = reportFileName(timestamp, promptVersions);
    const outPath = resolveReportPath(resultsDir, fileName);
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report saved: evals/results/${fileName}`);
  }

  process.exitCode = summary.overallPassed ? 0 : 1;
  return summary.overallPassed;
}

function isDirectEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }
  const current = resolve(fileURLToPath(import.meta.url));
  const target = resolve(invoked);
  return process.platform === "win32"
    ? current.toLowerCase() === target.toLowerCase()
    : current === target;
}

if (isDirectEntryPoint()) {
  void runEval().catch((error) => {
    const message =
      error instanceof LlmConfigError ? error.message : "Eval failed";
    console.error(message);
    process.exitCode = 1;
  });
}
