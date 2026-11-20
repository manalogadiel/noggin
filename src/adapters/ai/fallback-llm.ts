import "server-only";
import { createFakeLlmAdapters } from "./fake-llm";
import {
  createOpenAiCompatibleAdapters,
  GraderOutputError,
  LlmConfigError,
  NogSleepyError,
  type LlmAdapterOptions,
  type LlmAdapters,
  type OpenAiCompatibleConfig,
  type OpenAiCompatibleEndpoint,
} from "./openai-compatible-llm";
import type { NogPersona } from "./prompts/listener";

export {
  GraderOutputError,
  LlmConfigError,
  NogSleepyError,
  type LlmAdapterOptions,
  type LlmAdapters,
  type NogPersona,
};

function readNonEmptyEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function assertFakeNotAllowedInProduction(): void {
  const provider = readNonEmptyEnv("LLM_PROVIDER")?.toLowerCase();
  if (provider === "fake" && process.env.NODE_ENV === "production") {
    throw new LlmConfigError(
      "LLM_PROVIDER=fake cannot be enabled when NODE_ENV is production.",
    );
  }
}

assertFakeNotAllowedInProduction();

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

function readProviderConfigFromEnv(): OpenAiCompatibleConfig {
  const baseUrl = readNonEmptyEnv("LLM_BASE_URL");
  const apiKey = readNonEmptyEnv("LLM_API_KEY");
  const model = readNonEmptyEnv("LLM_MODEL");

  const missing: string[] = [];
  if (!baseUrl) missing.push("LLM_BASE_URL");
  if (!apiKey) missing.push("LLM_API_KEY");
  if (!model) missing.push("LLM_MODEL");

  if (missing.length > 0) {
    throw new LlmConfigError(
      `Missing required language provider configuration: ${missing.join(", ")}`,
    );
  }

  const primary: OpenAiCompatibleEndpoint = {
    baseUrl: validateHttpUrl("LLM_BASE_URL", baseUrl!),
    apiKey: apiKey!,
    model: model!,
  };

  const fallbackBaseUrl = readNonEmptyEnv("LLM_FALLBACK_BASE_URL");
  const fallbackModel = readNonEmptyEnv("LLM_FALLBACK_MODEL");
  const fallbackApiKey = readNonEmptyEnv("LLM_FALLBACK_API_KEY");

  let fallback: OpenAiCompatibleEndpoint | undefined;
  if (fallbackBaseUrl || fallbackModel) {
    if (!fallbackBaseUrl || !fallbackModel) {
      const missingFallback = !fallbackBaseUrl
        ? "LLM_FALLBACK_BASE_URL"
        : "LLM_FALLBACK_MODEL";
      throw new LlmConfigError(
        `Incomplete fallback language provider configuration: missing ${missingFallback}`,
      );
    }
    fallback = {
      baseUrl: validateHttpUrl("LLM_FALLBACK_BASE_URL", fallbackBaseUrl),
      apiKey: fallbackApiKey,
      model: fallbackModel,
    };
  }

  return { primary, fallback };
}

export function createLlmAdapters(options: LlmAdapterOptions): LlmAdapters {
  assertFakeNotAllowedInProduction();

  const provider = readNonEmptyEnv("LLM_PROVIDER")?.toLowerCase();
  if (provider === "fake") {
    return createFakeLlmAdapters(options);
  }
  if (provider && provider !== "openai-compatible") {
    throw new LlmConfigError("Unsupported LLM_PROVIDER configuration value.");
  }

  const config = readProviderConfigFromEnv();
  return createOpenAiCompatibleAdapters(config, options);
}
