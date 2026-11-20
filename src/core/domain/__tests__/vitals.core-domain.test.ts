import { describe, expect, it } from "vitest";
import { vitals } from "../vitals";

describe("vitals computes Clarity from non-forgotten cards and faints when any vital is zero", () => {
  it("includes fresh and dusty cards of every status and excludes forgotten cards", () => {
    const result = vitals({
      happiness: 0.5,
      vitality: 0.5,
      cards: [
        { status: "understood", freshness: "fresh" },
        { status: "shaky", freshness: "dusty" },
        { status: "confused", freshness: "fresh" },
        { status: "understood", freshness: "forgotten" },
        { status: "confused", freshness: "forgotten" },
      ],
    });

    expect(result.clarity).toBeCloseTo(1 / 3);
  });

  it.each([
    { name: "all vitals positive", happiness: 0.5, vitality: 0.75, status: "understood", faint: false },
    { name: "zero Happiness", happiness: 0, vitality: 0.75, status: "understood", faint: true },
    { name: "zero Vitality", happiness: 0.5, vitality: 0, status: "understood", faint: true },
    { name: "zero Clarity", happiness: 0.5, vitality: 0.75, status: "confused", faint: true },
  ] as const)("sets faint to $faint with $name", ({ happiness, vitality, status, faint }) => {
    const result = vitals({ happiness, vitality, cards: [{ status, freshness: "fresh" }] });

    expect(result.clarity).toBe(status === "understood" ? 1 : 0);
    expect(result.faint).toBe(faint);
  });
});
