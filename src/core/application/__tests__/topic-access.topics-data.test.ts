import { describe, expect, it, vi } from "vitest";
import { createInMemoryPorts } from "../testing/fakes";
import { runQuickCheck } from "../use-cases/run-quick-check";
import { teachLesson } from "../use-cases/teach-lesson";
import type { LessonPage, NogRecord, QuestionRecord } from "../ports";

const userA = "learner-a";
const userB = "learner-b";
const nog: NogRecord = {
  id: "nog-b",
  ownerId: userB,
  subjectId: "networking",
  name: "Sprout",
  stage: "hatchling",
};

const readyTopic = {
  id: "tcp-handshake",
  subjectId: nog.subjectId,
  ownerId: null as string | null,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready" as "ready" | "pending",
  questionCount: 1,
};

const lesson: LessonPage = {
  id: "legacy-page",
  nogId: nog.id,
  topicId: readyTopic.id,
  kind: "lesson",
  body: "A SYN segment carries an initial sequence number.",
  wordCount: 8,
  idempotencyKey: "legacy-page-key",
  createdAt: "2026-11-21T00:00:00.000Z",
  updatedAt: "2026-11-21T00:00:00.000Z",
};

const question: QuestionRecord = {
  id: "question-1",
  topicId: readyTopic.id,
  prompt: "What does the SYN segment carry?",
  referenceAnswer: lesson.body,
  keyConcepts: ["SYN segment", "initial sequence number"],
  sourceExcerpt: lesson.body,
};

function fixture(topic: typeof readyTopic | null) {
  const { deps, stores } = createInMemoryPorts({
    userId: userB,
    nogs: [nog],
    pages: [lesson],
    questions: [question],
  });
  const topics = {
    findById: vi.fn(async (topicId: string) => topic?.id === topicId ? topic : null),
  };
  const downstream = [
    vi.spyOn(deps.notebook, "findPageByIdempotencyKey"),
    vi.spyOn(deps.notebook, "findSavedDigest"),
    vi.spyOn(deps.notebook, "savePage"),
    vi.spyOn(deps.notebook, "listPages"),
    vi.spyOn(deps.notebook, "applyDigest"),
    vi.spyOn(deps.thoughtCards, "listByTopic"),
    vi.spyOn(deps.questions, "listByTopic"),
    vi.spyOn(deps.attempts, "withCheckReservation"),
    vi.spyOn(deps.attempts, "findLatest"),
    vi.spyOn(deps.attempts, "recordCheck"),
    vi.spyOn(deps.usage, "consumeQuota"),
    vi.spyOn(deps.listener, "listen"),
    vi.spyOn(deps.brain, "answer"),
    vi.spyOn(deps.grader, "grade"),
  ];
  return { deps: { ...deps, topics }, downstream, stores };
}

const scope = { nogId: nog.id, topicId: readyTopic.id };
const teaching = { ...scope, body: lesson.body, idempotencyKey: "new-lesson-key" };

describe.each([
  { name: "teach-lesson", run: (deps: ReturnType<typeof fixture>["deps"]) => teachLesson(deps, teaching) },
  { name: "run-quick-check", run: (deps: ReturnType<typeof fixture>["deps"]) => runQuickCheck(deps, scope) },
])("$name topic authorization (SEC-T4)", ({ run }) => {
  it.each([
    { label: "user A's private topic on user B's subject", topic: { ...readyTopic, ownerId: userA } },
    { label: "user A's private pending topic", topic: { ...readyTopic, ownerId: userA, status: "pending" as const } },
    { label: "an official topic on a different subject", topic: { ...readyTopic, subjectId: "chemistry" } },
    { label: "user B's own topic on a different subject", topic: { ...readyTopic, ownerId: userB, subjectId: "chemistry" } },
    { label: "an unknown topic ID", topic: null },
  ])("rejects $label before touching topic data or providers", async ({ topic }) => {
    // An old notebook row and a question are present even for rejected topics.
    const { deps, downstream, stores } = fixture(topic);

    await expect(run(deps)).resolves.toEqual({ status: "not_found" });
    for (const call of downstream) expect(call).not.toHaveBeenCalled();
    expect(stores.pages).toEqual([lesson]);
    expect(stores.attempts).toEqual([]);
  });

  it("reports pending questions before any notebook or provider call", async () => {
    const { deps, downstream } = fixture({
      ...readyTopic, ownerId: userB, status: "pending", questionCount: 0,
    });

    await expect(run(deps)).resolves.toEqual({ status: "questions_pending" });
    for (const call of downstream) expect(call).not.toHaveBeenCalled();
  });

  it.each([
    { label: "an official topic", ownerId: null },
    { label: "user B's own topic", ownerId: userB },
  ])("continues after verifying $label on the Nog's subject", async ({ ownerId }) => {
    const { deps, downstream } = fixture({ ...readyTopic, ownerId });

    await expect(run(deps)).resolves.toMatchObject({ status: "ok" });
    expect(deps.topics.findById).toHaveBeenCalled();
    const [lookupOrder] = deps.topics.findById.mock.invocationCallOrder;
    for (const call of downstream) {
      for (const order of call.mock.invocationCallOrder) {
        expect(lookupOrder).toBeLessThan(order);
      }
    }
  });
});
