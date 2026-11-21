/// <reference types="vite/client" />

import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryPorts,
  type InMemoryPortsOptions,
} from "@/core/application/testing/fakes";
import {
  buildCheckAttempts,
  buildTopicQuestions,
  dnsTopic,
  dpTopic,
  geniusNog,
  graphsTopic,
  httpTopic,
  learnerId,
  now,
  otherOwnerNog,
  packetNog,
  sampleActivityEvents,
  sampleMasteryRows,
  samplePages,
  sproutNog,
  tcpTopic,
  treesTopic,
  type ActivityEvent,
  type GetLearningProgressResult,
  type GetRecentActivityResult,
  type TopicMasteryRow,
  type UpdateDisplayNameResult,
} from "./fixtures";

type ExtendedPortsOptions = InMemoryPortsOptions & {
  mastery?: TopicMasteryRow[];
  activity?: ActivityEvent[];
  displayNames?: Record<string, string>;
};

type ExtendedDeps = ReturnType<typeof createInMemoryPorts>["deps"] & {
  progress?: {
    listMastery: (ownerId: string) => Promise<TopicMasteryRow[]>;
  };
  activity?: {
    listRecent: (ownerId: string, limit?: number) => Promise<ActivityEvent[]>;
  };
  profiles: ReturnType<typeof createInMemoryPorts>["deps"]["profiles"] & {
    updateDisplayName?: (userId: string, name: string) => Promise<unknown>;
  };
};

interface GetLearningProgressModule {
  getLearningProgress: (
    deps: ExtendedDeps,
  ) => Promise<GetLearningProgressResult>;
}

interface GetRecentActivityModule {
  getRecentActivity: (
    deps: ExtendedDeps,
    input?: { limit?: number },
  ) => Promise<GetRecentActivityResult>;
}

interface UpdateProfileModule {
  updateDisplayName: (
    deps: ExtendedDeps,
    input: string,
  ) => Promise<UpdateDisplayNameResult>;
}

const progressPath =
  "../../src/core/application/use-cases/get-learning-progress.ts";
const progressModules = import.meta.glob<GetLearningProgressModule>(
  "../../src/core/application/use-cases/get-learning-progress.ts",
);

const activityPath =
  "../../src/core/application/use-cases/get-recent-activity.ts";
const activityModules = import.meta.glob<GetRecentActivityModule>(
  "../../src/core/application/use-cases/get-recent-activity.ts",
);

const updateProfilePath =
  "../../src/core/application/use-cases/update-profile.ts";
const updateProfileModules = import.meta.glob<UpdateProfileModule>(
  "../../src/core/application/use-cases/update-profile.ts",
);

async function loadGetLearningProgress(): Promise<
  GetLearningProgressModule["getLearningProgress"]
> {
  const loader = progressModules[progressPath];
  if (!loader) {
    throw new Error(
      "Missing use case: src/core/application/use-cases/get-learning-progress.ts",
    );
  }
  return (await loader()).getLearningProgress;
}

async function loadGetRecentActivity(): Promise<
  GetRecentActivityModule["getRecentActivity"]
> {
  const loader = activityModules[activityPath];
  if (!loader) {
    throw new Error(
      "Missing use case: src/core/application/use-cases/get-recent-activity.ts",
    );
  }
  return (await loader()).getRecentActivity;
}

async function loadUpdateDisplayName(): Promise<
  UpdateProfileModule["updateDisplayName"]
> {
  const loader = updateProfileModules[updateProfilePath];
  if (!loader) {
    throw new Error(
      "Missing use case: src/core/application/use-cases/update-profile.ts",
    );
  }
  return (await loader()).updateDisplayName;
}

function createExtendedPorts(options: ExtendedPortsOptions = {}) {
  return createInMemoryPorts(options) as ReturnType<
    typeof createInMemoryPorts
  > & {
    deps: ExtendedDeps;
  };
}

