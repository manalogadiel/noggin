import {
  DEFAULT_GROWTH_THRESHOLDS,
  growthStage,
  type GrowthStage,
} from "../../domain/training";
import type {
  CurrentUser,
  NogRepository,
  NogStageSlug,
  ProgressRepository,
  TopicMasteryRow,
} from "../ports";

export interface LearningProgressTopicItem {
  id: string;
  name: string;
  mastered: number;
  total: number;
}

export interface LearningProgressNogItem {
  id: string;
  name: string;
  subjectName: string;
  stage: GrowthStage;
  nextStage: GrowthStage | null;
  mastered: number;
  nextThreshold: number | null;
  percent: number;
  topics: LearningProgressTopicItem[];
}

export interface LearningProgressSummary {
  nogs: number;
  topicsWithProgress: number;
  mastered: number;
}

export type GetLearningProgressResult =
  | { status: "unauthenticated" }
  | {
      status: "ok";
      summary: LearningProgressSummary;
      nogs: LearningProgressNogItem[];
    };

export interface GetLearningProgressDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "listByOwner">;
  progress?: Pick<ProgressRepository, "listMastery">;
}

const STAGE_ORDER: Record<GrowthStage, number> = {
  Hatchling: 0,
  Sprout: 1,
  Scholar: 2,
  Genius: 3,
};

function slugToGrowthStage(slug: NogStageSlug | string | undefined): GrowthStage {
  const normalized = (slug ?? "").toLowerCase();
  if (normalized === "genius") return "Genius";
  if (normalized === "scholar") return "Scholar";
  if (normalized === "sprout") return "Sprout";
  return "Hatchling";
}

function computeNextStageGoal(
  stage: GrowthStage,
  mastered: number,
): {
  nextStage: GrowthStage | null;
  nextThreshold: number | null;
  percent: number;
} {
  if (stage === "Genius") {
    return {
      nextStage: null,
      nextThreshold: null,
      percent: 100,
    };
  }

  if (stage === "Scholar") {
    const threshold = DEFAULT_GROWTH_THRESHOLDS.geniusMastered;
    return {
      nextStage: "Genius",
      nextThreshold: threshold,
      percent: Math.max(0, Math.min(100, Math.round((mastered / threshold) * 100))),
    };
  }

  if (stage === "Sprout") {
    const threshold = DEFAULT_GROWTH_THRESHOLDS.scholarMastered;
    return {
      nextStage: "Scholar",
      nextThreshold: threshold,
      percent: Math.max(0, Math.min(100, Math.round((mastered / threshold) * 100))),
    };
  }

  const threshold = DEFAULT_GROWTH_THRESHOLDS.sproutMastered;
  return {
    nextStage: "Sprout",
    nextThreshold: threshold,
    percent: Math.max(0, Math.min(100, Math.round((mastered / threshold) * 100))),
  };
}

export async function getLearningProgress(
  deps: GetLearningProgressDeps,
): Promise<GetLearningProgressResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const [ownedNogs, masteryRows] = await Promise.all([
    deps.nogs.listByOwner(user.id),
    deps.progress ? deps.progress.listMastery(user.id) : Promise.resolve([]),
  ]);

  if (ownedNogs.length === 0) {
    return {
      status: "ok",
      summary: {
        nogs: 0,
        topicsWithProgress: 0,
        mastered: 0,
      },
      nogs: [],
    };
  }

  const rowsByNog = new Map<string, TopicMasteryRow[]>();
  for (const nog of ownedNogs) {
    rowsByNog.set(nog.id, []);
  }
  for (const row of masteryRows) {
    const list = rowsByNog.get(row.nogId);
    if (list) {
      list.push(row);
    }
  }

  const progressedTopicIds = new Set<string>();
  let totalMastered = 0;

  const nogItems: LearningProgressNogItem[] = ownedNogs.map((nog) => {
    const rows = rowsByNog.get(nog.id) ?? [];
    let nogMastered = 0;
    const topicRatios: number[] = [];

    const topics: LearningProgressTopicItem[] = rows.map((row) => {
      const mastered = Math.max(0, row.mastered);
      const total = Math.max(0, row.total);
      nogMastered += mastered;
      if (mastered > 0) {
        progressedTopicIds.add(row.topicId);
      }
      if (total > 0) {
        topicRatios.push(mastered / total);
      }
      return {
        id: row.topicId,
        name: row.topicName,
        mastered,
        total,
      };
    });

    totalMastered += nogMastered;

    const computedStage = growthStage(
      nogMastered,
      topicRatios,
      DEFAULT_GROWTH_THRESHOLDS,
    );
    const storedStage = slugToGrowthStage(nog.stage);
    const stage =
      STAGE_ORDER[storedStage] > STAGE_ORDER[computedStage]
        ? storedStage
        : computedStage;

    const { nextStage, nextThreshold, percent } = computeNextStageGoal(
      stage,
      nogMastered,
    );

    return {
      id: nog.id,
      name: nog.name,
      subjectName: nog.subjectName ?? "General",
      stage,
      nextStage,
      mastered: nogMastered,
      nextThreshold,
      percent,
      topics,
    };
  });

  return {
    status: "ok",
    summary: {
      nogs: ownedNogs.length,
      topicsWithProgress: progressedTopicIds.size,
      mastered: totalMastered,
    },
    nogs: nogItems,
  };
}
