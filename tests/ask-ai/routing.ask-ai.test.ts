import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { completion, fetchMock, loadAdapters, providerEnv, requestAt } from "@/adapters/ai/__tests__/fixtures";
import { askInput, askOutput, card, expectMetadataOnly, makeAsker } from "./fixtures";

const primaryUrl = `${providerEnv.LLM_BASE_URL}/chat/completions`;
const fallbackUrl = `${providerEnv.LLM_FALLBACK_BASE_URL}/chat/completions`;

describe("Asker provider routing", () => {
  it("uses the primary structured request settings and logs only usage metadata", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const asker = await makeAsker();
    fetchMock.mockResolvedValueOnce(completion(askOutput));

    await expect(asker.ask(askInput)).resolves.toEqual(askOutput);

    const { request, body } = await requestAt();
    expect(request.url).toBe(primaryUrl);
    expect(request.method).toBe("POST");
    expect(request.headers.get("authorization")).toBe(`Bearer ${providerEnv.LLM_API_KEY}`);
    expect(body).toMatchObject({
      model: providerEnv.LLM_MODEL, response_format: { type: "json_object" }, seed: 7,
    });
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.max_tokens).toBeLessThanOrEqual(800);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectMetadataOnly(info.mock.calls);
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      role: "asker", promptVersion: expect.stringMatching(/^asker-v1(?:\.|$)/),
      promptTokens: 70, completionTokens: 25, totalTokens: 95,
    });
  });

  it.each([429, 500, 503, "network error"])("falls back after %s without sending the primary credential", async (failure) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("LLM_FALLBACK_API_KEY", undefined);
    const asker = await makeAsker();
    if (typeof failure === "number") {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: failure }));
    } else {
      fetchMock.mockRejectedValueOnce(new TypeError("Test network failure"));
    }
    fetchMock.mockResolvedValueOnce(completion(askOutput));

    await expect(asker.ask(askInput)).resolves.toEqual(askOutput);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await requestAt()).request.url).toBe(primaryUrl);
    const { request, body } = await requestAt(1);
    expect(request.url).toBe(fallbackUrl);
    expect(body.model).toBe(providerEnv.LLM_FALLBACK_MODEL);
    expect(request.headers.has("authorization")).toBe(false);
  });

  it("aborts the primary request after 15 seconds and tries the fallback once", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const asker = await makeAsker();
    vi.useFakeTimers();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Test timeout", "TimeoutError")), ms);
      return controller.signal;
    });
    let primarySignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((input, init) => {
      const signal = new Request(input, init).signal;
      primarySignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }).mockResolvedValueOnce(completion(askOutput));

    const result = expect(asker.ask(askInput)).resolves.toEqual(askOutput);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(primarySignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await result;

    expect(primarySignal?.aborted).toBe(true);
    expect(timeout.mock.calls).toEqual([[15_000], [15_000]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await requestAt(1)).request.url).toBe(fallbackUrl);
  });

  it.each([
    ["distinct from primary", "configured-asker", primaryUrl, providerEnv.LLM_MODEL, providerEnv.LLM_API_KEY],
    ["equal to primary", providerEnv.LLM_MODEL, fallbackUrl, providerEnv.LLM_FALLBACK_MODEL, providerEnv.LLM_FALLBACK_API_KEY],
  ])("routes an override %s through the expected fallback", async (_, override, url, model, key) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("LLM_ASKER_MODEL", ` ${override} `);
    const asker = await makeAsker();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(completion(askOutput));

    await expect(asker.ask(askInput)).resolves.toEqual(askOutput);

    const first = await requestAt();
    expect(first.request.url).toBe(primaryUrl);
    expect(first.body.model).toBe(override);
    expect(first.request.headers.get("authorization")).toBe(`Bearer ${providerEnv.LLM_API_KEY}`);
    const fallback = await requestAt(1);
    expect(fallback.request.url).toBe(url);
    expect(fallback.body.model).toBe(model);
    expect(fallback.request.headers.get("authorization")).toBe(`Bearer ${key}`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads the Asker model override in the server-only provider configuration", () => {
    const fallbackSource = readFileSync(
      new URL("../../src/adapters/ai/fallback-llm.ts", import.meta.url), "utf8",
    );
    const transportSource = readFileSync(
      new URL("../../src/adapters/ai/openai-compatible-llm.ts", import.meta.url), "utf8",
    );
    expect(fallbackSource).toMatch(/import\s+["']server-only["']/);
    expect(fallbackSource.includes("LLM_ASKER_MODEL"), "expected the server-only model override").toBe(true);
    expect(transportSource).not.toContain("LLM_ASKER_MODEL");
  });

  it("honors a five-second Retry-After exactly once", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const asker = await makeAsker();
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "5" } }))
      .mockResolvedValueOnce(completion(askOutput));

    const result = expect(asker.ask(askInput)).resolves.toEqual(askOutput);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await requestAt(1)).request.url).toBe(fallbackUrl);
  });

  it("stops after both providers fail and omits credentials and study content from errors and logs", async () => {
    const logs = ["info", "log", "warn", "debug", "error"].map((level) =>
      vi.spyOn(console, level as "info").mockImplementation(() => {}));
    const { NogSleepyError } = await loadAdapters();
    const asker = await makeAsker();
    const privateText = [
      providerEnv.LLM_API_KEY, providerEnv.LLM_FALLBACK_API_KEY, askInput.question,
      card.label, card.paraphrase, card.quote!,
    ];
    fetchMock
      .mockResolvedValueOnce(new Response(privateText.join("\n"), { status: 429, headers: { "retry-after": "120" } }))
      .mockResolvedValueOnce(new Response(privateText.join("\n"), { status: 503 }));
    vi.useFakeTimers();

    const result = asker.ask(askInput).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const error = await result;

    expect(error).toBeInstanceOf(NogSleepyError);
    expectMetadataOnly(logs[0].mock.calls);
    const captured = inspect([error, ...logs.flatMap(({ mock }) => mock.calls)], { depth: null });
    for (const text of privateText) expect(captured).not.toContain(text);
  });
});
