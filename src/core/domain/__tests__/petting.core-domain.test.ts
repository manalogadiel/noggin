import { describe, expect, it } from "vitest";
import { applyPettingHappiness } from "../petting";

describe("applyPettingHappiness grants at most five happiness points per day", () => {
  it("awards a petting bonus, clamps the next bonus, and awards zero at the cap", () => {
    const first = applyPettingHappiness({ happiness: 30, happinessToday: 0 }, 3);
    expect(first).toEqual({ happiness: 33, happinessToday: 3 });

    const second = applyPettingHappiness(first, 3);
    expect(second).toEqual({ happiness: 35, happinessToday: 5 });

    expect(applyPettingHappiness(second, 3)).toEqual({ happiness: 35, happinessToday: 5 });
  });
});
