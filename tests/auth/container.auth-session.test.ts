/// <reference types="vite/client" />
import { inspect } from "node:util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LlmAdapterOptions, LlmAdapters } from "@/adapters/ai/fallback-llm";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import type { ListNogsResult } from "@/core/application/use-cases/list-nogs";
import type { RunQuickCheckInput, RunQuickCheckResult } from "@/core/application/use-cases/run-quick-check";
import type { TeachLessonInput, TeachLessonResult } from "@/core/application/use-cases/teach-lesson";

const { createServerSupabaseClient, createServiceSupabaseClient, createSupabaseRepositories, createLlmAdapters } =
  vi.hoisted(() => ({
    createServerSupabaseClient: vi.fn(),
    createServiceSupabaseClient: vi.fn(),
    createSupabaseRepositories: vi.fn(),
    createLlmAdapters: vi.fn<(options: LlmAdapterOptions) => LlmAdapters>(),
  }));
vi.mock("server-only", () => ({}));
vi.mock("@/adapters/supabase/server-client", () => ({ createServerSupabaseClient }));
vi.mock("@/adapters/supabase/service-client", () => ({ createServiceSupabaseClient }));
vi.mock("@/adapters/supabase/repositories", () => ({ createSupabaseRepositories }));
vi.mock("@/adapters/ai/fallback-llm", () => ({ createLlmAdapters }));

type Container = {
  listNogs(): Promise<ListNogsResult>;
  teachLesson(input: TeachLessonInput): Promise<TeachLessonResult>;
  runQuickCheck(input: RunQuickCheckInput): Promise<RunQuickCheckResult>;
};
const entries = import.meta.glob<{
  createContainer(): Promise<Container>;
}>("../../src/composition/container.ts");

async function createContainer() {
  const load = entries["../../src/composition/container.ts"];
  if (!load) throw new Error("Missing auth entry point: src/composition/container.ts");
  return (await load()).createContainer();
}

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://fixture-supabase.example.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  LLM_BASE_URL: "https://fixture-provider.example.test/v1",
  LLM_API_KEY: "fixture-provider-key",
  LLM_MODEL: "fixture-model",
};

const userId = "4fb6862d-eec5-4eb4-8dd3-d0058ce2aed6";
const nogId = "6d602b7e-e9d3-42cb-9afb-d2fc5f796ae6";
const topicId = "1e15d51d-47d6-4f53-b7eb-19deb0721e57";
const phrases = ["bale gets"];
const nog = {
  id: nogId, ownerId: userId, subjectId: "networking", name: "Pip", stage: "sprout" as const,
  speechStyle: { phrases },
};

function mockDependencies(speechMimicry = false, grillMode = "gentle") {
  const { deps } = createInMemoryPorts({
    userId,
    nogs: [nog],
    questions: [{
      id: "syn-question", topicId, prompt: "What starts the handshake?",
      referenceAnswer: "The client sends SYN.", sourceExcerpt: "The client sends SYN.", keyConcepts: ["SYN"],
    }],
  });
  const profile = { id: userId, grillMode };
  const features = { speech_mimicry: speechMimicry };
  const rows: Record<string, Record<string, unknown>> = {
    profiles: { id: userId, grill_mode: profile.grillMode },
    app_config: { key: "features", value: features },
    nogs: { id: nogId, owner_id: userId, name: nog.name, stage: nog.stage, speech_style: nog.speechStyle },
  };
  const session = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from(table: string) {
      let row: Record<string, unknown> | undefined = rows[table];
      const result = async () => ({ data: row ?? null, error: null });
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          if (row?.[column] !== value) row = undefined;
          return query;
        },
        single: result,
        maybeSingle: result,
      };
      return query;
    },
  };
  const service = { from: session.from };
  createServerSupabaseClient.mockResolvedValue(session);
  createServiceSupabaseClient.mockReturnValue(service);
  createSupabaseRepositories.mockReturnValue({
    nogs: deps.nogs, notebook: deps.notebook, thoughtCards: deps.thoughtCards,
    questions: deps.questions, attempts: deps.attempts, usage: deps.usage, voiceCache: deps.voiceCache,
    profiles: { findById: vi.fn(async (id: string) => id === userId ? profile : null) },
    appConfig: { getFeatures: vi.fn(async () => features) },
  });
  createLlmAdapters.mockReturnValue({ listener: deps.listener, brain: deps.brain, grader: deps.grader });
  return { deps, session, service };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("LLM_PROVIDER", "fake");
  vi.stubEnv("LLM_FALLBACK_BASE_URL", undefined);
  vi.stubEnv("LLM_FALLBACK_API_KEY", undefined);
  vi.stubEnv("LLM_FALLBACK_MODEL", undefined);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([
  ["SUPABASE_SERVICE_ROLE_KEY", undefined],
  ["NEXT_PUBLIC_SUPABASE_URL", "invalid-url-with-fixture-secret"],
] as const)("names invalid configuration for %s without exposing environment values", async (key, value) => {
  vi.stubEnv(key, value);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const construction = createContainer();

  await expect(construction).rejects.toThrow(new RegExp(`\\b${key}\\b`));
  const diagnostics = inspect([
    await construction.catch((error: unknown) => error),
    ...log.mock.calls, ...info.mock.calls, ...warn.mock.calls, ...error.mock.calls,
  ], { depth: null });
  for (const secret of [...Object.values(env), ...(value ? [value] : [])]) {
    expect(diagnostics.includes(secret), "Environment values must be redacted from diagnostics").toBe(false);
  }
  expect(createServerSupabaseClient).not.toHaveBeenCalled();
  expect(createServiceSupabaseClient).not.toHaveBeenCalled();
});

