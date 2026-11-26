import { describe, expect, it, vi } from "vitest";
import type { AskOutput } from "@/core/application/ports";
import { brainFog, completion, digest, fetchMock, makeAdapters, requestAt } from "@/adapters/ai/__tests__/fixtures";
import * as schemas from "@/adapters/ai/schemas";
import { askInput, askOutput, card, getAskerOutputError, listenerV3Input, makeAsker } from "./fixtures";

function parseAskerOutput(data: unknown): schemas.ParseResult<AskOutput> {
  const parse = Reflect.get(schemas, "parseAskerOutput") as
    | ((data: unknown) => schemas.ParseResult<AskOutput>)
    | undefined;
  if (typeof parse !== "function") throw new Error("Missing parseAskerOutput export");
  return parse(data);
}

const invalidAskerOutputs = [
  ["extra debug field", { debug: "test-provider-detail" }],
  ["extra renderer field", { dangerouslySetInnerHTML: { __html: "<b>note</b>" } }],
  ["numeric citation", { citedCardIds: [123] }],
  ["null citation", { citedCardIds: [null] }],
  ["empty citation", { citedCardIds: [""] }],
  ["blank citation", { citedCardIds: [" \t "] }],
  ["more than eight citations", { citedCardIds: Array.from({ length: 9 }, (_, index) => `card-${index}`) }],
  ["script markup in answer", { answer: "<script>testMarker()</script>" }],
  ["formatting markup in answer", { answer: "<b>SYN</b>" }],
  ["markup in mood", { mood: "<b>happy</b>" }],
  ["overlong answer", { answer: "a".repeat(601) }],
  ["blank answer", { answer: " \t " }],
  ["overlong mood", { mood: "a".repeat(21) }],
  ["blank mood", { mood: " \t " }],
  ["non-boolean knows", { knows: "true" }],
] as const;

const reinforce = { type: "reinforce", cardId: card.id, quote: listenerV3Input.page.body };

const invalidListenerOutputs = [
  ["missing card ID", { operations: [{ ...reinforce, cardId: undefined }] }],
  ["empty card ID", { operations: [{ ...reinforce, cardId: "" }] }],
  ["blank card ID", { operations: [{ ...reinforce, cardId: "  " }] }],
  ["missing quote", { operations: [{ ...reinforce, quote: undefined }] }],
  ["blank quote", { operations: [{ ...reinforce, quote: " \n " }] }],
  ["unknown status", { operations: [{ ...reinforce, status: "trusted" }] }],
  ["string offTopic", { offTopic: "true" }],
  ["numeric offTopic", { offTopic: 1 }],
] as const;

describe("Asker response", () => {
  it("accepts all documented bounds and returns its own citation array", () => {
    const input = {
      ...askOutput,
      answer: "a".repeat(600),
      mood: "m".repeat(20),
      citedCardIds: Array.from({ length: 8 }, (_, index) => `card-${index}`),
    };
    const parsed = parseAskerOutput(input);
    expect(parsed).toEqual({ ok: true, value: input });
    if (parsed.ok) expect(parsed.value.citedCardIds).not.toBe(input.citedCardIds);
  });

  it.each(invalidAskerOutputs)("rejects %s and throws after a single JSON repair", async (_, patch) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const invalid = { ...askOutput, ...patch };
    expect(parseAskerOutput(invalid)).toMatchObject({ ok: false });
    const asker = await makeAsker();
    const AskerOutputError = await getAskerOutputError();
    fetchMock.mockResolvedValueOnce(completion(invalid)).mockResolvedValueOnce(completion(invalid));

    await expect(asker.ask(askInput)).rejects.toBeInstanceOf(AskerOutputError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repairs an invalid completion without echoing its text, dynamic field names, or content in logs", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const asker = await makeAsker();
    const rejectedText = "raw-completion-marker-631";
    const rejectedKey = "private-provider-key-marker-914";
    fetchMock.mockResolvedValueOnce(completion({
      ...askOutput, answer: `<b>${rejectedText}</b>`, [rejectedKey]: rejectedText,
    })).mockResolvedValueOnce(completion(askOutput));

    await expect(asker.ask(askInput)).resolves.toEqual(askOutput);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = (await requestAt()).body.messages;
    const second = (await requestAt(1)).body.messages;
    expect(second.slice(0, -1)).toEqual(first);
    expect(second.at(-1)).toMatchObject({ role: "user", content: expect.stringMatching(/invalid|fix|repair/i) });
    const repair = second.at(-1)?.content ?? "";
    for (const text of [rejectedText, rejectedKey, askInput.question, card.paraphrase]) {
      expect(repair).not.toContain(text);
      expect(JSON.stringify(log.mock.calls)).not.toContain(text);
    }
  });
});

describe("Listener v3 response", () => {
  it("preserves reinforcement and both offTopic values while stripping extra fields", () => {
    const { parseListenerDigest } = schemas;
    for (const offTopic of [true, false]) {
      const operation = offTopic ? { ...reinforce } : { ...reinforce, status: "understood" };
      expect(parseListenerDigest({
        ...digest,
        offTopic,
        html: "<b>unused</b>",
        dangerouslySetInnerHTML: {},
        operations: [{ ...operation, html: "<b>unused</b>", dangerouslySetInnerHTML: {} }],
      })).toEqual({
        ok: true,
        value: { ...digest, offTopic, operations: [operation] },
      });
    }
  });

  it.each(invalidListenerOutputs)("rejects %s and returns brain fog after a single JSON repair", async (_, patch) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const valid = { ...digest, offTopic: true, operations: [reinforce] };
    expect(schemas.parseListenerDigest(valid)).toEqual({ ok: true, value: valid });
    const invalid = { ...valid, ...patch };
    expect(schemas.parseListenerDigest(invalid)).toMatchObject({ ok: false });
    const { listener } = await makeAdapters();
    fetchMock.mockResolvedValueOnce(completion(invalid)).mockResolvedValueOnce(completion(invalid));

    await expect(listener.listen(listenerV3Input)).resolves.toEqual(brainFog);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
