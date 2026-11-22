import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { inspect } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import {
  answer,
  answerInput,
  completion,
  digest,
  fetchMock,
  gradeInput,
  listenerInput,
  loadAdapters,
  makeAdapters,
  providerEnv,
  requestAt,
} from "./fixtures";

const primaryUrl = `${providerEnv.LLM_BASE_URL}/chat/completions`;
const fallbackUrl = `${providerEnv.LLM_FALLBACK_BASE_URL}/chat/completions`;

describe("provider configuration", () => {
  it("uses the primary URL, model and credentials from env", async () => {
    const { listener } = await makeAdapters();
    fetchMock.mockResolvedValueOnce(completion(digest));

    await expect(listener.listen(listenerInput)).resolves.toEqual(digest);

    const { request, body } = await requestAt();
    expect(request.url).toBe(primaryUrl);
    expect(request.method).toBe("POST");
    expect(request.headers.get("authorization")).toBe(`Bearer ${providerEnv.LLM_API_KEY}`);
    expect(body.model).toBe(providerEnv.LLM_MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"])(
    "reports missing %s at construction",
    async (key) => {
      const { createLlmAdapters } = await loadAdapters();
      vi.stubEnv(key, undefined);

      expect(() => createLlmAdapters({
        getPersona: async () => ({ nogName: "Pip", stage: "hatchling", grillMode: "gentle", speechPhrases: [] }),
        speechMimicry: false,
      })).toThrow(key);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("keeps provider env reads in server-only modules and scans src for hardcoded model IDs", () => {
    const src = fileURLToPath(new URL("../../../", import.meta.url));
    const productionFiles = readdirSync(src, { recursive: true, withFileTypes: true })
      .filter((file) => file.isFile() && /\.[cm]?[jt]sx?$/.test(file.name))
      .map((file) => join(file.parentPath, file.name))
      .filter((file) => !/[/\\]__tests__[/\\]|\.(test|spec)\.[cm]?[jt]sx?$/.test(file));

    const modelId = /^(?:[\w.-]+\/)?(?:(?:qwen|gpt|llama|gemini|deepseek|mistral|mixtral|gemma|phi|whisper|grok|kimi)(?:\d[\w.-]*|[-_.][\w.-]+)|o[134](?:-[\w.-]+)?)(?::[\w.-]+)?$/i;
    const envKeys = /\bLLM_(?:BASE_URL|MODEL|API_KEY|FALLBACK_(?:BASE_URL|MODEL|API_KEY))\b/;
    const modelLiterals: string[] = [];
    const unguardedEnvFiles: string[] = [];
    const providerEnvFiles: string[] = [];

    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const path = relative(src, file);
      if (source.includes("process.env") && envKeys.test(source)) {
        providerEnvFiles.push(path);
        if (!/\bimport\s+["']server-only["']/.test(source)) unguardedEnvFiles.push(path);
      }

      function visit(node: ts.Node) {
        if (ts.isStringLiteralLike(node) && modelId.test(node.text)) {
          const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
          modelLiterals.push(`${path}:${line + 1} ${node.getText(parsed)}`);
        }
        ts.forEachChild(node, visit);
      }

      visit(parsed);
    }

    expect(providerEnvFiles.length, "missing production LLM configuration reader under src/").toBeGreaterThan(0);
    expect(unguardedEnvFiles).toEqual([]);
    expect(modelLiterals).toEqual([]);
  });
});

describe("provider fallback", () => {
  it.each([429, 500, 503])("uses the fallback endpoint, model and key after %i", async (status) => {
    const { brain } = await makeAdapters();
    fetchMock.mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(completion(answer));

    await expect(brain.answer(answerInput)).resolves.toMatchObject(answer);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await requestAt()).request.url).toBe(primaryUrl);
    const { request, body } = await requestAt(1);
    expect(request.url).toBe(fallbackUrl);
    expect(request.headers.get("authorization")).toBe(`Bearer ${providerEnv.LLM_FALLBACK_API_KEY}`);
    expect(body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);
  });

  it("uses the fallback on a network error without forwarding the primary key", async () => {
    vi.stubEnv("LLM_FALLBACK_API_KEY", undefined);
    const { brain } = await makeAdapters();
    fetchMock.mockRejectedValueOnce(new TypeError("socket disconnected"))
      .mockResolvedValueOnce(completion(answer));

    await expect(brain.answer(answerInput)).resolves.toMatchObject(answer);

    const { request } = await requestAt(1);
    expect(request.url).toBe(fallbackUrl);
    expect(request.headers.get("authorization") ?? "").not.toContain(providerEnv.LLM_API_KEY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("switches to the fallback after the 15-second request timeout", async () => {
    const { brain } = await makeAdapters();
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), milliseconds);
      return controller.signal;
    });
    let primarySignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((input, init) => {
      primarySignal = new Request(input, init).signal;
      return new Promise((_resolve, reject) => {
        const signal = primarySignal!;
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }).mockResolvedValueOnce(completion(answer));

    const result = brain.answer(answerInput);
    const verdict = expect(result).resolves.toMatchObject(answer);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(primarySignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(primarySignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await requestAt(1)).request.url).toBe(fallbackUrl);
    await verdict;
  });

  it("honors a five-second Retry-After once", async () => {
    const { listener } = await makeAdapters();
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response(null, {
      status: 429,
      headers: { "Retry-After": "5" },
    })).mockResolvedValueOnce(completion(digest));

    const result = listener.listen(listenerInput);
    const verdict = expect(result).resolves.toEqual(digest);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await requestAt(1)).request.url).toBe(fallbackUrl);
    await verdict;
  });

  it("stops after both providers fail and redacts credentials and learner content", async () => {
    const { NogSleepyError } = await loadAdapters();
    const { listener } = await makeAdapters();
    vi.useFakeTimers();
    const logs = ["log", "info", "debug", "warn", "error"].map((method) =>
      vi.spyOn(console, method as "log").mockImplementation(() => undefined),
    );
    const lesson = listenerInput.page.body;
    const providerError = `Authorization: Bearer ${providerEnv.LLM_API_KEY}. Lesson: ${lesson}`;
    fetchMock.mockResolvedValueOnce(new Response(providerError, {
      status: 429,
      headers: { "Retry-After": "120" },
    })).mockResolvedValueOnce(new Response(`Authorization: Bearer ${providerEnv.LLM_FALLBACK_API_KEY}`, {
      status: 503,
      headers: { "Retry-After": "5" },
    }));

    const result = listener.listen(listenerInput).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const error = await result;
    expect(NogSleepyError).toBeTypeOf("function");
    expect(error).toBeInstanceOf(NogSleepyError);

    const captured = inspect([error, ...logs.flatMap(({ mock }) => mock.calls)], { depth: null });
    expect(captured).not.toContain(providerEnv.LLM_API_KEY);
    expect(captured).not.toContain(providerEnv.LLM_FALLBACK_API_KEY);
    expect(captured).not.toContain(lesson);
  });
});

describe("fake provider selection", () => {
  it("selects deterministic implementations of all three ports without HTTP", async () => {
    vi.stubEnv("LLM_PROVIDER", "fake");
    for (const key of Object.keys(providerEnv)) vi.stubEnv(key, undefined);
    const first = await makeAdapters();
    const second = await makeAdapters();

    const lesson = await first.listener.listen(listenerInput);
    expect(lesson).toMatchObject({ reply: expect.any(String), operations: expect.any(Array) });
    expect(await second.listener.listen(listenerInput)).toEqual(lesson);

    const quiz = await first.brain.answer(answerInput);
    expect(quiz.answers).toEqual([{ questionId: answerInput.questions[0].id, nogAnswer: expect.any(String) }]);
    expect(await second.brain.answer(answerInput)).toEqual(quiz);

    const input = { ...gradeInput, answers: quiz.answers };
    const result = await first.grader.grade(input);
    expect(result.grades).toEqual([{ questionId: answerInput.questions[0].id, concepts: [{
      concept: gradeInput.questions[0].keyConcepts[0],
      inAnswer: expect.any(Boolean),
      inPages: expect.any(Boolean),
      consistentWithReference: expect.any(Boolean),
    }] }]);
    expect(await second.grader.grade(input)).toEqual(result);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects fake provider selection at startup in production", async () => {
    vi.stubEnv("LLM_PROVIDER", "fake");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();

    await expect(makeAdapters()).rejects.toThrow(/fake|production/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
