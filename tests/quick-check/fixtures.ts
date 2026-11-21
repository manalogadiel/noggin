import type { CheckAttemptRecord, GradedConcept } from "@/core/application/ports";
import type { RunQuickCheckResult } from "@/core/application/use-cases/run-quick-check";
import { card, nog, tcp as feedTopic } from "../feed-lesson/fixtures";

export const tcp = { ...feedTopic, questionCount: 2 };

export type CheckResponse =
  | Exclude<RunQuickCheckResult, { status: "ok" }>
  | {
      status: "ok";
      reused: boolean;
      attempts: Array<CheckAttemptRecord & { prompt: string }>;
      meterBefore: number;
      meterAfter: number;
      stage: typeof nog.stage;
    };

const attempt = {
  nogId: nog.id,
  topicId: tcp.id,
  notebookFingerprint: "first-lesson",
  createdAt: "2026-11-21T04:05:00Z",
};

function covered(concept: string): GradedConcept {
  return { concept, inAnswer: true, inPages: true, consistentWithReference: true };
}

export const firstQuestion = {
  ...attempt,
  id: "attempt-1",
  questionId: "question-1",
  prompt: "When can both machines send data?",
  nogAnswer: "Both machines can send data after the handshake is complete.",
  concepts: [covered("Handshake complete")],
  correct: true,
};

export const secondQuestion = {
  ...attempt,
  id: "attempt-2",
  questionId: "question-2",
  prompt: "What starts the handshake?",
  nogAnswer: "The client sends some kind of message to the server.",
  concepts: [
    covered("Client sends first"),
    { concept: card.label, inAnswer: false, inPages: true, consistentWithReference: true },
  ],
  correct: false,
};

export const initialCheck = {
  status: "ok",
  reused: false,
  attempts: [firstQuestion, secondQuestion],
  meterBefore: 3,
  meterAfter: 4,
  stage: "hatchling",
} satisfies CheckResponse;

export const correctedLesson = "The client sends SYN for a connection request. The server replies with its own SYN and acknowledges the client's SYN.";
export const correctedAnswer = "The client sends SYN to make a connection request.";

export const improvedCheck = {
  ...initialCheck,
  attempts: [
    { ...firstQuestion, id: "attempt-3", notebookFingerprint: "revised-lesson" },
    {
      ...secondQuestion,
      id: "attempt-4",
      notebookFingerprint: "revised-lesson",
      nogAnswer: correctedAnswer,
      concepts: [covered("Client sends first"), covered(card.label)],
      correct: true,
    },
  ],
  meterBefore: 4,
  meterAfter: 5,
  stage: "sprout",
} satisfies CheckResponse;
