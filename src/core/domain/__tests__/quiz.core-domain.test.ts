import { describe, expect, it } from "vitest";
import { isConceptCovered, isQuestionCorrect } from "../quiz";

const covered = { inAnswer: true, inPages: true, consistentWithReference: true };

describe("quiz requires all three checks per concept and full coverage per question", () => {
  it("covers a concept when the answer, pages, and reference all support it", () => {
    expect(isConceptCovered(covered)).toBe(true);
  });

  it.each(["inAnswer", "inPages", "consistentWithReference"] as const)("leaves a concept uncovered when %s is false", (missing) => {
    expect(isConceptCovered({ ...covered, [missing]: false })).toBe(false);
  });

  it("marks the question correct only when every concept is covered", () => {
    expect(isQuestionCorrect([covered, { ...covered }])).toBe(true);
    expect(isQuestionCorrect([covered, { ...covered, inPages: false }])).toBe(false);
    expect(isQuestionCorrect([{ ...covered, inAnswer: false }, covered])).toBe(false);
  });
});
