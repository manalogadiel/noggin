import type {
  CheckAttemptRecord,
  LessonPage,
  NogRecord,
  ProfileSettings,
  QuestionRecord,
  TopicRecord,
} from "@/core/application/ports";

export interface TopicMasteryRow {
  nogId: string;
  topicId: string;
  topicName: string;
  mastered: number;
  total: number;
}

export type ActivityEvent =
  | {
      kind: "lesson";
      id: string;
      nogId: string;
      nogName: string;
      topicName: string;
      at: string;
      followUp: boolean;
    }
  | {
      kind: "check";
      id: string;
      nogId: string;
      nogName: string;
      topicName: string;
      at: string;
      correct: number;
      total: number;
    };

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
  stage: string;
  nextStage: string | null;
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

export type GetRecentActivityResult =
  | { status: "unauthenticated" }
  | {
      status: "ok";
      events: ActivityEvent[];
    };

export type UpdateDisplayNameResult =
  | { status: "unauthenticated" }
  | { status: "invalid"; error?: string }
  | { status: "ok"; displayName?: string };

export type SaveAccountActionInput = {
  displayName: string;
  settings: ProfileSettings;
};

export type SaveAccountActionResult =
  | { status: "ok" }
  | { status: "invalid_name"; error?: string }
  | { status: "error"; error?: string };

export const now = new Date("2026-11-21T10:00:00.000Z");
export const learnerId = "learner-cindy";
export const learnerEmail = "cindy@noggin.edu";

export const packetNog: NogRecord = {
  id: "nog-packet",
  ownerId: learnerId,
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Packet",
  stage: "hatchling",
  happiness: 80,
};

export const sproutNog: NogRecord = {
  id: "nog-sprout",
  ownerId: learnerId,
  subjectId: "subject-web",
  subjectName: "Web Systems",
  name: "Bramble",
  stage: "sprout",
  happiness: 85,
};

export const geniusNog: NogRecord = {
  id: "nog-genius",
  ownerId: learnerId,
  subjectId: "subject-algo",
  subjectName: "Algorithms",
  name: "Athena",
  stage: "genius",
  happiness: 95,
};

export const otherOwnerNog: NogRecord = {
  id: "nog-other",
  ownerId: "learner-other",
  subjectId: "subject-networking",
  subjectName: "Networking",
  name: "Stranger",
  stage: "sprout",
  happiness: 70,
};

export const tcpTopic: TopicRecord = {
  id: "topic-tcp",
  subjectId: packetNog.subjectId,
  ownerId: null,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};

export const dnsTopic: TopicRecord = {
  id: "topic-dns",
  subjectId: packetNog.subjectId,
  ownerId: learnerId,
  slug: "dns-lookup",
  title: "DNS lookup",
  status: "pending",
  questionCount: 0,
};

export const httpTopic: TopicRecord = {
  id: "topic-http",
  subjectId: sproutNog.subjectId,
  ownerId: learnerId,
  slug: "http-caching",
  title: "HTTP caching",
  status: "ready",
  questionCount: 8,
};

export const graphsTopic: TopicRecord = {
  id: "topic-graphs",
  subjectId: geniusNog.subjectId,
  ownerId: learnerId,
  slug: "graph-traversal",
  title: "Graph traversal",
  status: "ready",
  questionCount: 10,
};

export const dpTopic: TopicRecord = {
  id: "topic-dp",
  subjectId: geniusNog.subjectId,
  ownerId: learnerId,
  slug: "dynamic-programming",
  title: "Dynamic programming",
  status: "ready",
  questionCount: 10,
};

export const treesTopic: TopicRecord = {
  id: "topic-trees",
  subjectId: geniusNog.subjectId,
  ownerId: learnerId,
  slug: "search-trees",
  title: "Search trees",
  status: "ready",
  questionCount: 10,
};

