import { describe, expect, it } from "vitest";
import { countWords, splitLesson } from "../lesson";

describe("countWords counts English and Filipino words at the 120-word limit", () => {
  it.each([
    ["The client waits for an acknowledgment.", 6],
    ["  Sinuri ng kliyente ang tugon,\n   bago muling kumonekta.  ", 8],
  ])("counts the words in %j", (draft, expected) => {
    expect(countWords(draft)).toBe(expected);
  });

  it("accepts 120 words as one lesson and splits a 121-word draft", () => {
    const request = "The client sends a request to start a new connection.";
    const explanation = "Naghihintay ang kliyente ng tugon mula sa bagong koneksyon nito";
    const draft = `${`${request} `.repeat(6)}${`${explanation} `.repeat(5)}${explanation}`;
    const atLimit = `${draft}.`;
    const overloaded = `${draft} ngayon.`;

    expect(countWords(atLimit)).toBe(120);
    expect(splitLesson(atLimit)).toEqual([atLimit]);
    expect(countWords(overloaded)).toBe(121);
    expect(splitLesson(overloaded)).toHaveLength(2);
  });
});

describe("splitLesson preserves ordered sentences while keeping every part within 120 words", () => {
  it("splits between sentences and preserves punctuation and internal whitespace", () => {
    const first = `First, ${"the client waits for a response and tracks its timeout,  ".repeat(6)}then retries.`;
    const second = `Next, ${"the server confirms the sequence number and sends an acknowledgment,\n".repeat(6)}then listens.`;

    const parts = splitLesson(`${first}\n\n${second}`);

    expect(parts.map((part) => part.trim())).toEqual([first, second]);
    for (const part of parts) {
      expect(countWords(part)).toBeLessThanOrEqual(120);
    }
  });
});
