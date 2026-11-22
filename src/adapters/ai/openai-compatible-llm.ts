import type {
  AnswerGrader,
  AnswerInput,
  BrainAnswerResult,
  GradeInput,
  GraderResult,
  ListenInput,
  ListenerDigest,
  NogBrain,
  NogListener,
} from "@/core/application/ports";
import {
  buildAnswererMessages,
  PROMPT_VERSION as ANSWERER_PROMPT_VERSION,
} from "./prompts/answerer";
import {
  buildGraderMessages,
  PROMPT_VERSION as GRADER_PROMPT_VERSION,
} from "./prompts/grader";
import {
  buildListenerMessages,
  PROMPT_VERSION as LISTENER_PROMPT_VERSION,
  type ChatMessage,
  type NogPersona,
} from "./prompts/listener";
import {
  BRAIN_FOG_DIGEST,
  NOT_TAUGHT_ANSWER,
  parseBrainAnswers,
  parseGraderResult,
  parseJsonContent,
  parseListenerDigest,
  type ParseResult,
} from "./schemas";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRY_AFTER_MS = 5_000;
const DETERMINISTIC_SEED = 7;

export type LlmRole = "listener" | "answerer" | "grader";

export interface OpenAiCompatibleEndpoint {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface OpenAiCompatibleConfig {
  primary: OpenAiCompatibleEndpoint;
  fallback?: OpenAiCompatibleEndpoint;
}

export interface LlmUsageEvent {
  role: LlmRole;
  model: string;
  promptVersion: string;
  latencyMs: number;
  status: number | "timeout" | "network_error" | "invalid_output";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmAdapterOptions {
  getPersona: (nogId: string) => Promise<NogPersona>;
  speechMimicry: boolean;
  onUsage?: (event: LlmUsageEvent) => void;
}

export interface LlmAdapters {
  listener: NogListener;
  brain: NogBrain;
  grader: AnswerGrader;
}

export class NogSleepyError extends Error {
  constructor(message = "Language provider is temporarily unavailable.") {
    super(message);
    this.name = "NogSleepyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GraderOutputError extends Error {
  constructor(message = "Grader returned an invalid response format.") {
    super(message);
    this.name = "GraderOutputError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface RoleRequestParams {
  role: LlmRole;
  promptVersion: string;
  temperature: number;
  maxTokens: number;
}

interface TransportSuccess {
  ok: true;
  content: string;
  endpoint: OpenAiCompatibleEndpoint;
}

interface TransportFailure {
  ok: false;
  retryable: boolean;
  retryAfterMs: number | null;
}

function normalizeCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }
  const trimmed = headerValue.trim();
  if (!trimmed) {
    return null;
  }
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return seconds > 0 ? Math.round(seconds * 1000) : null;
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    const delta = timestamp - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractUsage(payload: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (typeof payload !== "object" || payload === null) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const usage = (payload as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const record = usage as Record<string, unknown>;
  const promptTokens =
    typeof record.prompt_tokens === "number" && Number.isFinite(record.prompt_tokens)
      ? record.prompt_tokens
      : 0;
  const completionTokens =
    typeof record.completion_tokens === "number" &&
    Number.isFinite(record.completion_tokens)
      ? record.completion_tokens
      : 0;
  const totalTokens =
    typeof record.total_tokens === "number" && Number.isFinite(record.total_tokens)
      ? record.total_tokens
      : promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}

function extractMessageContent(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  return typeof first?.message?.content === "string"
    ? first.message.content
    : "";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "TimeoutError"
  ) {
    return true;
  }
  return false;
}

function buildFixJsonMessage(reason: string): ChatMessage {
  return {
    role: "user",
    content: `Your previous response was invalid JSON or did not match the required schema (${reason}). Fix and return ONLY one valid JSON object matching the exact schema, length limits, and plain-text rules with no extra fields.`,
  };
}

export function createOpenAiCompatibleAdapters(
  config: OpenAiCompatibleConfig,
  options: LlmAdapterOptions,
): LlmAdapters {
  function recordUsage(event: LlmUsageEvent): void {
    options.onUsage?.(event);
    console.info({
      event: "llm_call",
      role: event.role,
      model: event.model,
      promptVersion: event.promptVersion,
      latencyMs: event.latencyMs,
      status: event.status,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
    });
  }

  async function postCompletion(
    endpoint: OpenAiCompatibleEndpoint,
    messages: ChatMessage[],
    params: RoleRequestParams,
  ): Promise<TransportSuccess | TransportFailure> {
    const startedAt = Date.now();
    const url = normalizeCompletionsUrl(endpoint.baseUrl);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (endpoint.apiKey && endpoint.apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${endpoint.apiKey}`;
    }

    const body = JSON.stringify({
      model: endpoint.model,
      messages,
      response_format: { type: "json_object" },
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      seed: DETERMINISTIC_SEED,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      recordUsage({
        role: params.role,
        model: endpoint.model,
        promptVersion: params.promptVersion,
        latencyMs,
        status: isTimeoutError(error) ? "timeout" : "network_error",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      return { ok: false, retryable: true, retryAfterMs: null };
    }

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      recordUsage({
        role: params.role,
        model: endpoint.model,
        promptVersion: params.promptVersion,
        latencyMs,
        status: response.status,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      return {
        ok: false,
        retryable: isRetryableStatus(response.status),
        retryAfterMs,
      };
    }

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      recordUsage({
        role: params.role,
        model: endpoint.model,
        promptVersion: params.promptVersion,
        latencyMs,
        status: "invalid_output",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      return { ok: true, content: "", endpoint };
    }

    const usage = extractUsage(payload);
    recordUsage({
      role: params.role,
      model: endpoint.model,
      promptVersion: params.promptVersion,
      latencyMs,
      status: response.status,
      ...usage,
    });

    return {
      ok: true,
      content: extractMessageContent(payload),
      endpoint,
    };
  }

  async function callWithFallback(
    messages: ChatMessage[],
    params: RoleRequestParams,
  ): Promise<TransportSuccess> {
    const first = await postCompletion(config.primary, messages, params);
    if (first.ok) {
      return first;
    }

    if (!first.retryable) {
      throw new NogSleepyError();
    }

    if (
      first.retryAfterMs !== null &&
      first.retryAfterMs > 0 &&
      first.retryAfterMs <= MAX_RETRY_AFTER_MS
    ) {
      await sleep(first.retryAfterMs);
    }

    const nextEndpoint = config.fallback ?? (first.retryAfterMs !== null && first.retryAfterMs <= MAX_RETRY_AFTER_MS ? config.primary : undefined);
    if (!nextEndpoint) {
      throw new NogSleepyError();
    }

    const second = await postCompletion(nextEndpoint, messages, params);
    if (second.ok) {
      return second;
    }

    throw new NogSleepyError();
  }

  async function executeStructuredCall<T>(
    messages: ChatMessage[],
    params: RoleRequestParams,
    parse: (data: unknown, model: string) => ParseResult<T>,
  ): Promise<{ ok: true; value: T; model: string } | { ok: false; model: string }> {
    const initial = await callWithFallback(messages, params);
    const firstJson = parseJsonContent(initial.content);
    const firstParsed = firstJson.ok
      ? parse(firstJson.value, initial.endpoint.model)
      : firstJson;

    if (firstParsed.ok) {
      return {
        ok: true,
        value: firstParsed.value,
        model: initial.endpoint.model,
      };
    }

    const retryMessages: ChatMessage[] = [
      ...messages,
      buildFixJsonMessage(firstParsed.error),
    ];
    const retryResponse = await postCompletion(
      initial.endpoint,
      retryMessages,
      params,
    );
    if (!retryResponse.ok) {
      throw new NogSleepyError();
    }

    const retryJson = parseJsonContent(retryResponse.content);
    const retryParsed = retryJson.ok
      ? parse(retryJson.value, initial.endpoint.model)
      : retryJson;

    if (retryParsed.ok) {
      return {
        ok: true,
        value: retryParsed.value,
        model: initial.endpoint.model,
      };
    }

    return { ok: false, model: initial.endpoint.model };
  }

  const listener: NogListener = {
    async listen(input: ListenInput): Promise<ListenerDigest> {
      const persona = await options.getPersona(input.nogId);
      const messages = buildListenerMessages(
        input,
        persona,
        options.speechMimicry,
      );
      const outcome = await executeStructuredCall(
        messages,
        {
          role: "listener",
          promptVersion: LISTENER_PROMPT_VERSION,
          temperature: 0.6,
          maxTokens: 600,
        },
        (data) => parseListenerDigest(data),
      );
      if (outcome.ok) {
        return outcome.value;
      }
      return {
        reply: BRAIN_FOG_DIGEST.reply,
        mood: BRAIN_FOG_DIGEST.mood,
        followUpQuestions: [],
        operations: [],
      };
    },
  };

  const brain: NogBrain = {
    async answer(input: AnswerInput): Promise<BrainAnswerResult> {
      const persona = await options.getPersona(input.nogId);
      const messages = buildAnswererMessages(
        input,
        persona,
        options.speechMimicry,
      );
      const outcome = await executeStructuredCall(
        messages,
        {
          role: "answerer",
          promptVersion: ANSWERER_PROMPT_VERSION,
          temperature: 0.4,
          maxTokens: 900,
        },
        (data, model) => parseBrainAnswers(data, input.questions, model),
      );
      if (outcome.ok) {
        return outcome.value;
      }
      return {
        answers: input.questions.map((question) => ({
          questionId: question.id,
          nogAnswer: NOT_TAUGHT_ANSWER,
        })),
        model: outcome.model,
      };
    },
  };

  const grader: AnswerGrader = {
    async grade(input: GradeInput): Promise<GraderResult> {
      const messages = buildGraderMessages(input);
      const outcome = await executeStructuredCall(
        messages,
        {
          role: "grader",
          promptVersion: GRADER_PROMPT_VERSION,
          temperature: 0,
          maxTokens: 900,
        },
        (data) => parseGraderResult(data, input.questions),
      );
      if (outcome.ok) {
        return outcome.value;
      }
      throw new GraderOutputError(
        "Grader failed schema validation after JSON repair retry.",
      );
    },
  };

  return { listener, brain, grader };
}