export function buildTopicQuestions(
  topicId: string,
  count: number,
): QuestionRecord[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${topicId}-q-${idx + 1}`,
    topicId,
    prompt: `Question ${idx + 1} for ${topicId}?`,
    referenceAnswer: `Reference answer ${idx + 1}`,
    sourceExcerpt: `Excerpt ${idx + 1}`,
    keyConcepts: ["concept-a", "concept-b"],
  }));
}

export function buildCheckAttempts(
  nogId: string,
  topicId: string,
  total: number,
  correctCount: number,
  createdAt = "2026-11-21T08:30:00.000Z",
): CheckAttemptRecord[] {
  return Array.from({ length: total }, (_, idx) => {
    const isCorrect = idx < correctCount;
    return {
      id: `${nogId}-${topicId}-att-${idx + 1}`,
      nogId,
      topicId,
      questionId: `${topicId}-q-${idx + 1}`,
      nogAnswer: isCorrect ? "Complete explanation" : "Not sure",
      concepts: [
        {
          concept: "concept-a",
          inAnswer: isCorrect,
          inPages: isCorrect,
          consistentWithReference: isCorrect,
        },
      ],
      correct: isCorrect,
      notebookFingerprint: "fp-1",
      createdAt,
    };
  });
}

export const sampleMasteryRows: TopicMasteryRow[] = [
  {
    nogId: packetNog.id,
    topicId: tcpTopic.id,
    topicName: tcpTopic.title,
    mastered: 3,
    total: 8,
  },
  {
    nogId: packetNog.id,
    topicId: dnsTopic.id,
    topicName: dnsTopic.title,
    mastered: 0,
    total: 0,
  },
  {
    nogId: sproutNog.id,
    topicId: httpTopic.id,
    topicName: httpTopic.title,
    mastered: 6,
    total: 8,
  },
  {
    nogId: geniusNog.id,
    topicId: graphsTopic.id,
    topicName: graphsTopic.title,
    mastered: 10,
    total: 10,
  },
  {
    nogId: geniusNog.id,
    topicId: dpTopic.id,
    topicName: dpTopic.title,
    mastered: 10,
    total: 10,
  },
  {
    nogId: geniusNog.id,
    topicId: treesTopic.id,
    topicName: treesTopic.title,
    mastered: 10,
    total: 10,
  },
];

export const samplePages: LessonPage[] = [
  {
    id: "lesson-1",
    nogId: packetNog.id,
    topicId: tcpTopic.id,
    body: "TCP starts with SYN, replies with SYN-ACK, and finishes with ACK.",
    wordCount: 12,
    kind: "lesson",
    parentLessonId: null,
    idempotencyKey: "idem-lesson-1",
    createdAt: "2026-11-14T09:15:00.000Z",
    updatedAt: "2026-11-14T09:15:00.000Z",
  },
  {
    id: "lesson-2-followup",
    nogId: packetNog.id,
    topicId: tcpTopic.id,
    body: "Sequence numbers keep the bytes in order on both sides.",
    wordCount: 10,
    kind: "follow_up_answer",
    parentLessonId: "lesson-1",
    idempotencyKey: "idem-lesson-2",
    createdAt: "2026-11-20T14:20:00.000Z",
    updatedAt: "2026-11-20T14:20:00.000Z",
  },
  {
    id: "lesson-3-today",
    nogId: sproutNog.id,
    topicId: httpTopic.id,
    body: "ETag and Cache-Control let browsers reuse fresh responses.",
    wordCount: 8,
    kind: "lesson",
    parentLessonId: null,
    idempotencyKey: "idem-lesson-3",
    createdAt: "2026-11-21T07:42:00.000Z",
    updatedAt: "2026-11-21T07:42:00.000Z",
  },
];

export const sampleActivityEvents: ActivityEvent[] = [
  {
    kind: "check",
    id: "check-today-1",
    nogId: packetNog.id,
    nogName: packetNog.name,
    topicName: tcpTopic.title,
    at: "2026-11-21T08:30:00.000Z",
    correct: 3,
    total: 8,
  },
  {
    kind: "lesson",
    id: "lesson-3-today",
    nogId: sproutNog.id,
    nogName: sproutNog.name,
    topicName: httpTopic.title,
    at: "2026-11-21T07:42:00.000Z",
    followUp: false,
  },
  {
    kind: "lesson",
    id: "lesson-2-followup",
    nogId: packetNog.id,
    nogName: packetNog.name,
    topicName: tcpTopic.title,
    at: "2026-11-20T14:20:00.000Z",
    followUp: true,
  },
  {
    kind: "lesson",
    id: "lesson-1",
    nogId: packetNog.id,
    nogName: packetNog.name,
    topicName: tcpTopic.title,
    at: "2026-11-14T09:15:00.000Z",
    followUp: false,
  },
];

export const initialProfileSettings: ProfileSettings = {
  grillMode: "roast",
  micMode: "tap",
  voiceEnabled: true,
  soundsEnabled: true,
};

export const updatedProfileSettings: ProfileSettings = {
  grillMode: "gentle",
  micMode: "hold",
  voiceEnabled: false,
  soundsEnabled: false,
};
