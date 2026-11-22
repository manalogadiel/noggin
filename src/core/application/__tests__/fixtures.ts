import { vi } from "vitest";

export const ownerId = "student-1";
export const nogId = "pingu";
export const topicId = "tcp-handshake";
export const scope = { nogId, topicId };
const now = "2026-11-21T03:00:00.000Z";

export const lesson = {
  ...scope,
  body: "The client starts with SYN. The server replies with SYN-ACK.",
  idempotencyKey: "feed-1",
};

type NewPage = typeof lesson & {
  wordCount: number;
  kind: "lesson" | "follow_up_answer";
  parentLessonId?: string | null;
};

export const savedPage = {
  ...lesson,
  id: "page-1",
  wordCount: 11,
  kind: "lesson" as const,
  parentLessonId: null,
  createdAt: now,
  updatedAt: now,
};

type Page = NewPage & Pick<typeof savedPage, "id" | "createdAt" | "updatedAt">;
type UsageKind = "listener" | "answer" | "grade" | "stt_seconds" | "tts_chars";

export const createOperation = {
  type: "create" as const,
  label: "SYN",
  paraphrase: "The client opens with a SYN packet.",
  status: "understood" as const,
  quote: "The client starts with SYN.",
};

export const digest = {
  reply: "Got the first step, boss!",
  mood: "happy",
  followUpQuestions: ["What does the server send back?"],
  operations: [createOperation],
};

const question = {
  id: "question-1",
  topicId,
  prompt: "How does the handshake begin?",
  referenceAnswer: "The client sends SYN, and the server responds with SYN-ACK.",
  sourceExcerpt: lesson.body,
  keyConcepts: ["SYN", "SYN-ACK"],
};

const nogAnswer = "The client sends SYN, then the server replies with SYN-ACK.";
const concepts = question.keyConcepts.map((concept) => ({
  concept,
  inAnswer: true,
  inPages: true,
  consistentWithReference: true,
}));

type AttemptDraft = {
  questionId: string;
  nogAnswer: string;
  concepts: typeof concepts;
  correct: boolean;
  notebookFingerprint: string;
};

type Attempt = AttemptDraft & { id: string; nogId: string; createdAt: string };
type RecordedCheck = { nogId: string; topicId: string; attempts: AttemptDraft[] };

export const ownMessageId = "f73bc86a-0172-40c7-9258-f242caaf3039";
export const otherMessageId = "4c96370c-192c-4dc8-9fd4-b9ff1ebeb6d4";
export const ownAttemptId = "fffe5d87-b045-45c6-aa53-bcbc0e9c1302";
export const otherAttemptId = "a34e3309-7eff-4f83-83aa-e07bb78870eb";
export const savedMessageBody = "The client sends SYN first.";
export const savedAttemptAnswer = nogAnswer;
export const synthesizedAudio = {
  audio: new Uint8Array([6, 2, 4]),
  mimeType: "audio/mpeg",
};

export function makeFixture(seedPages: readonly Page[] = []) {
  const pages = [...seedPages];
  const exhausted = new Set<UsageKind>();
  const usageByKind = new Map<string, number>();
  const checks = new Map<string, Attempt[]>();
  let nextAttemptId = 1;
  const cachedAudio = new Map<string, typeof synthesizedAudio>();
  const foreignNogId = "other-nog";
  const nog = { id: nogId, ownerId, subjectId: "networking", name: "Pingu", stage: "hatchling" as const };
  const nogOwners = new Map([[nogId, ownerId], [foreignNogId, "other-student"]]);

  const messages = [
    { id: ownMessageId, nogId, role: "nog" as const, kind: "reply" as const, body: savedMessageBody },
    { id: otherMessageId, nogId: foreignNogId, role: "nog" as const, kind: "reply" as const, body: "Private reply." },
  ];
  const voiceAttempts = [
    { id: ownAttemptId, nogId, nogAnswer: savedAttemptAnswer },
    { id: otherAttemptId, nogId: foreignNogId, nogAnswer: "Private quiz answer." },
  ];

  const deps = {
    currentUser: { get: vi.fn(async () => ({ id: ownerId })) },
    clock: { now: vi.fn(() => new Date(now)) },
    nogs: {
      findOwned: vi.fn(async (userId: string, id: string) => (
        id === nogId && userId === ownerId ? nog : null
      )),
    },
    notebook: {
      savePage: vi.fn(async (input: NewPage): Promise<Page> => {
        const page = { ...input, id: `saved-page-${pages.length + 1}`, createdAt: now, updatedAt: now };
        pages.push(page);
        return page;
      }),
      findPage: vi.fn(async (id: string, lessonId: string) => (
        pages.find((page) => page.nogId === id && page.id === lessonId) ?? null
      )),
      listPages: vi.fn(async (id: string, topic: string) => (
        pages.filter((page) => page.nogId === id && page.topicId === topic)
      )),
      countFollowUps: vi.fn(async (id: string, lessonId: string) => pages.filter(
        (page) => page.nogId === id && page.parentLessonId === lessonId && page.kind === "follow_up_answer",
      ).length),
      applyDigest: vi.fn(async () => ({ applied: true, cardIds: [] })),
      findOwnedMessage: vi.fn(async (userId: string, id: string) => messages.find(
        (message) => message.id === id && nogOwners.get(message.nogId) === userId,
      ) ?? null),
    },
    thoughtCards: { listByTopic: vi.fn(async () => []) },
    questions: {
      listByTopic: vi.fn(async (id: string) => id === topicId ? [question] : []),
    },
    attempts: {
      findLatest: vi.fn(async (id: string, topic: string) => checks.get(`${id}:${topic}`) ?? []),
      recordCheck: vi.fn(async (input: RecordedCheck) => {
        const key = `${input.nogId}:${input.topicId}`;
        const recorded = input.attempts.map((attempt) => ({
          ...attempt,
          id: `check-attempt-${nextAttemptId++}`,
          nogId: input.nogId,
          createdAt: now,
        }));
        checks.set(key, recorded);
        return recorded;
      }),
      findOwned: vi.fn(async (userId: string, id: string) => voiceAttempts.find(
        (attempt) => attempt.id === id && nogOwners.get(attempt.nogId) === userId,
      ) ?? null),
    },
    usage: {
      consumeQuota: vi.fn(async (userId: string, kind: UsageKind, amount: number) => {
        const key = `${userId}:${kind}`;
        const cap = 1000;
        const used = exhausted.has(kind) ? cap : (usageByKind.get(key) ?? 0);
        if (used + amount > cap) return { allowed: false, used, cap };

        usageByKind.set(key, used + amount);
        return { allowed: true, used: used + amount, cap };
      }),
    },
    listener: { listen: vi.fn(async () => digest) },
    brain: {
      answer: vi.fn(async () => ({
        answers: [{ questionId: question.id, nogAnswer }],
        model: "test-provider",
      })),
    },
    grader: {
      grade: vi.fn(async () => ({
        grades: [{ questionId: question.id, concepts }],
      })),
    },
    speechToText: { transcribe: vi.fn(async () => ({ text: lesson.body })) },
    textToSpeech: { speak: vi.fn(async () => synthesizedAudio) },
    voiceCache: {
      get: vi.fn(async (key: string) => cachedAudio.get(key) ?? null),
      put: vi.fn(async (key: string, audio: typeof synthesizedAudio) => { cachedAudio.set(key, audio); }),
    },
  };

  return { deps, pages, exhausted };
}
