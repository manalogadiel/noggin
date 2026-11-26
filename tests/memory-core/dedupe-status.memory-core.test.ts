import { describe, expect, it } from "vitest";
import { dedupeCreateOperations } from "@/core/application/use-cases/teach-lesson";

const card = {
  id: "card-1",
  label: "SYN first",
  paraphrase: "The client sends the SYN segment first.",
  status: "understood" as const,
};

function repeat(status: "understood" | "shaky" | "confused") {
  return dedupeCreateOperations(
    [
      {
        type: "create",
        label: "SYN first",
        paraphrase: "The client sends the SYN segment first.",
        status,
        quote: "the client sends SYN first",
      },
    ],
    [card],
  );
}

describe("dedupeCreateOperations status", () => {
  it("does not lower an understood card when a repeat lesson is vaguer", () => {
    const [op] = repeat("confused");
    expect(op).toEqual({ type: "reinforce", cardId: "card-1", quote: "the client sends SYN first" });
  });

  it("keeps the status when the repeat is just as clear", () => {
    const [op] = repeat("understood");
    expect(op).toMatchObject({ type: "reinforce", status: "understood" });
  });

  it("raises a shaky card when the repeat is clearer", () => {
    const [op] = dedupeCreateOperations(
      [{ type: "create", label: card.label, paraphrase: card.paraphrase, status: "understood", quote: "q" }],
      [{ ...card, status: "shaky" }],
    );
    expect(op).toMatchObject({ type: "reinforce", status: "understood" });
  });
});