it("refuses the fake provider in production before constructing adapters", async () => {
  vi.stubEnv("NODE_ENV", "production");

  await expect(createContainer()).rejects.toThrow(/LLM_PROVIDER|fake/i);
  expect(createLlmAdapters).not.toHaveBeenCalled();
});

it("composes the Supabase repositories and all language ports into teaching and quick check", async () => {
  vi.stubEnv("LLM_PROVIDER", "openai-compatible");
  const { deps, session, service } = mockDependencies();
  const listByOwner = vi.spyOn(deps.nogs, "listByOwner");
  const savePage = vi.spyOn(deps.notebook, "savePage");
  const listCards = vi.spyOn(deps.thoughtCards, "listByTopic");
  const listQuestions = vi.spyOn(deps.questions, "listByTopic");
  const recordCheck = vi.spyOn(deps.attempts, "recordCheck");
  const consumeQuota = vi.spyOn(deps.usage, "consumeQuota");
  const listen = vi.spyOn(deps.listener, "listen");
  const answer = vi.spyOn(deps.brain, "answer");
  const grade = vi.spyOn(deps.grader, "grade");
  const container = await createContainer();

  expect(createSupabaseRepositories).toHaveBeenCalledWith({ session, service, userId });
  await expect(container.listNogs()).resolves.toMatchObject({ status: "ok", nogs: [{ id: nogId }] });
  await expect(container.teachLesson({ nogId, topicId, body: "The client sends SYN.", idempotencyKey: "first-lesson" }))
    .resolves.toMatchObject({ status: "ok" });
  await expect(container.runQuickCheck({ nogId, topicId })).resolves.toMatchObject({ status: "ok" });

  expect(listByOwner).toHaveBeenCalledWith(userId);
  expect(savePage).toHaveBeenCalledOnce();
  expect(listCards).toHaveBeenCalledWith(nogId, topicId);
  expect(listQuestions).toHaveBeenCalledWith(topicId);
  expect(recordCheck).toHaveBeenCalledOnce();
  for (const kind of ["listener", "answer", "grade"]) {
    expect(consumeQuota).toHaveBeenCalledWith(userId, kind, 1);
  }
  expect(listen).toHaveBeenCalledOnce();
  expect(answer).toHaveBeenCalledOnce();
  expect(grade).toHaveBeenCalledOnce();
});

it.each([[false, "roast"], [true, "gentle"]] as const)(
  "builds getPersona from Nog, profile and feature data (speech mimicry %s)",
  async (enabled, grillMode) => {
    mockDependencies(enabled, grillMode);
    await createContainer();
    const options = createLlmAdapters.mock.lastCall?.[0];

    expect(options?.speechMimicry).toBe(enabled);
    await expect(options?.getPersona(nogId)).resolves.toEqual({
      nogName: nog.name, stage: nog.stage, grillMode, speechPhrases: enabled ? phrases : [],
    });
  },
);
