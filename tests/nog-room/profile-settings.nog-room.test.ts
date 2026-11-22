/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { changedSettings, savedSettings, type ProfileSettings } from "./fixtures";

type Deps = ReturnType<typeof createInMemoryPorts>["deps"];
type ReadSettings = (
  deps: Deps,
) => Promise<{ status: "ok"; settings: ProfileSettings } | { status: "unauthenticated" }>;
type UpdateSettings = (deps: Deps, settings: ProfileSettings) => Promise<unknown>;

const readPath = "../../src/core/application/use-cases/get-profile-settings.ts";
const updatePath = "../../src/core/application/use-cases/update-profile-settings.ts";
const readModules = import.meta.glob<{ getProfileSettings: ReadSettings }>(
  "../../src/core/application/use-cases/get-profile-settings.ts",
);
const updateModules = import.meta.glob<{ updateProfileSettings: UpdateSettings }>(
  "../../src/core/application/use-cases/update-profile-settings.ts",
);

async function getProfileSettings(deps: Deps) {
  const load = readModules[readPath];
  if (!load) throw new Error("Missing use case: src/core/application/use-cases/get-profile-settings.ts");
  return (await load()).getProfileSettings(deps);
}

async function updateProfileSettings(deps: Deps, settings: ProfileSettings) {
  const load = updateModules[updatePath];
  if (!load) throw new Error("Missing use case: src/core/application/use-cases/update-profile-settings.ts");
  return (await load()).updateProfileSettings(deps, settings);
}

describe("getProfileSettings", () => {
  it("returns usable defaults for a learner with no saved preferences", async () => {
    const { deps } = createInMemoryPorts();

    await expect(getProfileSettings(deps)).resolves.toMatchObject({
      status: "ok",
      settings: {
        grillMode: "roast",
        micMode: "tap",
        voiceEnabled: expect.any(Boolean),
        soundsEnabled: expect.any(Boolean),
      },
    });
  });

  it("requires a session to read profile settings", async () => {
    const { deps, setUser } = createInMemoryPorts();
    setUser(null);

    await expect(getProfileSettings(deps)).resolves.toEqual({ status: "unauthenticated" });
  });
});

describe("updateProfileSettings", () => {
  it("persists all four settings and reads them back independently for each learner", async () => {
    const { deps, setUser } = createInMemoryPorts({ userId: "learner-a" });

    await expect(updateProfileSettings(deps, savedSettings)).resolves.toMatchObject({ status: "ok" });
    await expect(getProfileSettings(deps)).resolves.toMatchObject({ status: "ok", settings: savedSettings });

    setUser("learner-b");
    await expect(getProfileSettings(deps)).resolves.toMatchObject({
      status: "ok",
      settings: { grillMode: "roast", micMode: "tap" },
    });
    await expect(updateProfileSettings(deps, changedSettings)).resolves.toMatchObject({ status: "ok" });
    await expect(getProfileSettings(deps)).resolves.toMatchObject({ status: "ok", settings: changedSettings });

    setUser("learner-a");
    await expect(getProfileSettings(deps)).resolves.toMatchObject({ status: "ok", settings: savedSettings });
  });

  it("rejects anonymous updates and preserves the previously signed-in learner's preferences", async () => {
    const { deps, setUser } = createInMemoryPorts({ userId: "learner-a" });
    await expect(updateProfileSettings(deps, savedSettings)).resolves.toMatchObject({ status: "ok" });

    setUser(null);
    await expect(updateProfileSettings(deps, changedSettings)).resolves.toEqual({ status: "unauthenticated" });

    setUser("learner-a");
    await expect(getProfileSettings(deps)).resolves.toMatchObject({ status: "ok", settings: savedSettings });
  });
});
