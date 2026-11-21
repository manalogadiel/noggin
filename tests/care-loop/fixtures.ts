import type {
  LessonPage,
  ListenerDigest,
  NogRecord,
  QuickCheckAttempt,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import type { AnalysisCard } from "@/core/application/use-cases/get-nog-analysis";

export const now = new Date("2026-11-21T12:00:00.000Z");

export const nog: NogRecord = {
  id: "aafdc09b-4cf8-4668-b112-d1d65372829a",
  ownerId: "learner-a",
  subjectId: "networking",
  subjectName: "Networking",
  name: "Pingu",
  stage: "hatchling",
  happiness: 75,
  vitality: 0.85,
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
  id: "bb34f31b-87b0-4a2d-8dea-9e97f6a59513",
  subjectId: nog.subjectId,
  slug: "dns-lookup",
  title: "DNS lookup",
  status: "ready",
  questionCount: 8,
};

export const originalPage: LessonPage = {
  id: "86b8c46d-79b4-4e3f-8dca-5783c8cb1fc1",
  nogId: nog.id,
  topicId: tcp.id,
  body: "The client sends SYN first. The server replies with SYN-ACK before ACK finishes the handshake.",
  wordCount: 15,
  kind: "lesson",
  parentLessonId: null,
  idempotencyKey: "original-tcp-lesson",
  createdAt: "2026-11-20T04:00:00.000Z",
  updatedAt: "2026-11-20T04:00:00.000Z",
};

export const dnsPage: LessonPage = {
  id: "c17e8a92-3b60-4f74-8b2f-710c21b93021",
  nogId: nog.id,
  topicId: dns.id,
  body: "A recursive resolver queries root, TLD, and authoritative nameservers to find an IP address.",
  wordCount: 14,
  kind: "lesson",
  parentLessonId: null,
  idempotencyKey: "original-dns-lesson",
  createdAt: "2026-11-20T05:00:00.000Z",
  updatedAt: "2026-11-20T05:00:00.000Z",
};

export const dustyCard: AnalysisCard = {
  id: "11111111-2222-4333-8444-555555555501",
  nogId: nog.id,
  topicId: tcp.id,
  label: "SYN initiation",
  paraphrase: "The client starts a connection by sending a SYN packet.",
  quote: "The client sends SYN first.",
  status: "understood",
  strength: 1,
  intervalDays: 1,
  nextReviewAt: "2026-11-20T12:00:00.000Z",
  sourceLessonId: originalPage.id,
  freshness: "dusty",
};

export const forgottenCard: AnalysisCard = {
  id: "11111111-2222-4333-8444-555555555502",
  nogId: nog.id,
  topicId: dns.id,
  label: "Recursive lookup",
  paraphrase: "A resolver walks the DNS hierarchy to resolve a hostname.",
  quote: "A recursive resolver queries root, TLD, and authoritative nameservers.",
  status: "understood",
  strength: 2,
  intervalDays: 3,
  nextReviewAt: "2026-11-05T12:00:00.000Z",
  sourceLessonId: dnsPage.id,
  freshness: "forgotten",
};

export const shakyCard: AnalysisCard = {
  id: "11111111-2222-4333-8444-555555555503",
  nogId: nog.id,
  topicId: tcp.id,
  label: "SYN-ACK response",
  paraphrase: "The server replies to the client before data flows.",
  quote: "The server replies with SYN-ACK before ACK finishes the handshake.",
  status: "shaky",
  strength: 1,
  intervalDays: 3,
  nextReviewAt: "2026-11-23T12:00:00.000Z",
  sourceLessonId: originalPage.id,
  freshness: "fresh",
};

export const confusedCard: AnalysisCard = {
  id: "11111111-2222-4333-8444-555555555504",
  nogId: nog.id,
  topicId: dns.id,
  label: "Authoritative nameserver",
  paraphrase: "I mixed up the root server with the final domain owner.",
  quote: "A recursive resolver queries root, TLD, and authoritative nameservers to find an IP address.",
  status: "confused",
  strength: 1,
  intervalDays: 1,
  nextReviewAt: "2026-11-22T12:00:00.000Z",
  sourceLessonId: dnsPage.id,
  freshness: "fresh",
};

export const freshUnderstoodCard: AnalysisCard = {
  id: "11111111-2222-4333-8444-555555555505",
  nogId: nog.id,
  topicId: tcp.id,
  label: "Final ACK",
  paraphrase: "The client sends ACK to complete the three-way handshake.",
  quote: "ACK finishes the handshake.",
  status: "understood",
  strength: 3,
  intervalDays: 7,
  nextReviewAt: "2026-11-28T12:00:00.000Z",
  sourceLessonId: originalPage.id,
  freshness: "fresh",
};

export const passedAttempt: QuickCheckAttempt = {
  id: "attempt-pass-1",
  nogId: nog.id,
  topicId: tcp.id,
  questionId: "q-tcp-1",
  prompt: "How does a client initiate a TCP three-way handshake?",
  nogAnswer: "The client sends a SYN segment to initiate the connection.",
  concepts: [
    {
      concept: "SYN flag",
      inAnswer: true,
      inPages: true,
      consistentWithReference: true,
    },
  ],
  correct: true,
  notebookFingerprint: "fp-1",
  createdAt: "2026-11-21T10:00:00.000Z",
};

export const missedAttempt: QuickCheckAttempt = {
  id: "attempt-miss-2",
  nogId: nog.id,
  topicId: tcp.id,
  questionId: "q-tcp-2",
  prompt: "Why does the server reply with a SYN-ACK segment during the handshake?",
  nogAnswer: "The server just waits until the client sends data.",
  concepts: [
    {
      concept: "SYN-ACK segment",
      inAnswer: false,
      inPages: true,
      consistentWithReference: true,
    },
    {
      concept: "sequence number acknowledgment",
      inAnswer: false,
      inPages: false,
      consistentWithReference: true,
    },
  ],
  correct: false,
  notebookFingerprint: "fp-1",
  createdAt: "2026-11-21T10:05:00.000Z",
};

export const hiddenReferenceAnswer =
  "SECRET_SERVER_RUBRIC_DO_NOT_LEAK: The server responds with a SYN-ACK packet acknowledging the client's ISN.";

export const revisionDigest: ListenerDigest = {
  reply: "Now I see how SYN-ACK acknowledges the client's sequence number!",
  mood: "happy",
  followUpQuestions: [],
  operations: [],
};

export function toRecord(card: AnalysisCard): ThoughtCardRecord {
  const { freshness: _freshness, ...record } = card;
  return { ...record };
}
