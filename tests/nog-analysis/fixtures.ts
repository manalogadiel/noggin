import type {
  AnalysisCard,
  GetNogAnalysisResult,
} from "@/core/application/use-cases/get-nog-analysis";

const nogId = "nog-packet";
const topicId = "topic-tcp-handshake";

export const syn: AnalysisCard = {
  id: "card-syn",
  nogId,
  topicId,
  label: "Initiating the handshake",
  paraphrase: "The client starts by sending SYN.",
  quote: "The client asks to connect first.",
  status: "understood",
  freshness: "fresh",
};

export const ack: AnalysisCard = {
  id: "card-ack",
  nogId,
  topicId,
  label: "Completing the handshake",
  paraphrase: "The client sends ACK to finish the handshake.",
  quote: "The client sends one final reply.",
  status: "understood",
  freshness: "fresh",
};

export const synAck: AnalysisCard = {
  id: "card-syn-ack",
  nogId,
  topicId,
  label: "The server's reply",
  paraphrase: "The server sends a response to SYN.",
  quote: "The server replies with something.",
  status: "shaky",
  freshness: "dusty",
};

export const sequenceNumbers: AnalysisCard = {
  id: "card-sequence-numbers",
  nogId,
  topicId,
  label: "Initial sequence numbers",
  paraphrase: "The handshake exchanges initial sequence numbers.",
  quote: "The sequence always starts at one.",
  status: "confused",
  freshness: "forgotten",
};

export const analysis: Extract<GetNogAnalysisResult, { status: "ok" }> = {
  status: "ok",
  nog: {
    id: nogId,
    ownerId: "learner-a",
    subjectId: "subject-networking",
    subjectName: "Networking",
    name: "Packet",
    stage: "hatchling",
  },
  vitals: { happiness: 0.92, clarity: 2 / 3, vitality: 0.42, faint: false },
  cards: [sequenceNumbers, syn, synAck, ack],
  masteredCount: 0,
  stage: "Hatchling",
};
