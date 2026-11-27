import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmAdapters } from "@/adapters/ai/fallback-llm";
import {
  createOpenAiCompatibleAdapters,
  type LlmRole,
  type LlmUsageEvent,
  type OpenAiCompatibleConfig,
} from "@/adapters/ai/openai-compatible-llm";
import type {
  AnswerInput,
  GenerateQuestionsInput,
  GradeInput,
  ListenInput,
} from "@/core/application/ports";

vi.mock("server-only", () => ({}));

const providerEnv = {
  LLM_BASE_URL: "https://primary.example.test/v1",
  LLM_API_KEY: "primary-test-credential",
  LLM_MODEL: "configured-primary-model",
  LLM_FALLBACK_BASE_URL: "https://fallback.example.test/v1",
  LLM_FALLBACK_API_KEY: "fallback-test-credential",
  LLM_FALLBACK_MODEL: "configured-fallback-model",
};

const primaryUrl = `${providerEnv.LLM_BASE_URL}/chat/completions`;
const fallbackUrl = `${providerEnv.LLM_FALLBACK_BASE_URL}/chat/completions`;

const persona = {
  nogName: "Pingu",
  stage: "hatchling" as const,
  grillMode: "roast" as const,
  speechPhrases: [],
};

const listenerInput: ListenInput = {
  nogId: "nog-1",
  topicId: "tcp-handshake",
  page: {
    id: "page-1",
    nogId: "nog-1",
    topicId: "tcp-handshake",
    body: "The client starts a TCP connection by sending SYN.",
    wordCount: 9,
    kind: "lesson",
    parentLessonId: null,
    idempotencyKey: "lesson-1",
    createdAt: "2026-11-21T03:00:00.000Z",
    updatedAt: "2026-11-21T03:00:00.000Z",
  },
  existingCards: [],
};

const question = {
  id: "q-syn",
  topicId: "tcp-handshake",
  prompt: "Which flag starts a TCP handshake?",
  referenceAnswer: "The client sends SYN first.",
  sourceExcerpt: "The client starts a TCP connection by sending SYN.",
  keyConcepts: ["client sends SYN"],
};

const answerInput: AnswerInput = {
  nogId: "nog-1",
  topicId: "tcp-handshake",
  pages: [listenerInput.page],
  cards: [],
  questions: [{ id: question.id, prompt: question.prompt }],
};

const gradeInput: GradeInput = {
  topicId: "tcp-handshake",
  pages: [listenerInput.page],
  questions: [question],
  answers: [{ questionId: question.id, nogAnswer: "The client sends SYN first." }],
};

const writerInput: GenerateQuestionsInput = {
  subjectName: "Networking",
  topicTitle: "UDP Datagrams",
};

const validDigest = {
  reply: "Got it, boss! SYN starts the connection.",
  mood: "happy",
  followUpQuestions: ["What does the server reply with?"],
  operations: [
    {
      type: "create",
      label: "SYN",
      paraphrase: "The client opens the connection with SYN.",
      status: "understood",
      quote: listenerInput.page.body,
    },
  ],
};

const validAnswer = {
  answers: [{ questionId: question.id, nogAnswer: "The client sends SYN first." }],
};

const validGrade = {
  grades: [
    {
      questionId: question.id,
      concepts: [
        {
          concept: question.keyConcepts[0],
          inAnswer: true,
          inPages: true,
          consistentWithReference: true,
        },
      ],
    },
  ],
};

const validGeneratedQuestions = {
  questions: Array.from({ length: 8 }, (_, index) => ({
    prompt: `Which UDP property is shown in case ${index + 1}?`,
    referenceAnswer: "UDP sends independent datagrams without a handshake.",
    sourceExcerpt: "A UDP datagram carries a payload and a small transport header.",
    keyConcepts: ["independent datagrams", "transport header"],
  })),
};

