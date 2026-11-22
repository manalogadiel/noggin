import type { LessonPage, ListenerDigest, NogRecord, ThoughtCardRecord, TopicSummary } from "@/core/application/ports";
import type { TeachLessonInput } from "@/core/application/use-cases/teach-lesson";
import { countWords } from "@/core/domain/lesson";

export const nog: NogRecord = {
  id: "aafdc09b-4cf8-4668-b112-d1d65372829a",
  ownerId: "learner-a",
  subjectId: "networking",
  subjectName: "Networking",
  name: "Pingu",
  stage: "hatchling",
};

export const tcp: TopicSummary = {
  id: "e01cb384-cbdd-4feb-8464-a9446f7bc76e",
  subjectId: nog.subjectId,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};

export const dns: TopicSummary = {
  ...tcp,
  id: "bb34f31b-87b0-4a2d-8dea-9e97f6a59513",
  slug: "dns-lookup",
  title: "DNS lookup",
};

export const tls: TopicSummary = {
  ...tcp,
  id: "407cae81-939a-4525-9a9f-e4c40eec3980",
  slug: "tls-certificates",
  title: "TLS certificates",
};

export const originalPage: LessonPage = {
  id: "86b8c46d-79b4-4e3f-8dca-5783c8cb1fc1",
  nogId: nog.id,
  topicId: tcp.id,
  body: "The client sends SYN first. Both machines can send data after the handshake.",
  wordCount: 13,
  kind: "lesson",
  parentLessonId: null,
  idempotencyKey: "original-lesson",
  createdAt: "2026-11-21T04:00:00Z",
  updatedAt: "2026-11-21T04:00:00Z",
};

export const card = {
  id: "f769d797-02e9-403a-b1f8-2c6f50a78dc3",
  nogId: nog.id,
  topicId: tcp.id,
  label: "Connection request",
  paraphrase: "The handshake begins with a connection request.",
  quote: "The client sends SYN first.",
  status: "shaky",
  sourceLessonId: originalPage.id,
} satisfies ThoughtCardRecord;

export const digest: ListenerDigest = {
  reply: "I get it. SYN is how the client starts the conversation!",
  followUpQuestions: ["What does the server send back?", "Which message completes the handshake?"],
  mood: "curious",
  operations: [],
};

export function savedPage(input: TeachLessonInput): LessonPage {
  return {
    ...originalPage,
    id: `saved-${input.idempotencyKey}`,
    nogId: input.nogId,
    topicId: input.topicId,
    body: input.body,
    wordCount: countWords(input.body),
    idempotencyKey: input.idempotencyKey,
  };
}

export function savedResult(page: LessonPage, reply: ListenerDigest = digest) {
  return {
    status: "ok" as const,
    page,
    digest: reply,
    applied: { applied: true, cardIds: [] },
  };
}
