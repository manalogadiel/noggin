import { describe, expect, it } from "vitest";

const loadSimilarity = () => import("@/core/domain/card-similarity");

describe("textSimilarity", () => {
  it("returns 1 after normalizing case, punctuation, and speech fillers", async () => {
    const { textSimilarity } = await loadSimilarity();

    expect(
      textSimilarity(
        'Uhm, UH, parang, ano, bale, like... The client sends "SYN-ACK"!',
        "the client sends syn-ack",
      ),
    ).toBe(1);
  });

  it("scores the same words in a different order at least 0.85", async () => {
    const { textSimilarity } = await loadSimilarity();

    expect(
      textSimilarity(
        "The client sends SYN before the server responds",
        "Before the server responds the client sends SYN",
      ),
    ).toBeGreaterThanOrEqual(0.85);
  });

  it("scores unrelated lessons below 0.5", async () => {
    const { textSimilarity } = await loadSimilarity();

    expect(
      textSimilarity("Routers forward packets", "Orchids bloom indoors"),
    ).toBeLessThan(0.5);
  });

  it("is symmetric even when the texts have different lengths", async () => {
    const { textSimilarity } = await loadSimilarity();
    const short = "The client sends SYN";
    const long = "The client sends SYN before the server responds";

    expect(textSimilarity(short, long)).toBe(textSimilarity(long, short));
  });

  it("compares ACK with the entire SYN-ACK token", async () => {
    const { textSimilarity } = await loadSimilarity();

    expect(textSimilarity("ACK", "SYN-ACK")).toBeLessThan(0.5);
  });
});
