/// <reference types="vite/client" />

import { describe, expect, it, vi } from "vitest";
import type { NogRecord } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";

export interface NogBodyColorPreset {
  id: "cream" | "lavender" | "pink" | "sky";
  label: string;
  hex: string | null;
}

export type ParseBodyColorResult =
  | { ok: true; value: string | null }
  | { ok: false };

interface NogColorsDomainModule {
  NOG_BODY_COLORS: readonly NogBodyColorPreset[];
  parseBodyColor: (value: unknown) => ParseBodyColorResult;
}

type CustomizeDeps = Pick<
  ReturnType<typeof createInMemoryPorts>["deps"],
  "currentUser" | "nogs"
>;

export type CustomizeNogResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "ok"; nog: NogRecord & { colors?: { body?: string | null } } };

interface CustomizeNogUseCaseModule {
  customizeNog: (
    deps: CustomizeDeps,
    input: { nogId: string; body: string | null },
  ) => Promise<CustomizeNogResult>;
}

const domainPath = "../../src/core/domain/nog-colors.ts";
const domainModules = import.meta.glob<NogColorsDomainModule>(
  "../../src/core/domain/nog-colors.ts",
);

const useCasePath = "../../src/core/application/use-cases/customize-nog.ts";
const useCaseModules = import.meta.glob<CustomizeNogUseCaseModule>(
  "../../src/core/application/use-cases/customize-nog.ts",
);

async function loadDomain(): Promise<NogColorsDomainModule> {
  const loader = domainModules[domainPath];
  if (!loader) {
    throw new Error("Missing domain module: src/core/domain/nog-colors.ts");
  }
  return loader();
}

async function loadUseCase(): Promise<CustomizeNogUseCaseModule> {
  const loader = useCaseModules[useCasePath];
  if (!loader) {
    throw new Error(
      "Missing use case: src/core/application/use-cases/customize-nog.ts",
    );
  }
  return loader();
}

const ownerNog: NogRecord & { colors?: { body?: string | null } } = {
  id: "nog-packet",
  ownerId: "learner-a",
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Packet",
  stage: "sprout",
  happiness: 75,
};

const otherNog: NogRecord & { colors?: { body?: string | null } } = {
  id: "nog-other",
  ownerId: "learner-b",
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Other",
  stage: "hatchling",
  happiness: 70,
};

describe("nog-colors domain (NOG_BODY_COLORS & parseBodyColor)", () => {
  it("defines the four Figma body color presets with Cream as null tint", async () => {
    const { NOG_BODY_COLORS } = await loadDomain();

    expect(NOG_BODY_COLORS).toEqual([
      { id: "cream", label: "Cream", hex: null },
      { id: "lavender", label: "Lavender", hex: "#d9c8f5" },
      { id: "pink", label: "Pink", hex: "#ffc2e6" },
      { id: "sky", label: "Sky", hex: "#c4eef5" },
    ]);
  });

  it("accepts null to reset to the default Cream body color", async () => {
    const { parseBodyColor } = await loadDomain();

    expect(parseBodyColor(null)).toMatchObject({ ok: true, value: null });
  });

  it.each([
    ["#d9c8f5", "#d9c8f5"],
    ["#FFC2E6", "#ffc2e6"],
    ["#c4eef5", "#c4eef5"],
    ["#34A853", "#34a853"],
    ["  #A1B2C3  ", "#a1b2c3"],
  ])("normalizes valid 6-digit hex %s to lower-case %s", async (input, expected) => {
    const { parseBodyColor } = await loadDomain();

    expect(parseBodyColor(input)).toMatchObject({ ok: true, value: expected });
  });

  it.each<unknown>([
    "",
    "   ",
    "cream",
    "lavender",
    "#fff",
    "#1234",
    "#12345",
    "#1234567",
    "#123456ff",
    "d9c8f5",
    "#12345g",
    "rgb(217, 200, 245)",
    "red; background: url(evil)",
    undefined,
    42,
    {},
  ])("rejects invalid body color %j", async (invalidInput) => {
    const { parseBodyColor } = await loadDomain();

    expect(parseBodyColor(invalidInput)).toMatchObject({ ok: false });
  });
});