function completion(payload: unknown) {
  return Response.json({
    choices: [
      {
        message: { role: "assistant", content: JSON.stringify(payload) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
  });
}

const fetchMock = vi.fn<typeof fetch>();

async function parseCall(index: number) {
  const call = fetchMock.mock.calls[index];
  expect(call, `expected fetch call ${index + 1}`).toBeDefined();
  const request = new Request(...call);
  const body = (await request.json()) as {
    model: string;
    max_tokens: number;
    temperature: number;
    response_format: { type: string };
  };
  return { request, body };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("LLM_PROVIDER", undefined);
  vi.stubEnv("LLM_GRADER_MODEL", undefined);
  vi.stubEnv("LLM_QUESTION_WRITER_MODEL", undefined);
  for (const [key, value] of Object.entries(providerEnv)) {
    vi.stubEnv(key, value);
  }
  fetchMock.mockReset().mockRejectedValue(new Error("Unexpected fetch call"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ai-capacity per-role model routing and token budgets", () => {
  it("routes grader and question-writer to their role override models and falls back to LLM_MODEL on 429 while leaving listener and answerer on primary/fallback", async () => {
    vi.stubEnv("LLM_GRADER_MODEL", "configured-grader-override");
    vi.stubEnv("LLM_QUESTION_WRITER_MODEL", "configured-writer-override");

    const usageEvents: LlmUsageEvent[] = [];
    const adapters = createLlmAdapters({
      getPersona: async () => persona,
      speechMimicry: false,
      onUsage: (event) => usageEvents.push(event),
    });

    // 1. Grader uses LLM_GRADER_MODEL on primary endpoint, then falls back to LLM_MODEL on 429
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validGrade));

    await expect(adapters.grader.grade(gradeInput)).resolves.toEqual(validGrade);

    const graderFirst = await parseCall(0);
    const graderFallback = await parseCall(1);
    expect(graderFirst.request.url).toBe(primaryUrl);
    expect(graderFirst.request.headers.get("authorization")).toBe(
      `Bearer ${providerEnv.LLM_API_KEY}`,
    );
    expect(graderFirst.body.model).toBe("configured-grader-override");
    expect(graderFallback.request.url).toBe(primaryUrl);
    expect(graderFallback.request.headers.get("authorization")).toBe(
      `Bearer ${providerEnv.LLM_API_KEY}`,
    );
    expect(graderFallback.body.model).toBe(providerEnv.LLM_MODEL);

    // 2. Question writer uses LLM_QUESTION_WRITER_MODEL on primary, falls back to LLM_MODEL even without LLM_FALLBACK_*
    vi.stubEnv("LLM_FALLBACK_BASE_URL", undefined);
    vi.stubEnv("LLM_FALLBACK_MODEL", undefined);
    vi.stubEnv("LLM_FALLBACK_API_KEY", undefined);
    const adaptersWithoutFallback = createLlmAdapters({
      getPersona: async () => persona,
      speechMimicry: false,
      onUsage: (event) => usageEvents.push(event),
    });

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validGeneratedQuestions));

    await expect(
      adaptersWithoutFallback.questionWriter!.generate(writerInput),
    ).resolves.toHaveLength(8);

    const writerFirst = await parseCall(2);
    const writerFallback = await parseCall(3);
    expect(writerFirst.request.url).toBe(primaryUrl);
    expect(writerFirst.body.model).toBe("configured-writer-override");
    expect(writerFallback.request.url).toBe(primaryUrl);
    expect(writerFallback.body.model).toBe(providerEnv.LLM_MODEL);

    // 3. Listener and answerer (no override) still use LLM_MODEL as primary and LLM_FALLBACK_MODEL on 429
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validDigest))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validAnswer));

    await expect(adapters.listener.listen(listenerInput)).resolves.toEqual(
      validDigest,
    );
    await expect(adapters.brain.answer(answerInput)).resolves.toMatchObject({
      answers: validAnswer.answers,
      model: providerEnv.LLM_FALLBACK_MODEL,
    });

    const listenerFirst = await parseCall(4);
    const listenerFallback = await parseCall(5);
    const answererFirst = await parseCall(6);
    const answererFallback = await parseCall(7);
    expect(listenerFirst.request.url).toBe(primaryUrl);
    expect(listenerFirst.body.model).toBe(providerEnv.LLM_MODEL);
    expect(listenerFallback.request.url).toBe(fallbackUrl);
    expect(listenerFallback.body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);
    expect(answererFirst.request.url).toBe(primaryUrl);
    expect(answererFirst.body.model).toBe(providerEnv.LLM_MODEL);
    expect(answererFallback.request.url).toBe(fallbackUrl);
    expect(answererFallback.body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);

    expect(
      usageEvents.map((event) => ({
        role: event.role,
        model: event.model,
        status: event.status,
      })),
    ).toEqual([
      { role: "grader", model: "configured-grader-override", status: 429 },
      { role: "grader", model: providerEnv.LLM_MODEL, status: 200 },
      {
        role: "question-writer",
        model: "configured-writer-override",
        status: 429,
      },
      { role: "question-writer", model: providerEnv.LLM_MODEL, status: 200 },
      { role: "listener", model: providerEnv.LLM_MODEL, status: 429 },
      { role: "listener", model: providerEnv.LLM_FALLBACK_MODEL, status: 200 },
      { role: "answerer", model: providerEnv.LLM_MODEL, status: 429 },
      { role: "answerer", model: providerEnv.LLM_FALLBACK_MODEL, status: 200 },
    ]);
  });

  it("supports OpenAiCompatibleConfig.roleModels directly and reports the model that actually answered", async () => {
    const usageEvents: LlmUsageEvent[] = [];
    const config: OpenAiCompatibleConfig & {
      roleModels?: Partial<Record<LlmRole, string>>;
    } = {
      primary: {
        baseUrl: providerEnv.LLM_BASE_URL,
        apiKey: providerEnv.LLM_API_KEY,
        model: providerEnv.LLM_MODEL,
      },
      fallback: {
        baseUrl: providerEnv.LLM_FALLBACK_BASE_URL,
        apiKey: providerEnv.LLM_FALLBACK_API_KEY,
        model: providerEnv.LLM_FALLBACK_MODEL,
      },
      roleModels: {
        answerer: "direct-answerer-override",
        grader: "direct-grader-override",
        "question-writer": "direct-writer-override",
      },
    };

    const adapters = createOpenAiCompatibleAdapters(config, {
      getPersona: async () => persona,
      speechMimicry: false,
      onUsage: (event) => usageEvents.push(event),
    });

    fetchMock
      .mockResolvedValueOnce(completion(validAnswer))
      .mockResolvedValueOnce(completion(validGrade))
      .mockResolvedValueOnce(completion(validGeneratedQuestions));

    const answerResult = await adapters.brain.answer(answerInput);
    expect(answerResult.model).toBe("direct-answerer-override");
    await adapters.grader.grade(gradeInput);
    await adapters.questionWriter!.generate(writerInput);

    expect((await parseCall(0)).body.model).toBe("direct-answerer-override");
    expect((await parseCall(1)).body.model).toBe("direct-grader-override");
    expect((await parseCall(2)).body.model).toBe("direct-writer-override");
    expect(usageEvents.map((e) => [e.role, e.model, e.status])).toEqual([
      ["answerer", "direct-answerer-override", 200],
      ["grader", "direct-grader-override", 200],
      ["question-writer", "direct-writer-override", 200],
    ]);
  });

  it("trims LLM_GRADER_MODEL and LLM_QUESTION_WRITER_MODEL and treats empty or whitespace values as unset", async () => {
    vi.stubEnv("LLM_GRADER_MODEL", "  trimmed-grader-override  ");
    vi.stubEnv("LLM_QUESTION_WRITER_MODEL", "  trimmed-writer-override  ");

    const overridden = createLlmAdapters({
      getPersona: async () => persona,
      speechMimicry: false,
    });

    fetchMock
      .mockResolvedValueOnce(completion(validGrade))
      .mockResolvedValueOnce(completion(validGeneratedQuestions));

    await overridden.grader.grade(gradeInput);
    await overridden.questionWriter!.generate(writerInput);

    expect((await parseCall(0)).body.model).toBe("trimmed-grader-override");
    expect((await parseCall(1)).body.model).toBe("trimmed-writer-override");

    // Empty / whitespace values behave as unset (primary = LLM_MODEL, fallback = LLM_FALLBACK_MODEL)
    vi.stubEnv("LLM_GRADER_MODEL", "   ");
    vi.stubEnv("LLM_QUESTION_WRITER_MODEL", "");

    const defaultRouted = createLlmAdapters({
      getPersona: async () => persona,
      speechMimicry: false,
    });

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validGrade))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validGeneratedQuestions));

    await defaultRouted.grader.grade(gradeInput);
    await defaultRouted.questionWriter!.generate(writerInput);

    expect((await parseCall(2)).body.model).toBe(providerEnv.LLM_MODEL);
    expect((await parseCall(3)).request.url).toBe(fallbackUrl);
    expect((await parseCall(3)).body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);
    expect((await parseCall(4)).body.model).toBe(providerEnv.LLM_MODEL);
    expect((await parseCall(5)).request.url).toBe(fallbackUrl);
    expect((await parseCall(5)).body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);
  });

  it("sends max_tokens 600 for listener, 1600 for answerer, 2000 for grader, and 2048 for question-writer", async () => {
    const adapters = createLlmAdapters({
      getPersona: async () => persona,
      speechMimicry: false,
    });

    fetchMock
      .mockResolvedValueOnce(completion(validDigest))
      .mockResolvedValueOnce(completion(validAnswer))
      .mockResolvedValueOnce(completion(validGrade))
      .mockResolvedValueOnce(completion(validGeneratedQuestions));

    await adapters.listener.listen(listenerInput);
    await adapters.brain.answer(answerInput);
    await adapters.grader.grade(gradeInput);
    await adapters.questionWriter!.generate(writerInput);

    const calls = await Promise.all([
      parseCall(0),
      parseCall(1),
      parseCall(2),
      parseCall(3),
    ]);

    expect(calls.map(({ body }) => body.max_tokens)).toEqual([
      600,
      1600,
      2000,
      2048,
    ]);
  });

  it("lists LLM_GRADER_MODEL and LLM_QUESTION_WRITER_MODEL with empty values in .env.example", () => {
    const example = readFileSync(
      new URL("../../.env.example", import.meta.url),
      "utf8",
    ).replace(/^\uFEFF/, "");

    for (const key of ["LLM_GRADER_MODEL", "LLM_QUESTION_WRITER_MODEL"]) {
      const assignments = [
        ...example.matchAll(
          new RegExp(`^[ \\t]*${key}[ \\t]*=([^\\r\\n]*)`, "gm"),
        ),
      ];
      expect(assignments.length, `${key} must appear once in .env.example`).toBe(
        1,
      );
      expect(
        /^[ \t]*(?:""|'')?[ \t]*(?:#.*)?$/.test(assignments[0][1]),
        `${key} must have an empty value in .env.example`,
      ).toBe(true);
    }
  });

  it("cascades a role override from role model -> LLM_MODEL -> LLM_FALLBACK_MODEL when both primary buckets return 429", async () => {
    vi.stubEnv("LLM_GRADER_MODEL", "configured-grader-override");

    const adapters = createLlmAdapters({
      getPersona: async () => persona,
      speechMimicry: false,
    });

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(completion(validGrade));

    await expect(adapters.grader.grade(gradeInput)).resolves.toEqual(validGrade);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await parseCall(0)).body.model).toBe("configured-grader-override");
    expect((await parseCall(1)).body.model).toBe(providerEnv.LLM_MODEL);
    const third = await parseCall(2);
    expect(third.request.url).toBe(fallbackUrl);
    expect(third.body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);
  });
});
