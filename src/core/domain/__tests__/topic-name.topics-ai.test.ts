/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

type NameResult = { ok: true; value: string } | { ok: false };

interface TopicNameModule {
  validateSubjectName(value: string): NameResult;
  validateTopicName(value: string): NameResult;
}

const modules = import.meta.glob<TopicNameModule>("../topic-name.ts");

describe.each([
  { label: "subject", method: "validateSubjectName", max: 40 },
  { label: "topic", method: "validateTopicName", max: 60 },
] as const)("$label name (SEC-Q1)", ({ method, max }) => {
  async function validate(value: string) {
    const load = modules["../topic-name.ts"];
    if (!load) throw new Error("Missing domain rule: src/core/domain/topic-name.ts");
    return (await load())[method](value);
  }

  it("accepts the inclusive boundaries after removing controls and trimming", async () => {
    await expect(validate(" \u0000X\u007f ")).resolves.toMatchObject({ ok: true, value: "X" });
    const longest = "A".repeat(max);
    await expect(validate(`  ${longest}\u0007  `)).resolves.toMatchObject({ ok: true, value: longest });
    await expect(validate(`\u0000${longest}Z`)).resolves.toMatchObject({ ok: false });
  });

  it("strips embedded control characters and preserves meaningful text", async () => {
    await expect(validate("  Pan\u0000itikan\u009f at A\u007fraling Pilipino  ")).resolves.toMatchObject({
      ok: true,
      value: "Panitikan at Araling Pilipino",
    });
  });

  it.each(["", "  \u0000\u007f  "])("rejects an empty normalized name (%j)", async (value) => {
    await expect(validate(value)).resolves.toMatchObject({ ok: false });
  });

  it.each(["Intro to FUCK", "Survey of FU\u0000CK", "Mga GAGO"])(
    "rejects blocked words in a normalized name (%j)",
    async (value) => {
      await expect(validate(value)).resolves.toMatchObject({ ok: false });
    },
  );
});
