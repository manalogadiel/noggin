import { describe, expect, it } from "vitest";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { REST_DAY_OPTIONS, startRest, wakeNog } from "@/core/application/use-cases/rest-nog";
import type { NogRecord } from "@/core/application/ports";

const now = new Date("2026-11-22T08:00:00.000Z");

function nog(overrides: Partial<NogRecord> = {}): NogRecord {
  return {
    id: "nog-1",
    ownerId: "student-1",
    subjectId: "subject-1",
    subjectName: "Networking",
    name: "Pingu",
    stage: "hatchling",
    ...overrides,
  };
}

function setup(nogs: NogRecord[] = [nog()]) {
  return createInMemoryPorts({ userId: "student-1", now, nogs });
}

describe("rest-nog use cases", () => {
  it("offers 1, 2, 3 and 7 days", () => {
    expect([...REST_DAY_OPTIONS]).toEqual([1, 2, 3, 7]);
  });

  it("sets rest_until to now plus the chosen days", async () => {
    const { deps, stores } = setup();
    const result = await startRest(deps, { nogId: "nog-1", days: 2 });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.nog.restUntil).toBe("2026-11-24T08:00:00.000Z");
    expect(stores.nogs.find((n) => n.id === "nog-1")?.restUntil).toBe("2026-11-24T08:00:00.000Z");
  });

  it("rejects day counts that are not offered", async () => {
    const { deps, stores } = setup();
    for (const days of [0, 4, -1, 1.5, 30]) {
      await expect(startRest(deps, { nogId: "nog-1", days })).resolves.toEqual({ status: "invalid" });
    }
    expect(stores.nogs[0].restUntil ?? null).toBeNull();
  });

  it("wakes the Nog by clearing rest_until", async () => {
    const { deps, stores } = setup([nog({ restUntil: "2026-11-24T08:00:00.000Z" })]);
    const result = await wakeNog(deps, { nogId: "nog-1" });
    expect(result.status).toBe("ok");
    expect(stores.nogs[0].restUntil ?? null).toBeNull();
  });

  it("returns not_found for another student's Nog and unauthenticated when signed out", async () => {
    const { deps, setUser } = setup([nog({ ownerId: "someone-else" })]);
    await expect(startRest(deps, { nogId: "nog-1", days: 2 })).resolves.toEqual({ status: "not_found" });
    await expect(wakeNog(deps, { nogId: "nog-1" })).resolves.toEqual({ status: "not_found" });
    setUser(null);
    await expect(startRest(deps, { nogId: "nog-1", days: 2 })).resolves.toEqual({ status: "unauthenticated" });
  });
});
