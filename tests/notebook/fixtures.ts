import type {
  LessonPage,
  NogRecord,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";

export const nog: NogRecord = {
  id: "nog-packet",
  ownerId: "learner-a",
  subjectId: "networking",
  name: "Packet",
  stage: "hatchling",
};

export const tcp: TopicSummary = {
  id: "topic-tcp",
  subjectId: nog.subjectId,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};

export const dns: TopicSummary = {
  ...tcp,
  id: "topic-dns",
  slug: "dns-lookup",
  title: "DNS lookup",
};

export const tls: TopicSummary = {
  ...tcp,
  id: "topic-tls",
  slug: "tls-certificates",
  title: "TLS certificates",
};

export const firstPage: LessonPage = {
  id: "lesson-first",
  nogId: nog.id,
  topicId: tcp.id,
  body: "Una, nagpapadala ng SYN ang client. It asks the server if it can open a connection before either side starts sending data.",
  wordCount: 22,
  kind: "lesson",
  idempotencyKey: "first-page",
  createdAt: "2026-11-19T12:00:00.000Z",
  updatedAt: "2026-11-21T12:00:00.000Z",
};

export const followUp: LessonPage = {
  ...firstPage,
  id: "lesson-follow-up",
  parentLessonId: firstPage.id,
  body: "The server answers with SYN-ACK, then the client sends ACK so both sides know the connection is ready.",
  wordCount: 18,
  kind: "follow_up_answer",
  idempotencyKey: "follow-up-page",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
};

export const synCard: ThoughtCardRecord = {
  id: "card-syn",
  nogId: nog.id,
  topicId: tcp.id,
  label: "Connection request",
  paraphrase: "The client starts the handshake by sending SYN.",
  status: "shaky",
  sourceLessonId: firstPage.id,
};
