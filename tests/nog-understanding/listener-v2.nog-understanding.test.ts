import { describe, expect, it } from "vitest";
import { buildListenerMessages, PROMPT_VERSION } from "@/adapters/ai/prompts/listener";

const persona = { nogName: "Pingu", stage: "hatchling" as const, grillMode: "roast" as const, speechPhrases: [] };
const page = {
  id: "p1",
  nogId: "n1",
  topicId: "t1",
  body: "uhm the client sends SYN first",
  wordCount: 6,
  kind: "lesson" as const,
  parentLessonId: null,
  idempotencyKey: "k1",
  createdAt: "2026-11-22T00:00:00.000Z",
  updatedAt: "2026-11-22T00:00:00.000Z",
};

function systemPrompt() {
  const messages = buildListenerMessages({ nogId: "n1", topicId: "t1", page, existingCards: [] }, persona, false);
  return messages[0].content;
}

describe("listener-v2 reads typed and spoken lessons", () => {
  it("bumps the prompt version", () => {
    expect(PROMPT_VERSION).toBe("listener-v2");
  });

  it("explains spoken transcripts, fillers and self-corrections", () => {
    const prompt = systemPrompt();
    expect(prompt).toMatch(/spoken|transcript/i);
    expect(prompt).toMatch(/filler/i);
    expect(prompt).toMatch(/self-correct/i);
    expect(prompt).toMatch(/hindi pala|ay mali|I mean|no wait/i);
  });

  it("asks for one card per distinct idea and meaning over grammar or spelling", () => {
    const prompt = systemPrompt();
    expect(prompt).toMatch(/one card per (distinct )?idea/i);
    expect(prompt).toMatch(/grammar|spelling|typo/i);
  });

  it("forbids correcting facts from outside knowledge", () => {
    expect(systemPrompt()).toMatch(/only know what (you are|you're) taught|never correct facts/i);
  });

  it("keeps the student's own words in quotes, fillers included", () => {
    expect(systemPrompt()).toMatch(/fillers included|including fillers|keep the student's own words/i);
  });

  it("includes a spoken example whose quote keeps a filler and splits ideas into separate cards", () => {
    const prompt = systemPrompt();
    const examples = prompt.split("\n").filter((line) => /"operations":\[/.test(line));
    expect(examples.length).toBeGreaterThanOrEqual(6);
    expect(examples.some((line) => /"quote":"[^"]*\b(uhm|parang|ano)\b[^"]*"/i.test(line))).toBe(true);
    expect(examples.some((line) => (line.match(/"type":"create"/g) ?? []).length >= 2)).toBe(true);
  });
});
