import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmAdapters } from "@/adapters/ai/fallback-llm";
import type { GradeInput } from "@/core/application/ports";

vi.mock("server-only", () => ({}));

const providerEnv = {
  LLM_BASE_URL: "https://primary.example.test/v1",
  LLM_API_KEY: "primary-test-credential",
  LLM_MODEL: "configured-primary-model",
};

const page = {
  id: "page-1",
  nogId: "nog-1",
  topicId: "tcp-handshake",
  body: "The client starts a TCP connection by sending SYN.",
  wordCount: 9,
  kind: "lesson" as const,
  parentLessonId: null,
  idempotencyKey: "lesson-1",
  createdAt: "2026-11-21T03:00:00.000Z",
  updatedAt: "2026-11-21T03:00:00.000Z",
};

const question = {
  id: "q-syn",
  topicId: "tcp-handshake",
  prompt: "Which flag starts a TCP handshake?",
  referenceAnswer: "The client sends SYN first.",
  sourceExcerpt: "The client starts a TCP connection by sending SYN.",
  keyConcepts: ["client sends SYN"],
};

const gradeInput: GradeInput = {
  topicId: "tcp-handshake",
  pages: [page],
  questions: [question],
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

async function bodyOf(index: number) {
  const call = fetchMock.mock.calls[index];
  expect(call, `expected fetch call ${index + 1}`).toBeDefined();
  return (await new Request(...call).json()) as Record<string, unknown>;
}

function adapters() {
  return createLlmAdapters({
    getPersona: async () => ({
      nogName: "Pingu",
      stage: "hatchling" as const,
      grillMode: "roast" as const,
      speechPhrases: [],
    }),
    speechMimicry: false,
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("LLM_PROVIDER", undefined);
  vi.stubEnv("LLM_FALLBACK_BASE_URL", undefined);
  vi.stubEnv("LLM_FALLBACK_API_KEY", undefined);
  vi.stubEnv("LLM_FALLBACK_MODEL", undefined);
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

describe("provider quirks", () => {
  it("falls back to the next model when the provider rejects its own JSON output (json_validate_failed)", async () => {
    vi.stubEnv("LLM_GRADER_MODEL", "openai/gpt-oss-120b");
    fetchMock
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              message: "Failed to validate JSON.",
              type: "invalid_request_error",
              code: "json_validate_failed",
            },
          },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(completion(validGrade));

    await expect(adapters().grader.grade(gradeInput)).resolves.toEqual(validGrade);
    expect((await bodyOf(0)).model).toBe("openai/gpt-oss-120b");
    expect((await bodyOf(1)).model).toBe(providerEnv.LLM_MODEL);
  });

  it("does not retry other 400 errors", async () => {
    vi.stubEnv("LLM_GRADER_MODEL", "openai/gpt-oss-120b");
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { message: "bad", type: "invalid_request_error", code: "model_not_found" } },
        { status: 400 },
      ),
    );

    await expect(adapters().grader.grade(gradeInput)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks gpt-oss models for low reasoning effort and leaves other models untouched", async () => {
    vi.stubEnv("LLM_GRADER_MODEL", "openai/gpt-oss-120b");
    fetchMock
      .mockResolvedValueOnce(completion(validGrade))
      .mockResolvedValueOnce(completion(validGrade));

    await adapters().grader.grade(gradeInput);
    vi.stubEnv("LLM_GRADER_MODEL", undefined);
    await adapters().grader.grade(gradeInput);

    expect((await bodyOf(0)).reasoning_effort).toBe("low");
    expect((await bodyOf(1)).model).toBe(providerEnv.LLM_MODEL);
    expect(await bodyOf(1)).not.toHaveProperty("reasoning_effort");
  });
});
