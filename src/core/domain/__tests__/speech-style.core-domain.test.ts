import { describe, expect, it } from "vitest";
import { extractSpeechStyle } from "../speech-style";

describe("extractSpeechStyle keeps phrases repeated across lessons and filters topic terms and profanity", () => {
  it("includes recurring fillers and excludes one-lesson repeats and filtered words", () => {
    const lessons = [
      "basta, the handshake starts here. kunwari, kunwari. fuck.",
      "basta, the handshake ends there. sandali. fuck.",
    ];

    const phrases = extractSpeechStyle(lessons, ["handshake"]);

    expect(phrases).toContain("basta");
    expect(phrases.join(" ")).not.toMatch(/\b(handshake|kunwari|sandali|fuck)\b/i);
  });
});
