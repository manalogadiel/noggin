import { describe, expect, it } from "vitest";
import { runQuickCheck } from "../use-cases/run-quick-check";
import { makeFixture, ownerId, savedPage, scope } from "./fixtures";

describe("runQuickCheck", () => {
  it("returns not_taught when this topic has no pages, even if another topic has pages", async () => {
    const { deps } = makeFixture([{ ...savedPage, topicId: "dns" }]);

    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "not_taught" });

    expect(deps.brain.answer).not.toHaveBeenCalled();
    expect(deps.grader.grade).not.toHaveBeenCalled();
    expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
    expect(deps.attempts.recordCheck).not.toHaveBeenCalled();
  });

  it("returns the same saved attempts without spending quota on an unchanged notebook", async () => {
    const { deps, exhausted } = makeFixture([savedPage]);
    const first = await runQuickCheck(deps, scope);
    expect(first).toMatchObject({ status: "ok", attempts: [expect.objectContaining({ id: expect.any(String) })] });
    expect(deps.attempts.recordCheck).toHaveBeenCalledTimes(1);
    expect(deps.brain.answer).toHaveBeenCalledTimes(1);
    expect(deps.grader.grade).toHaveBeenCalledTimes(1);
    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "answer", 1);
    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "grade", 1);

    exhausted.add("answer");
    exhausted.add("grade");
    deps.usage.consumeQuota.mockClear();

    if (first.status !== "ok") throw new Error("The first check did not produce attempts");
    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "ok", attempts: first.attempts });

    expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
    expect(deps.brain.answer).toHaveBeenCalledTimes(1);
    expect(deps.grader.grade).toHaveBeenCalledTimes(1);
    expect(deps.attempts.recordCheck).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a replacement page ID", { id: "revision-page" }],
    ["a changed page timestamp", { updatedAt: "2026-11-21T04:00:00.000Z" }],
  ] as const)("runs a fresh check after %s changes the notebook fingerprint", async (_scenario, change) => {
    const { deps, pages } = makeFixture([savedPage]);
    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "ok" });
    pages[0] = { ...savedPage, ...change };

    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "ok" });

    expect(deps.brain.answer).toHaveBeenCalledTimes(2);
    expect(deps.grader.grade).toHaveBeenCalledTimes(2);
    expect(deps.attempts.recordCheck).toHaveBeenCalledTimes(2);
    const [[first], [second]] = deps.attempts.recordCheck.mock.calls;
    expect(first.attempts[0].notebookFingerprint).toEqual(expect.any(String));
    expect(second.attempts[0].notebookFingerprint).toEqual(expect.any(String));
    expect(second.attempts[0].notebookFingerprint).not.toBe(first.attempts[0].notebookFingerprint);
  });

  it("does not call either provider when the answer quota is exhausted", async () => {
    const { deps, exhausted } = makeFixture([savedPage]);
    exhausted.add("answer");

    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "tired_for_today" });

    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "answer", 1);
    expect(deps.brain.answer).not.toHaveBeenCalled();
    expect(deps.grader.grade).not.toHaveBeenCalled();
    expect(deps.attempts.recordCheck).not.toHaveBeenCalled();
  });

  it("does not call the grader or record an attempt when the grade quota is exhausted", async () => {
    const { deps, exhausted } = makeFixture([savedPage]);
    exhausted.add("grade");

    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "tired_for_today" });

    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "grade", 1);
    expect(deps.grader.grade).not.toHaveBeenCalled();
    expect(deps.attempts.recordCheck).not.toHaveBeenCalled();
  });

  it("consumes quota for each provider before calling it", async () => {
    const { deps } = makeFixture([savedPage]);

    await expect(runQuickCheck(deps, scope)).resolves.toMatchObject({ status: "ok" });

    const quotaCallOrder = (kind: "answer" | "grade") => {
      const index = deps.usage.consumeQuota.mock.calls.findIndex(([, requestedKind]) => requestedKind === kind);
      return deps.usage.consumeQuota.mock.invocationCallOrder[index];
    };
    expect(quotaCallOrder("answer")).toBeLessThan(deps.brain.answer.mock.invocationCallOrder[0]);
    expect(quotaCallOrder("grade")).toBeLessThan(deps.grader.grade.mock.invocationCallOrder[0]);
  });
});