describe("customizeNog use case", () => {
  it("returns unauthenticated when no user is signed in", async () => {
    const { deps, setUser } = createInMemoryPorts({
      userId: ownerNog.ownerId,
      nogs: [{ ...ownerNog }],
    });
    setUser(null);
    const { customizeNog } = await loadUseCase();

    await expect(
      customizeNog(deps, { nogId: ownerNog.id, body: "#d9c8f5" }),
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("returns not_found when the Nog does not exist or belongs to another user", async () => {
    const { deps, stores } = createInMemoryPorts({
      userId: ownerNog.ownerId,
      nogs: [{ ...ownerNog }, { ...otherNog }],
    });
    const { customizeNog } = await loadUseCase();

    await expect(
      customizeNog(deps, { nogId: "missing-nog", body: "#d9c8f5" }),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      customizeNog(deps, { nogId: otherNog.id, body: "#d9c8f5" }),
    ).resolves.toEqual({ status: "not_found" });

    const untouchedOther = stores.nogs.find((n) => n.id === otherNog.id) as
      | (NogRecord & { colors?: { body?: string | null } })
      | undefined;
    expect(untouchedOther?.colors?.body).toBeUndefined();
  });

  it("returns invalid for malformed colors without updating the stored Nog", async () => {
    const { deps } = createInMemoryPorts({
      userId: ownerNog.ownerId,
      nogs: [{ ...ownerNog }],
    });
    const { customizeNog } = await loadUseCase();

    await expect(
      customizeNog(deps, { nogId: ownerNog.id, body: "not-a-hex" }),
    ).resolves.toEqual({ status: "invalid" });

    await expect(
      customizeNog(deps, { nogId: ownerNog.id, body: "#fff" }),
    ).resolves.toEqual({ status: "invalid" });

    const stored = (await deps.nogs.findOwned(
      ownerNog.ownerId,
      ownerNog.id,
    )) as (NogRecord & { colors?: { body?: string | null } }) | null;
    expect(stored?.colors?.body).toBeUndefined();
  });

  it("saves a preset or custom hex color (lower-cased) on the owned Nog", async () => {
    const { deps } = createInMemoryPorts({
      userId: ownerNog.ownerId,
      nogs: [{ ...ownerNog }],
    });
    const { customizeNog } = await loadUseCase();

    const result = await customizeNog(deps, {
      nogId: ownerNog.id,
      body: "#FFC2E6",
    });

    expect(result).toMatchObject({
      status: "ok",
      nog: {
        id: ownerNog.id,
        colors: { body: "#ffc2e6" },
      },
    });

    const persisted = await deps.nogs.findOwned(ownerNog.ownerId, ownerNog.id);
    expect(persisted).toMatchObject({
      id: ownerNog.id,
      colors: { body: "#ffc2e6" },
    });
  });

  it("resets the Nog's body color back to null (Cream) after a tint was saved", async () => {
    const tintedNog: NogRecord & { colors?: { body?: string | null } } = {
      ...ownerNog,
      colors: { body: "#c4eef5" },
    };
    const { deps } = createInMemoryPorts({
      userId: ownerNog.ownerId,
      nogs: [tintedNog],
    });
    const { customizeNog } = await loadUseCase();

    const resetResult = await customizeNog(deps, {
      nogId: ownerNog.id,
      body: null,
    });

    expect(resetResult).toMatchObject({
      status: "ok",
      nog: {
        id: ownerNog.id,
        colors: { body: null },
      },
    });

    const persisted = await deps.nogs.findOwned(ownerNog.ownerId, ownerNog.id);
    expect(persisted).toMatchObject({
      id: ownerNog.id,
      colors: { body: null },
    });
  });

  it("exposes updateColors on the in-memory NogRepository fake", async () => {
    const { deps } = createInMemoryPorts({
      userId: ownerNog.ownerId,
      nogs: [{ ...ownerNog }, { ...otherNog }],
    });
    const repo = deps.nogs as typeof deps.nogs & {
      updateColors?: (
        ownerId: string,
        nogId: string,
        colors: { body?: string | null },
      ) => Promise<(NogRecord & { colors?: { body?: string | null } }) | null>;
    };

    expect(typeof repo.updateColors).toBe("function");
    if (!repo.updateColors) {
      throw new Error("NogRepository.updateColors is not implemented on fakes");
    }

    const updated = await repo.updateColors(ownerNog.ownerId, ownerNog.id, {
      body: "#d9c8f5",
    });
    expect(updated).toMatchObject({
      id: ownerNog.id,
      colors: { body: "#d9c8f5" },
    });

    const crossOwner = await repo.updateColors(ownerNog.ownerId, otherNog.id, {
      body: "#d9c8f5",
    });
    expect(crossOwner).toBeNull();
    const otherSpy = vi.spyOn(repo, "findOwned");
    await expect(
      repo.findOwned(otherNog.ownerId, otherNog.id),
    ).resolves.not.toMatchObject({
      colors: { body: "#d9c8f5" },
    });
    expect(otherSpy).toHaveBeenCalledOnce();
  });
});
