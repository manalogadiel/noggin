/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, vi } from "vitest";
import type {
  AnswerGrader,
  AnswerInput,
  BrainAnswerResult,
  GradeInput,
  GraderResult,
  LessonPage,
  ListenInput,
  ListenerDigest,
  NogBrain,
  NogListener,
  NogStageSlug,
} from "@/core/application/ports";

vi.mock("server-only", () => ({}));

export const providerEnv = {
  LLM_BASE_URL: "https://primary.example.test/v1",
  LLM_API_KEY: "primary-test-credential",
  LLM_MODEL: "configured-primary",
  LLM_FALLBACK_BASE_URL: "https://fallback.example.test/v1",
  LLM_FALLBACK_API_KEY: "fallback-test-credential",
  LLM_FALLBACK_MODEL: "configured-fallback",
};

export const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("LLM_PROVIDER", undefined);
  for (const [key, value] of Object.entries(providerEnv)) vi.stubEnv(key, value);
  fetchMock.mockReset().mockRejectedValue(new Error("Unexpected provider request"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

export const persona = {
  nogName: "Pip the Nog",
  stage: "sprout" as NogStageSlug,
  grillMode: "roast" as const,
  speechPhrases: ["bale bale gets"],
};

interface AdapterOptions {
  getPersona: (nogId: string) => Promise<{
    nogName: string;
    stage: NogStageSlug;
    grillMode: "roast" | "gentle";
    speechPhrases: string[];
  }>;
  speechMimicry: boolean;
}

interface AdapterModule {
  createLlmAdapters(options: AdapterOptions): {
    listener: NogListener;
    brain: NogBrain;
    grader: AnswerGrader;
  };
  NogSleepyError: typeof Error;
}

// Discover the future entry point lazily so the pre-build run can collect each test.
const adapterModules = import.meta.glob<AdapterModule>("../fallback-llm.ts");

export async function loadAdapters() {
  const load = adapterModules["../fallback-llm.ts"];
  if (!load) throw new Error("Missing adapter entry point: src/adapters/ai/fallback-llm.ts");
  return load();
}

export async function makeAdapters(options: Partial<AdapterOptions> = {}) {
  const { createLlmAdapters } = await loadAdapters();
  return createLlmAdapters({ getPersona: async () => persona, speechMimicry: false, ...options });
}

export const scope = { nogId: "nog-1", topicId: "tcp-handshake" };

export function page(body: string, id = "page-1"): LessonPage {
  return {
    ...scope,
    id,
    body,
    wordCount: body.trim().split(/\s+/).filter(Boolean).length,
    kind: "lesson",
    idempotencyKey: `feed-${id}`,
    createdAt: "2026-11-21T03:00:00.000Z",
    updatedAt: "2026-11-21T03:00:00.000Z",
  };
}

export const listenerInput: ListenInput = {
  ...scope,
  page: page("The client opens the connection by sending SYN."),
  existingCards: [],
};

export const digest: ListenerDigest = {
  reply: "Got it, boss! SYN opens the connection.",
  mood: "happy",
  followUpQuestions: ["What does the server send back?"],
  operations: [{
    type: "create",
    label: "SYN",
    paraphrase: "The client opens a connection with SYN.",
    status: "understood",
    quote: listenerInput.page.body,
  }],
};

export const brainFog: ListenerDigest = {
  reply: "Brain fog… 😵 try again?",
  mood: "confused",
  followUpQuestions: [],
  operations: [],
};

const question = {
  id: "q-syn",
  topicId: scope.topicId,
  prompt: "Which flag starts a TCP handshake?",
  referenceAnswer: "The client starts the handshake with SYN.",
  sourceExcerpt: "The first TCP segment in the handshake has SYN set.",
  keyConcepts: ["client sends SYN"],
};

export const answerInput: AnswerInput = {
  ...scope,
  pages: [listenerInput.page],
  cards: [],
  questions: [{ id: question.id, prompt: question.prompt }],
};

export const answer: BrainAnswerResult = {
  answers: [{ questionId: question.id, nogAnswer: "The client sends SYN first." }],
};

export const gradeInput: GradeInput = {
  topicId: scope.topicId,
  pages: answerInput.pages,
  questions: [question],
  answers: answer.answers,
};

export const grade: GraderResult = {
  grades: [{
    questionId: question.id,
    concepts: [{ concept: question.keyConcepts[0], inAnswer: true, inPages: true, consistentWithReference: true }],
  }],
};

export function completion(content: unknown) {
  return chatResponse(JSON.stringify(content));
}

export function chatResponse(content: string) {
  return Response.json({
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 70, completion_tokens: 25, total_tokens: 95 },
  });
}

export interface ChatBody {
  model: string;
  messages: { role: string; content: string }[];
  response_format: { type: string };
  temperature: number;
  max_tokens: number;
  seed?: number;
}

export async function requestAt(index = 0) {
  const call = fetchMock.mock.calls[index];
  expect(call, `provider request ${index + 1}`).toBeDefined();
  const request = new Request(...call);
  const body: ChatBody = await request.json();
  const system = body.messages.filter(({ role }) => role === "system").map(({ content }) => content).join("\n");
  const data = body.messages.filter(({ role }) => role !== "system").map(({ content }) => content).join("\n");
  return { request, body, system, data };
}

export function taggedData(message: string, tag: string) {
  expect(message.match(new RegExp(`<${tag}>`, "g"))).toHaveLength(1);
  expect(message.match(new RegExp(`</${tag}>`, "g"))).toHaveLength(1);
  const value = message.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  expect(value, `data in <${tag}>`).not.toBeNull();
  return value![1];
}
