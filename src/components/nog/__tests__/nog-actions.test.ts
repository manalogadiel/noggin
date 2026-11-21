import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HatchNogResult } from "@/core/application/use-cases/hatch-nog";

const { createContainer, redirect, revalidatePath, hatchNog } = vi.hoisted(
  () => ({
    createContainer: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    revalidatePath: vi.fn(),
    hatchNog: vi.fn<
      (input: { subjectName: string; name: string }) => Promise<HatchNogResult>
    >(),
  }),
);

vi.mock("@/composition/container", () => ({
  createContainer,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

import { hatchNogAction } from "@/app/(app)/actions/nog-actions";

function makeFormData(subjectName: string, name: string): FormData {
  const formData = new FormData();
  formData.set("subjectName", subjectName);
  formData.set("name", name);
  return formData;
}

beforeEach(() => {
  hatchNog.mockReset();
  redirect.mockClear();
  revalidatePath.mockClear();
  createContainer.mockReset();
  createContainer.mockResolvedValue({ hatchNog });
});

describe("hatchNogAction", () => {
  it("revalidates and redirects to the new Nog room on success", async () => {
    hatchNog.mockResolvedValueOnce({
      status: "ok",
      nog: {
        id: "nog-123",
        ownerId: "user-1",
        subjectId: "subj-1",
        subjectName: "Marine Biology",
        name: "Coral",
        stage: "hatchling",
        mood: "happy",
        happiness: 70,
        happinessToday: 0,
        happinessDay: null,
      },
    });

    await expect(
      hatchNogAction({}, makeFormData("Marine Biology", "Coral")),
    ).rejects.toThrow("NEXT_REDIRECT:/nogs/nog-123");

    expect(hatchNog).toHaveBeenCalledWith({
      subjectName: "Marine Biology",
      name: "Coral",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/home");
    expect(revalidatePath).toHaveBeenCalledWith("/nogs");
  });

  it("returns already_exists with a clear message when a Nog for that subject exists", async () => {
    hatchNog.mockResolvedValueOnce({
      status: "already_exists",
      existing: {
        id: "nog-1",
        ownerId: "user-1",
        subjectId: "subj-net",
        subjectName: "Networking",
        name: "Packet",
        stage: "hatchling",
        mood: "happy",
        happiness: 70,
        happinessToday: 0,
        happinessDay: null,
      },
    });

    const state = await hatchNogAction({}, makeFormData("Networking", "Duplicate"));
    expect(state.status).toBe("already_exists");
    expect(state.error).toMatch(/already/i);
    expect(state.error).toMatch(/Networking/);
    expect(state.error).toMatch(/Packet/);
    expect(state.attempt).toBe(1);
  });

  it("returns invalid_subject when the subject is rejected", async () => {
    hatchNog.mockResolvedValueOnce({ status: "invalid_subject" });

    const state = await hatchNogAction({}, makeFormData("", "Coral"));
    expect(state.status).toBe("invalid_subject");
    expect(state.error).toMatch(/1 and 40/);
  });

  it("returns invalid_name when the Nog name is rejected", async () => {
    hatchNog.mockResolvedValueOnce({ status: "invalid_name" });

    const state = await hatchNogAction({}, makeFormData("Networking", ""));
    expect(state.status).toBe("invalid_name");
    expect(state.error).toMatch(/1 and 24/);
  });

  it("redirects to login when unauthenticated", async () => {
    hatchNog.mockResolvedValueOnce({ status: "unauthenticated" });

    await expect(
      hatchNogAction({}, makeFormData("Networking", "Packet")),
    ).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fadopt");
  });
});
