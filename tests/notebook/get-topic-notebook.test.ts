/// <reference types="vite/client" />

import { describe, expect, it, vi } from "vitest";
import type { LessonPage, ThoughtCardRecord, TopicSummary } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { dns, firstPage, followUp, nog, synCard, tcp, tls } from "./fixtures";

type Deps = ReturnType<typeof createInMemoryPorts>["deps"];
type Input = { nogId: string; topicId: string };
type GetTopicNotebook = (
  deps: Deps & { topics: NonNullable<Deps["topics"]> },
  input: Input,
) => Promise<
  | { status: "ok"; topic: TopicSummary; pages: LessonPage[]; thoughtCards: ThoughtCardRecord[] }
  | { status: "unauthenticated" | "not_found" }
>;

const useCases = import.meta.glob<{ getTopicNotebook: GetTopicNotebook }>(
  "../../src/core/application/use-cases/get-topic-notebook.ts",
);

const otherNog = { ...nog, id: "nog-other", ownerId: "learner-b" };
const pendingTopic = { ...tls, status: "pending", questionCount: 0, ownerId: nog.ownerId } as const;
const privateTopic = { ...tls, id: "topic-private", ownerId: otherNog.ownerId };
const differentSubject = { ...tcp, id: "topic-history", subjectId: "history", ownerId: null };

function setup() {
  const unrelated = [
    { nogId: otherNog.id, topicId: tcp.id },
    { nogId: nog.id, topicId: privateTopic.id },
    { nogId: nog.id, topicId: differentSubject.id },
  ];
  const { deps, setUser } = createInMemoryPorts({
    userId: nog.ownerId,
    nogs: [nog, otherNog],
    topics: [
      { ...tcp, ownerId: null },
      { ...dns, ownerId: nog.ownerId },
      pendingTopic,
      privateTopic,
      differentSubject,
    ],
    pages: [
      followUp,
      firstPage,
      ...unrelated.map((scope, index) => ({ ...firstPage, ...scope, id: `unrelated-page-${index}` })),
    ],
    cards: [
      synCard,
      ...unrelated.map((scope, index) => ({ ...synCard, ...scope, id: `unrelated-card-${index}` })),
    ],
  });
  const topics = deps.topics;
  if (!topics) throw new Error("Topic fixtures must enable the in-memory topic port");
  const notebookDeps = { ...deps, topics };

  const findTopic = vi.spyOn(topics, "findById");
  const listPages = vi.spyOn(deps.notebook, "listPages");
  const listCards = vi.spyOn(deps.thoughtCards, "listByTopic");

  async function read(input: Input) {
    const load = useCases["../../src/core/application/use-cases/get-topic-notebook.ts"];
    if (!load) throw new Error("Missing use case: src/core/application/use-cases/get-topic-notebook.ts");
    return (await load()).getTopicNotebook(notebookDeps, input);
  }

  function expectNoContentReads() {
    expect(listPages).not.toHaveBeenCalled();
    expect(listCards).not.toHaveBeenCalled();
  }

  return { read, setUser, findTopic, expectNoContentReads };
}

describe("getTopicNotebook", () => {
  it("returns only this Nog's official topic data and orders the original pages by creation time", async () => {
    const { read } = setup();

    await expect(read({ nogId: nog.id, topicId: tcp.id })).resolves.toMatchObject({
      status: "ok",
      topic: tcp,
      pages: [firstPage, followUp],
      thoughtCards: [synCard],
    });
  });

  it.each([
    dns,
    { ...tls, status: "pending", questionCount: 0 } satisfies TopicSummary,
  ])("returns empty pages and thought cards for the learner's own $status topic", async (topic) => {
    const { read } = setup();

    const result = await read({ nogId: nog.id, topicId: topic.id });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Expected an accessible topic notebook");
    expect(result.topic).toEqual(topic);
    expect(result.pages).toEqual([]);
    expect(result.thoughtCards).toEqual([]);
  });

  it("requires a session before looking up a topic or reading its content", async () => {
    const { read, setUser, findTopic, expectNoContentReads } = setup();
    setUser(null);

    await expect(read({ nogId: nog.id, topicId: tcp.id })).resolves.toEqual({ status: "unauthenticated" });
    expect(findTopic).not.toHaveBeenCalled();
    expectNoContentReads();
  });

  it.each([otherNog.id, "missing-nog"])("rejects inaccessible Nog %s before reading its topic", async (nogId) => {
    const { read, findTopic, expectNoContentReads } = setup();

    await expect(read({ nogId, topicId: tcp.id })).resolves.toEqual({ status: "not_found" });
    expect(findTopic).not.toHaveBeenCalled();
    expectNoContentReads();
  });

  it.each([
    ["another learner's private topic", privateTopic.id],
    ["an official topic from a different subject", differentSubject.id],
    ["an unknown topic", "missing-topic"],
  ])("hides %s before reading any pages or cards", async (_scenario, topicId) => {
    const { read, expectNoContentReads } = setup();

    await expect(read({ nogId: nog.id, topicId })).resolves.toEqual({ status: "not_found" });
    expectNoContentReads();
  });
});
