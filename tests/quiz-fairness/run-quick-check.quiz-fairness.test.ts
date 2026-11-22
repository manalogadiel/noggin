import { describe, expect, it, vi } from "vitest";
import type {
  GradeInput,
  GradedConcept,
  LessonPage,
  ThoughtCardRecord,
} from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { runQuickCheck } from "@/core/application/use-cases/run-quick-check";

const nogId = "nog-1";
const topicId = "tcp-handshake";
const userId = "student-1";
const now = new Date("2026-11-21T03:00:00.000Z");

function lesson(day: number, body: string): LessonPage {
  const id = `lesson-${day}`;
  const timestamp = new Date(Date.UTC(2026, 10, day)).toISOString();
  return {
    id,
    nogId,
    topicId,
    body,
    wordCount: body.split(/\s+/).length,
    kind: "lesson",
    parentLessonId: null,
    idempotencyKey: id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function card(
  label: string,
  paraphrase: string,
  fields: Partial<ThoughtCardRecord> = {},
): ThoughtCardRecord {
  return {
    id: label,
    nogId,
    topicId,
    label,
    paraphrase,
    status: "shaky",
    strength: 3,
    intervalDays: 3,
    ...fields,
  };
}

function checkFixture(
  cards: ThoughtCardRecord[],
  keyConcepts: string[],
  pages = [lesson(1, "The notebook contains some TCP notes.")],
) {
  const { deps } = createInMemoryPorts({
    userId,
    now,
    nogs: [
      { id: nogId, ownerId: userId, subjectId: "networking", name: "Pingu", stage: "hatchling" },
    ],
    pages,
    cards,
    questions: [
      {
        id: "q-1",
        topicId,
        prompt: "What did you learn about TCP?",
        referenceAnswer: "The client retries after a retransmission timeout.",
        sourceExcerpt: "TCP retransmission timeout",
        keyConcepts,
      },
    ],
  });
  return {
    deps,
    recordCheck: vi.spyOn(deps.attempts, "recordCheck"),
    run: () => runQuickCheck(deps, { nogId, topicId }),
  };
}

function conceptGrade(concept: string, covered: boolean): GradedConcept {
  return { concept, inAnswer: covered, inPages: true, consistentWithReference: true };
}

async function recordedUpdates(cards: ThoughtCardRecord[], concepts: GradedConcept[]) {
  const fixture = checkFixture(cards, concepts.map(({ concept }) => concept));
  vi.spyOn(fixture.deps.grader, "grade").mockResolvedValue({
    grades: [{ questionId: "q-1", concepts }],
  });

  expect(await fixture.run()).toMatchObject({ status: "ok", reused: false });
  expect(fixture.recordCheck).toHaveBeenCalledTimes(1);
  return fixture.recordCheck.mock.calls[0][0].cardUpdates;
}

describe("Quick Check card updates", () => {
  it.each([
    ["SYN-ACK", "The server sends SYN-ACK."],
    ["backbone", "Packets travel across the backbone."],
  ])("keeps a missed ACK from updating the %s card", async (label, paraphrase) => {
    expect(await recordedUpdates([card(label, paraphrase)], [conceptGrade("ack", false)])).toEqual([]);
  });

  it("matches all concept words across the label and paraphrase", async () => {
    const handshake = card("Three-way opening", "The handshake opens a connection.");
    expect(await recordedUpdates([handshake], [conceptGrade("three-way handshake", true)]))
      .toMatchObject([{ cardId: handshake.id, strength: 4, status: "understood" }]);
  });

  it("matches a similar label when a concept adds an unmatched word", async () => {
    const handshake = card("TCP handshake", "The client and server connect.");
    expect(await recordedUpdates([handshake], [conceptGrade("TCP connection handshake", true)]))
      .toMatchObject([{ cardId: handshake.id, strength: 4, status: "understood" }]);
  });

  it("strengthens a Three-way handshake card when the covered concept is closer", async () => {
    const handshake = card("Three-way handshake", "The handshake opens a connection.");
    const grades = [
      conceptGrade("connection", false),
      conceptGrade("three-way handshake", true),
    ];
    expect(await recordedUpdates([handshake], grades))
      .toMatchObject([{ cardId: handshake.id, strength: 4, status: "understood" }]);
  });

  it("weakens a card when the missed whole-word match outranks a covered similarity match", async () => {
    const handshake = card("TCP handshake flags", "The client sends SYN first.");
    const grades = [
      conceptGrade("TCP secure handshake flags", true),
      conceptGrade("SYN client", false),
    ];
    expect(await recordedUpdates([handshake], grades))
      .toMatchObject([{ cardId: handshake.id, strength: 2, status: "confused" }]);
  });

  it("strengthens a card when covered and missed whole-word matches tie", async () => {
    const flags = card("TCP flags", "The client sends SYN and ACK.");
    const grades = [conceptGrade("SYN", false), conceptGrade("ACK", true)];
    expect(await recordedUpdates([flags], grades))
      .toMatchObject([{ cardId: flags.id, strength: 4, status: "understood" }]);
  });
});

describe("Quick Check grader evidence", () => {
  const quote = "The client retries after a retransmission timeout.";
  const oldLesson = lesson(1, quote);
  const recentLessons = Array.from({ length: 10 }, (_, index) =>
    lesson(index + 2, "TCP opens a connection with a handshake."),
  );
  const activeCard = card("TCP retries", "The client waits before resending.", {
    sourceLessonId: oldLesson.id,
    quote,
  });
  const forgottenCard = card("Forgotten flags", "Old details about flags.", {
    sourceLessonId: oldLesson.id,
    quote: "The SYN flag starts the handshake.",
    nextReviewAt: "2026-01-01T00:00:00.000Z",
  });

  it("passes active card evidence to the grader alongside only the ten recent pages", async () => {
    const { deps, run } = checkFixture(
      [activeCard, forgottenCard],
      ["retransmission timeout"],
      [oldLesson, ...recentLessons],
    );
    const grade = vi.spyOn(deps.grader, "grade");
    expect(await run()).toMatchObject({ status: "ok" });
    expect(grade).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      pages: recentLessons,
      cards: [
        expect.objectContaining({
          label: activeCard.label,
          paraphrase: activeCard.paraphrase,
          quote,
        }),
      ],
    }));
  });

  it("records a correct answer supported only by an active card's older quote", async () => {
    const keyConcept = "retransmission timeout";
    const { deps, run } = checkFixture([activeCard], [keyConcept], [oldLesson, ...recentLessons]);
    vi.spyOn(deps.brain, "answer").mockResolvedValue({
      answers: [{ questionId: "q-1", nogAnswer: quote }],
      model: "test",
    });
    const gradePages = deps.grader.grade;
    vi.spyOn(deps.grader, "grade").mockImplementation(
      (input: GradeInput & {
        cards?: Array<Pick<ThoughtCardRecord, "quote">>;
      }) => {
        // The in-memory grader recognizes page text. Feed it the quotes it received as well.
        const cardPages = (input.cards ?? []).flatMap(({ quote }, index) =>
          quote ? [lesson(index + 1, quote)] : [],
        );
        const evidence: GradeInput = { ...input, pages: [...input.pages, ...cardPages] };
        return gradePages(evidence);
      },
    );

    expect(await run()).toMatchObject({
      status: "ok",
      attempts: [{
        questionId: "q-1",
        correct: true,
        concepts: [conceptGrade(keyConcept, true)],
      }],
    });
  });
});
