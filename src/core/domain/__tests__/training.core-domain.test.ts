import { describe, expect, it } from "vitest";
import { growthStage, trainingMeter } from "../training";

describe("trainingMeter counts mastery from the latest attempt for each distinct question", () => {
  const earlier = new Date("2026-11-19T00:00:00.000Z");
  const later = new Date("2026-11-20T00:00:00.000Z");

  it("uses attempt timestamps when a new answer changes mastery", () => {
    expect(trainingMeter([
      { questionId: "syn", attemptedAt: later, correct: false },
      { questionId: "syn", attemptedAt: earlier, correct: true },
    ])).toBe(0);
    expect(trainingMeter([
      { questionId: "ack", attemptedAt: later, correct: true },
      { questionId: "ack", attemptedAt: earlier, correct: false },
    ])).toBe(1);
  });

  it("gives a repeat correct answer no extra credit and counts a new question", () => {
    const first = { questionId: "syn", attemptedAt: earlier, correct: true };
    const repeat = { questionId: "syn", attemptedAt: later, correct: true };
    const other = { questionId: "ack", attemptedAt: later, correct: true };

    expect(trainingMeter([first])).toBe(1);
    expect(trainingMeter([first, repeat])).toBe(1);
    expect(trainingMeter([first, repeat, other])).toBe(2);
  });
});

describe("growthStage requires 5, 15, and 30 mastered questions and three 80% topics for Genius", () => {
  it.each([
    { mastered: 0, topicMastery: [], expected: "Hatchling" },
    { mastered: 4, topicMastery: [], expected: "Hatchling" },
    { mastered: 5, topicMastery: [], expected: "Sprout" },
    { mastered: 14, topicMastery: [], expected: "Sprout" },
    { mastered: 15, topicMastery: [], expected: "Scholar" },
    { mastered: 29, topicMastery: [1, 0.9, 0.8], expected: "Scholar" },
    { mastered: 30, topicMastery: [1, 0.9], expected: "Scholar" },
    { mastered: 30, topicMastery: [1, 0.9, 0.79], expected: "Scholar" },
    { mastered: 30, topicMastery: [0.79, 1, 0.9, 0.8], expected: "Genius" },
  ])("is $expected with $mastered mastered questions and topic mastery $topicMastery", ({ mastered, topicMastery, expected }) => {
    expect(growthStage(mastered, topicMastery)).toBe(expected);
  });
});
