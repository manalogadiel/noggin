import { describe, expect, it } from "vitest";
import { groundQuote } from "@/core/domain/quote-grounding";
import { filterGroundedOperations } from "@/core/application/use-cases/teach-lesson";
import type { DigestOperation } from "@/core/application/ports";

describe("groundQuote", () => {
  const page =
    "uhm so the client sends a SYN first, parang hello, tapos the server sends back SYN-ACK… ay mali, SYN-ACK means it agrees and sends its own number, then client says ACK";

  it("returns an exact quote unchanged", () => {
    expect(groundQuote(page, "the client sends a SYN first")).toBe("the client sends a SYN first");
  });

  it("ignores capitalisation and trailing punctuation differences", () => {
    expect(groundQuote(page, "The client sends a SYN first.")).toBe("the client sends a SYN first");
  });

  it("matches a quote the model cleaned of fillers and returns the original span with them", () => {
    expect(groundQuote(page, "the client sends a SYN first, hello")).toBe(
      "the client sends a SYN first, parang hello",
    );
    expect(groundQuote("Uhm the server, uh, replies SYN-ACK.", "the server replies SYN-ACK")).toBe(
      "the server, uh, replies SYN-ACK",
    );
  });

  it("treats curly quotes, apostrophes and dashes like their plain versions", () => {
    const body = "It happens in the chloroplast’s “thylakoid” — not the stroma.";
    expect(groundQuote(body, `the chloroplast's "thylakoid" - not the stroma`)).toBe(
      "the chloroplast’s “thylakoid” — not the stroma",
    );
  });

  it("maps the prompt's safe angle brackets back to the real characters", () => {
    const body = "the router checks if dest ip < 10.0.0.255 then it forwards locally";
    expect(groundQuote(body, "checks if dest ip ‹ 10.0.0.255 then it forwards locally")).toBe(
      "checks if dest ip < 10.0.0.255 then it forwards locally",
    );
  });

  it("keeps internal hyphens and apostrophes inside words", () => {
    expect(groundQuote("Then 'yung server sends SYN-ACK back.", "'yung server sends SYN-ACK")).toBe(
      "yung server sends SYN-ACK",
    );
    expect(groundQuote("The server's reply is SYN-ACK.", "the servers reply is SYN-ACK")).toBeNull();
  });

  it("returns the first occurrence when the quote appears twice", () => {
    const body = "ACK confirms. Later, ACK confirms again.";
    expect(groundQuote(body, "ACK confirms")).toBe("ACK confirms");
  });

  it("rejects quotes that are not in the page, empty, or only one word of a longer page", () => {
    expect(groundQuote(page, "the server sends SYN first")).toBeNull();
    expect(groundQuote(page, "   ")).toBeNull();
    expect(groundQuote(page, "SYN")).toBeNull();
    expect(groundQuote(page, "uhm parang")).toBeNull();
  });

  it("accepts a single word when the page itself is a single word", () => {
    expect(groundQuote("Photosynthesis.", "photosynthesis")).toBe("Photosynthesis");
  });
});

describe("filterGroundedOperations with tolerant grounding", () => {
  const body = "Uhm the client sends SYN first. The server, uh, replies SYN-ACK.";

  it("replaces each quote with the verbatim page span and drops ungrounded ones", () => {
    const ops: DigestOperation[] = [
      { type: "create", label: "SYN", paraphrase: "Client starts with SYN.", status: "understood", quote: "The client sends SYN first." },
      { type: "create", label: "SYN-ACK", paraphrase: "Server answers SYN-ACK.", status: "understood", quote: "the server replies SYN-ACK" },
      { type: "create", label: "Made up", paraphrase: "Not in the page.", status: "understood", quote: "the server sends FIN" },
    ];

    const kept = filterGroundedOperations(ops, body);

    expect(kept).toHaveLength(2);
    expect(kept[0]).toMatchObject({ type: "create", quote: "the client sends SYN first" });
    expect(kept[1]).toMatchObject({ type: "create", quote: "The server, uh, replies SYN-ACK" });
    for (const op of kept) {
      expect(body.includes((op as { quote: string }).quote)).toBe(true);
    }
  });

  it("still drops updates for unknown cards and keeps quote-less updates for known cards", () => {
    const ops: DigestOperation[] = [
      { type: "update", cardId: "card-unknown", paraphrase: "x", quote: "the client sends SYN first" },
      { type: "update", cardId: "card-1", status: "understood" },
      { type: "update", cardId: "card-1", quote: "THE CLIENT SENDS SYN FIRST" },
    ];

    const kept = filterGroundedOperations(ops, body, [{ id: "card-1" }]);

    expect(kept).toHaveLength(2);
    expect(kept[1]).toMatchObject({ cardId: "card-1", quote: "the client sends SYN first" });
  });
});
