import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddTopicResult } from "@/core/application/use-cases/add-topic";
import type { CustomizeNogResult } from "@/core/application/use-cases/customize-nog";
import type { HatchNogResult } from "@/core/application/use-cases/hatch-nog";

const {
  createContainer,
  redirect,
  revalidatePath,
  hatchNog,
  customizeNog,
  addTopic,
  getPlayerEconomy,
  updatePlayerPreferences,
} = vi.hoisted(() => ({
  createContainer: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  hatchNog: vi.fn<
    (input: { subjectName: string; name: string }) => Promise<HatchNogResult>
  >(),
  customizeNog: vi.fn<
    (input: { nogId: string; body: string | null; name?: string }) => Promise<CustomizeNogResult>
  >(),
  addTopic: vi.fn<
    (input: { nogId: string; title: string }) => Promise<AddTopicResult>
  >(),
  getPlayerEconomy: vi.fn(),
  updatePlayerPreferences: vi.fn(),
}));

vi.mock("@/composition/container", () => ({
  createContainer,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

import {
  completeOnboardingAction,
  hatchNogAction,
} from "@/app/(app)/actions/nog-actions";
import { NOG_BODY_COLORS } from "@/core/domain/nog-colors";

const LAVENDER_BODY_COLOR = NOG_BODY_COLORS[1].hex;

function makeFormData(subjectName: string, name: string): FormData {
  const formData = new FormData();
  formData.set("subjectName", subjectName);
  formData.set("name", name);
  return formData;
}

const sampleNog = {
  id: "nog-123",
  ownerId: "user-1",
  subjectId: "subj-1",
  subjectName: "Cell Mitosis",
  name: "Pingu",
  stage: "hatchling" as const,
  mood: "happy",
  happiness: 70,
  happinessToday: 0,
  happinessDay: null,
};

beforeEach(() => {
  hatchNog.mockReset();
  customizeNog.mockReset();
  addTopic.mockReset();
  getPlayerEconomy.mockReset();
  updatePlayerPreferences.mockReset();
  redirect.mockClear();
  revalidatePath.mockClear();
  createContainer.mockReset();
  createContainer.mockResolvedValue({
    hatchNog,
    customizeNog,
    addTopic,
    getPlayerEconomy,
    updatePlayerPreferences,
  });
});

describe("completeOnboardingAction", () => {
  it("hatches the Nog, saves tint, creates the first notebook, persists cover prefs, and revalidates", async () => {
    hatchNog.mockResolvedValueOnce({ status: "ok", nog: sampleNog });
    customizeNog.mockResolvedValueOnce({
      status: "ok",
      nog: { ...sampleNog, colors: { body: LAVENDER_BODY_COLOR } },
    });
    addTopic.mockResolvedValueOnce({
      status: "ok",
      topic: {
        id: "topic-1",
        subjectId: "subj-1",
        slug: "cell-mitosis",
        title: "Cell Mitosis",
        status: "ready",
        questionCount: 8,
      },
    });
    getPlayerEconomy.mockResolvedValueOnce({
      status: "ok",
      state: { notebookPrefs: { "old-topic": { cover: "honey", title: "Old" } } },
    });
    updatePlayerPreferences.mockResolvedValueOnce({ status: "ok" });

    const result = await completeOnboardingAction({
      name: "Pingu",
      bodyColor: LAVENDER_BODY_COLOR,
      notebookTitle: "Cell Mitosis",
      coverStyle: "berry",
      equippedSlots: ["glasses", null, null, null],
    });

    expect(result).toEqual({
      status: "ok",
      nogId: "nog-123",
      topicId: "topic-1",
    });
    expect(hatchNog).toHaveBeenCalledWith({
      subjectName: "Cell Mitosis",
      name: "Pingu",
    });
    expect(customizeNog).toHaveBeenCalledWith({
      nogId: "nog-123",
      body: LAVENDER_BODY_COLOR,
    });
    expect(addTopic).toHaveBeenCalledWith({
      nogId: "nog-123",
      title: "Cell Mitosis",
    });
    expect(updatePlayerPreferences).toHaveBeenCalledWith({
      equippedSlots: ["glasses", null, null, null],
      notebookPrefs: {
        "old-topic": { cover: "honey", title: "Old" },
        "topic-1": { cover: "berry", title: "Cell Mitosis" },
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/nogs/nog-123");
    expect(revalidatePath).toHaveBeenCalledWith("/nogs/nog-123/notebook");
  });

  it("retries seamlessly with a suffixed backing subject when a subject slug collision occurs", async () => {
    hatchNog
      .mockResolvedValueOnce({ status: "already_exists", existing: sampleNog })
      .mockResolvedValueOnce({
        status: "ok",
        nog: { ...sampleNog, id: "nog-456", name: "Mochi" },
      });
    addTopic.mockResolvedValueOnce({
      status: "pending",
      topic: {
        id: "topic-2",
        subjectId: "subj-2",
        slug: "cell-mitosis",
        title: "Cell Mitosis",
        status: "pending",
        questionCount: 0,
      },
    });
    getPlayerEconomy.mockResolvedValueOnce({
      status: "ok",
      state: { notebookPrefs: {} },
    });
    updatePlayerPreferences.mockResolvedValueOnce({ status: "ok" });

    const result = await completeOnboardingAction({
      name: "Mochi",
      bodyColor: null,
      notebookTitle: "Cell Mitosis",
      coverStyle: "sage",
    });

    expect(result).toEqual({
      status: "ok",
      nogId: "nog-456",
      topicId: "topic-2",
    });
    expect(hatchNog).toHaveBeenNthCalledWith(1, {
      subjectName: "Cell Mitosis",
      name: "Mochi",
    });
    expect(hatchNog).toHaveBeenNthCalledWith(2, {
      subjectName: "Cell Mitosis 2",
      name: "Mochi",
    });
    expect(customizeNog).not.toHaveBeenCalled();
  });

  it("rejects empty Nog name or invalid notebook title without calling container", async () => {
    const badName = await completeOnboardingAction({
      name: "   ",
      bodyColor: null,
      notebookTitle: "Cell Mitosis",
    });
    expect(badName.status).toBe("invalid_name");

    const badNotebook = await completeOnboardingAction({
      name: "Pingu",
      bodyColor: null,
      notebookTitle: "   ",
    });
    expect(badNotebook.status).toBe("invalid_notebook");
    expect(createContainer).not.toHaveBeenCalled();
  });
});

describe("hatchNogAction", () => {
  it("revalidates and redirects to the new Nog customize screen on success", async () => {
    hatchNog.mockResolvedValueOnce({
      status: "ok",
      nog: {
        ...sampleNog,
        subjectName: "Marine Biology",
        name: "Coral",
      },
    });

    await expect(
      hatchNogAction({}, makeFormData("Marine Biology", "Coral")),
    ).rejects.toThrow("NEXT_REDIRECT:/nogs/nog-123/customize");

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
        ...sampleNog,
        id: "nog-1",
        subjectId: "subj-net",
        subjectName: "Networking",
        name: "Packet",
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