describe("getLearningProgress use case", () => {
  it("returns unauthenticated when no user is signed in", async () => {
    const { deps, setUser } = createExtendedPorts({
      userId: learnerId,
      nogs: [packetNog],
      mastery: sampleMasteryRows,
    });
    setUser(null);
    const getLearningProgress = await loadGetLearningProgress();

    await expect(getLearningProgress(deps)).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("returns zeroed summary stats and an empty Nogs list when the learner has no Nogs", async () => {
    const { deps } = createExtendedPorts({
      userId: learnerId,
      nogs: [otherOwnerNog],
      mastery: [
        {
          nogId: otherOwnerNog.id,
          topicId: tcpTopic.id,
          topicName: tcpTopic.title,
          mastered: 5,
          total: 8,
        },
      ],
    });
    const getLearningProgress = await loadGetLearningProgress();

    await expect(getLearningProgress(deps)).resolves.toEqual({
      status: "ok",
      summary: {
        nogs: 0,
        topicsWithProgress: 0,
        mastered: 0,
      },
      nogs: [],
    });
  });

  it("computes summary stats, growth thresholds (5/15/30), stage progress percentages, and per-Nog topic mastery rows", async () => {
    const otherMastery: TopicMasteryRow = {
      nogId: otherOwnerNog.id,
      topicId: tcpTopic.id,
      topicName: tcpTopic.title,
      mastered: 7,
      total: 8,
    };

    const { deps } = createExtendedPorts({
      userId: learnerId,
      now,
      nogs: [packetNog, sproutNog, geniusNog, otherOwnerNog],
      topics: [
        tcpTopic,
        dnsTopic,
        httpTopic,
        graphsTopic,
        dpTopic,
        treesTopic,
      ],
      questions: [
        ...buildTopicQuestions(tcpTopic.id, 8),
        ...buildTopicQuestions(httpTopic.id, 8),
        ...buildTopicQuestions(graphsTopic.id, 10),
        ...buildTopicQuestions(dpTopic.id, 10),
        ...buildTopicQuestions(treesTopic.id, 10),
      ],
      attempts: [
        ...buildCheckAttempts(packetNog.id, tcpTopic.id, 8, 3),
        ...buildCheckAttempts(sproutNog.id, httpTopic.id, 8, 6),
        ...buildCheckAttempts(geniusNog.id, graphsTopic.id, 10, 10),
        ...buildCheckAttempts(geniusNog.id, dpTopic.id, 10, 10),
        ...buildCheckAttempts(geniusNog.id, treesTopic.id, 10, 10),
        ...buildCheckAttempts(otherOwnerNog.id, tcpTopic.id, 8, 7),
      ],
      mastery: [...sampleMasteryRows, otherMastery],
    });
    const getLearningProgress = await loadGetLearningProgress();

    const result = await getLearningProgress(deps);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected ok result from getLearningProgress");
    }

    // 3 owned Nogs; 5 distinct topics have mastered > 0 (dnsTopic has 0/0); 3 + 6 + 30 = 39 mastered
    expect(result.summary).toEqual({
      nogs: 3,
      topicsWithProgress: 5,
      mastered: 39,
    });

    expect(result.nogs).toHaveLength(3);

    const packet = result.nogs.find((n) => n.id === packetNog.id);
    expect(packet).toBeDefined();
    expect(packet?.name).toBe("Packet");
    expect(packet?.subjectName).toBe("Networking");
    expect(packet?.stage).toMatch(/^hatchling$/i);
    expect(packet?.nextStage).toMatch(/^sprout$/i);
    expect(packet?.mastered).toBe(3);
    expect(packet?.nextThreshold).toBe(5);
    expect(packet?.percent).toBe(60);
    expect(packet?.topics).toEqual([
      {
        id: tcpTopic.id,
        name: tcpTopic.title,
        mastered: 3,
        total: 8,
      },
      {
        id: dnsTopic.id,
        name: dnsTopic.title,
        mastered: 0,
        total: 0,
      },
    ]);

    const bramble = result.nogs.find((n) => n.id === sproutNog.id);
    expect(bramble).toBeDefined();
    expect(bramble?.name).toBe("Bramble");
    expect(bramble?.subjectName).toBe("Web Systems");
    expect(bramble?.stage).toMatch(/^sprout$/i);
    expect(bramble?.nextStage).toMatch(/^scholar$/i);
    expect(bramble?.mastered).toBe(6);
    expect(bramble?.nextThreshold).toBe(15);
    expect([40, 10]).toContain(bramble?.percent);

    const athena = result.nogs.find((n) => n.id === geniusNog.id);
    expect(athena).toBeDefined();
    expect(athena?.name).toBe("Athena");
    expect(athena?.subjectName).toBe("Algorithms");
    expect(athena?.stage).toMatch(/^genius$/i);
    expect(athena?.nextStage).toBeNull();
    expect(athena?.mastered).toBe(30);
    expect(athena?.nextThreshold).toBeNull();
    expect(athena?.percent).toBe(100);
    expect(athena?.topics).toHaveLength(3);
  });
});

describe("getRecentActivity use case", () => {
  it("returns unauthenticated when no user is signed in", async () => {
    const { deps, setUser } = createExtendedPorts({
      userId: learnerId,
      nogs: [packetNog],
      activity: sampleActivityEvents,
    });
    setUser(null);
    const getRecentActivity = await loadGetRecentActivity();

    await expect(getRecentActivity(deps)).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("returns events newest first for the signed-in learner and excludes other learners' Nogs", async () => {
    const shuffledEvents: ActivityEvent[] = [
      sampleActivityEvents[3],
      sampleActivityEvents[1],
      sampleActivityEvents[0],
      sampleActivityEvents[2],
    ];

    const { deps } = createExtendedPorts({
      userId: learnerId,
      now,
      nogs: [packetNog, sproutNog, otherOwnerNog],
      topics: [tcpTopic, httpTopic],
      pages: [
        ...samplePages,
        {
          ...samplePages[0],
          id: "other-owner-page",
          nogId: otherOwnerNog.id,
          createdAt: "2026-11-21T09:59:00.000Z",
          updatedAt: "2026-11-21T09:59:00.000Z",
        },
      ],
      attempts: [
        ...buildCheckAttempts(
          packetNog.id,
          tcpTopic.id,
          8,
          3,
          "2026-11-21T08:30:00.000Z",
        ),
        ...buildCheckAttempts(
          otherOwnerNog.id,
          tcpTopic.id,
          8,
          8,
          "2026-11-21T09:55:00.000Z",
        ),
      ],
      activity: shuffledEvents,
    });
    const getRecentActivity = await loadGetRecentActivity();

    const result = await getRecentActivity(deps);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected ok result from getRecentActivity");
    }

    expect(result.events).toHaveLength(4);
    expect(result.events.map((e) => e.at)).toEqual([
      "2026-11-21T08:30:00.000Z",
      "2026-11-21T07:42:00.000Z",
      "2026-11-20T14:20:00.000Z",
      "2026-11-14T09:15:00.000Z",
    ]);
    expect(result.events[0]).toMatchObject({
      kind: "check",
      nogId: packetNog.id,
      nogName: "Packet",
      topicName: "TCP handshake",
      correct: 3,
      total: 8,
    });
    expect(result.events[1]).toMatchObject({
      kind: "lesson",
      nogId: sproutNog.id,
      nogName: "Bramble",
      topicName: "HTTP caching",
      followUp: false,
    });
    expect(result.events[2]).toMatchObject({
      kind: "lesson",
      nogId: packetNog.id,
      nogName: "Packet",
      topicName: "TCP handshake",
      followUp: true,
    });
    expect(
      result.events.some((e) => e.nogId === otherOwnerNog.id),
    ).toBe(false);
  });
});

describe("updateDisplayName use case", () => {
  it("returns unauthenticated when no user is signed in", async () => {
    const { deps, setUser } = createExtendedPorts({ userId: learnerId });
    setUser(null);
    const updateDisplayName = await loadUpdateDisplayName();

    await expect(updateDisplayName(deps, "Cindy")).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it.each([
    ["C", "C"],
    ["  Cindy Mortel  ", "Cindy Mortel"],
    ["A".repeat(40), "A".repeat(40)],
    [`  ${"B".repeat(40)}  `, "B".repeat(40)],
  ])(
    "trims and persists valid display name %j as %j",
    async (rawInput, expectedTrimmed) => {
      const { deps } = createExtendedPorts({ userId: learnerId });
      const updateDisplayName = await loadUpdateDisplayName();

      expect(typeof deps.profiles.updateDisplayName).toBe("function");
      const updateSpy = vi.spyOn(deps.profiles, "updateDisplayName");

      const result = await updateDisplayName(deps, rawInput);
      expect(result).toMatchObject({ status: "ok" });
      expect(updateSpy).toHaveBeenCalledExactlyOnceWith(
        learnerId,
        expectedTrimmed,
      );
    },
  );

  it.each([
    ["empty string", ""],
    ["whitespace only", "    "],
    ["41 characters", "A".repeat(41)],
    ["newline control char", "Cindy\nMortel"],
    ["tab control char", "Cindy\tMortel"],
    ["null byte control char", "Cindy\u0000Mortel"],
    ["bell control char", "Cindy\u0007"],
    ["escape control char", "\u001b[31mCindy"],
  ])(
    "rejects invalid display name (%s) without calling ProfileRepository.updateDisplayName",
    async (_label, badInput) => {
      const { deps } = createExtendedPorts({ userId: learnerId });
      const updateDisplayName = await loadUpdateDisplayName();

      expect(typeof deps.profiles.updateDisplayName).toBe("function");
      const updateSpy = vi.spyOn(deps.profiles, "updateDisplayName");

      const result = await updateDisplayName(deps, badInput);
      expect(result).toMatchObject({ status: "invalid" });
      expect(updateSpy).not.toHaveBeenCalled();
    },
  );
});
