import { describe, expect, it } from "vitest";
import { isConceptCovered, isQuestionCorrect } from "../quiz";

const covered = { inAnswer: true, inPages: true, consistentWithReference: true };

describe("quiz requires all three checks per concept and two-thirds coverage per question", () => {
  it("covers a concept when the answer, pages, and reference all support it", () => {
    expect(isConceptCovered(covered)).toBe(true);
  });

  it.each(["inAnswer", "inPages", "consistentWithReference"] as const)("leaves a concept uncovered when %s is false", (missing) => {
    expect(isConceptCovered({ ...covered, [missing]: false })).toBe(false);
  });

  it("still needs both concepts when a question has two", () => {
    expect(isQuestionCorrect([covered, { ...covered }])).toBe(true);
    expect(isQuestionCorrect([covered, { ...covered, inPages: false }])).toBe(false);
    expect(isQuestionCorrect([{ ...covered, inAnswer: false }, covered])).toBe(false);
  });

  it("marks the question correct when at least two-thirds of its concepts are covered", () => {
    const missed = { ...covered, inAnswer: false };
    expect(isQuestionCorrect([covered, covered, missed])).toBe(true);
    expect(isQuestionCorrect([covered, missed, missed])).toBe(false);
    expect(isQuestionCorrect([covered, covered, covered, missed])).toBe(true);
    expect(isQuestionCorrect([covered, covered, missed, missed])).toBe(false);
    expect(isQuestionCorrect([covered])).toBe(true);
    expect(isQuestionCorrect([missed])).toBe(false);
    expect(isQuestionCorrect([])).toBe(false);
  });
});
