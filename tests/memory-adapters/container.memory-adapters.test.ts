/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LlmAdapterOptions, LlmAdapters } from "@/adapters/ai/fallback-llm";
import type { AskExchangeRecord, AskOutput, ThoughtCardRecord } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import type { AskNogInput, AskNogResult, ListAskHistoryResult } from "@/core/application/use-cases/ask-nog";

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
  askNog(input: AskNogInput): Promise<AskNogResult>;
  listAskHistory(input: { nogId: string; limit?: number }): Promise<ListAskHistoryResult>;
};
const entries = import.meta.glob<{ createContainer(): Promise<Container> }>("../../src/composition/container.ts");

async function createContainer() {
  const load = entries["../../src/composition/container.ts"];
  if (!load) throw new Error("Missing entry point: src/composition/container.ts");
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
const nog = { id: nogId, ownerId: userId, subjectId: "networking", name: "Pip", stage: "sprout" as const, speechStyle: { phrases: [] } };
const card: ThoughtCardRecord = {
  id: "card-syn", nogId, topicId, label: "SYN", paraphrase: "The client opens with SYN.",
  status: "understood", sourceLessonId: "lesson-1", quote: "The client sends SYN.",
};
const exchange: AskExchangeRecord = {
  questionMessageId: "msg-q", answerMessageId: "msg-a", nogId,
  question: "What starts it?", answer: "SYN!", mood: "happy", createdAt: "2026-11-22T10:00:00.000Z",
};

function mockDependencies(signedIn = true) {
  const { deps } = createInMemoryPorts({
    userId,
    nogs: [nog],
    topics: [{ id: topicId, subjectId: "networking", ownerId: null, title: "TCP handshake" }] as never,
  });
  const thoughtCards = {
    ...deps.thoughtCards,
    search: vi.fn(async () => [card]),
    listEvidenceLessonIds: vi.fn(async () => [{ cardId: card.id, lessonId: "lesson-1" }]),
  };
  const notebook = { ...deps.notebook, findPagesByIds: vi.fn(async () => []) };
  const askHistory = {
    save: vi.fn(async () => ({ questionMessageId: "msg-q2", answerMessageId: "msg-a2" })),
    listRecent: vi.fn(async () => [exchange]),
  };
  const asker = {
    ask: vi.fn(async (): Promise<AskOutput> => ({ answer: "The client sends SYN first.", mood: "happy", knows: true, citedCardIds: [card.id] })),
  };
  const session = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? { id: userId } : null }, error: null }) },
    from() {
      const query = { select: () => query, eq: () => query, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }) };
      return query;
    },
  };
  createServerSupabaseClient.mockResolvedValue(session);
  createServiceSupabaseClient.mockReturnValue({ from: session.from });
  createSupabaseRepositories.mockReturnValue({
    nogs: deps.nogs, notebook, thoughtCards, topics: deps.topics,
    questions: deps.questions, attempts: deps.attempts, usage: deps.usage, voiceCache: deps.voiceCache,
    askHistory,
    profiles: { findById: vi.fn(async () => ({ id: userId, grillMode: "gentle" })) },
    appConfig: { getFeatures: vi.fn(async () => ({})) },
  });
  createLlmAdapters.mockReturnValue({ listener: deps.listener, brain: deps.brain, grader: deps.grader, asker });
  return { deps, thoughtCards, notebook, askHistory, asker };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("LLM_PROVIDER", "openai-compatible");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("wires asking through card search, evidence pages, the asker, quota and ask history", async () => {
  const { thoughtCards, notebook, askHistory, asker, deps } = mockDependencies();
  const consumeQuota = vi.spyOn(deps.usage, "consumeQuota");
  const container = await createContainer();

  await expect(container.askNog({ nogId, topicId, question: "What starts the handshake?" })).resolves.toMatchObject({
    status: "ok", knows: true, answerMessageId: "msg-a2", citedCards: [{ id: card.id, label: "SYN" }],
  });

  expect(thoughtCards.search).toHaveBeenCalledWith(nogId, topicId, "What starts the handshake?", expect.any(Number));
  expect(thoughtCards.listEvidenceLessonIds).toHaveBeenCalledWith([card.id]);
  expect(notebook.findPagesByIds).toHaveBeenCalledWith(nogId, ["lesson-1"]);
  expect(asker.ask).toHaveBeenCalledOnce();
  expect(consumeQuota).toHaveBeenCalledWith(userId, "ask", 1);
  expect(askHistory.save).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId, nogId }));
});

it("lists this nog's ask history for the signed-in owner", async () => {
  const { askHistory } = mockDependencies();
  const container = await createContainer();

  await expect(container.listAskHistory({ nogId })).resolves.toEqual({ status: "ok", exchanges: [exchange] });
  expect(askHistory.listRecent).toHaveBeenCalledWith(userId, nogId, expect.any(Number));
});

it("answers with brain fog instead of crashing when no asker is configured", async () => {
  const { deps } = mockDependencies();
  createLlmAdapters.mockReturnValue({ listener: deps.listener, brain: deps.brain, grader: deps.grader });
  const container = await createContainer();

  await expect(container.askNog({ nogId, question: "What starts the handshake?" })).resolves.toEqual({ status: "brain_fog" });
});

it("returns unauthenticated for both ask entry points when nobody is signed in", async () => {
  mockDependencies(false);
  const container = await createContainer();

  await expect(container.askNog({ nogId, question: "Anything?" })).resolves.toEqual({ status: "unauthenticated" });
  await expect(container.listAskHistory({ nogId })).resolves.toEqual({ status: "unauthenticated" });
});
