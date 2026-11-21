/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import type { GeneratedQuestionDraft, NogRecord, SubjectRecord, TopicRecord } from "../ports";
import { createInMemoryPorts, type InMemoryPortsOptions } from "../testing/fakes";
import { hatchNog } from "../use-cases/hatch-nog";

const ownerId = "learner-a";
const otherUser = "learner-b";
const networking: SubjectRecord = {
  id: "subject-networking", name: "Networking", ownerId: null, slug: "networking", available: true,
};
const nog: NogRecord = {
  id: "nog-networking", ownerId, subjectId: networking.id, name: "Pip", stage: "hatchling",
};
const officialTopic: TopicRecord = {
  id: "topic-tcp", subjectId: networking.id, ownerId: null, slug: "tcp-handshake",
  title: "TCP handshake", status: "ready", questionCount: 8,
};
const pendingTopic: TopicRecord = {
  id: "topic-udp", subjectId: networking.id, ownerId, slug: "udp-datagrams",
  title: "UDP Datagrams", status: "pending", questionCount: 0,
};
const readyTopic: TopicRecord = { ...pendingTopic, status: "ready", questionCount: 8 };
const input = { nogId: nog.id, title: "  UDP Data\u0000grams  " };
const questions: GeneratedQuestionDraft[] = Array.from({ length: 8 }, (_, index) => ({
  position: index + 1,
  prompt: `Which UDP property is shown in example ${index + 1}?`,
  referenceAnswer: "UDP sends independent datagrams without a handshake.",
  sourceExcerpt: "A UDP datagram carries a payload and a small transport header.",
  keyConcepts: ["independent datagrams", "transport header"],
}));

function topicSummary({ id, subjectId, slug, title, status, questionCount }: TopicRecord) {
  return { id, subjectId, slug, title, status, questionCount };
}

function fixture(options: InMemoryPortsOptions = {}) {
  const { deps, stores, setUser } = createInMemoryPorts({
    userId: ownerId, subjects: [networking], nogs: [nog], topics: [], ...options,
  });
  const topics = deps.topics!;
  const questionWriter = {
    generate: vi.fn<(input: { subjectName: string; topicTitle: string }) => Promise<GeneratedQuestionDraft[]>>()
      .mockResolvedValue(questions),
  };
  const calls = {
    auth: vi.spyOn(deps.currentUser, "get"),
    ownership: vi.spyOn(deps.nogs, "findOwned"),
    subject: vi.spyOn(deps.subjects, "findById"),
    lookup: vi.spyOn(topics, "findBySubjectAndSlug"),
    list: vi.spyOn(topics, "listBySubject"),
    quota: vi.spyOn(deps.usage, "consumeQuota"),
    create: vi.spyOn(topics, "createUserTopic"),
    generate: questionWriter.generate,
    save: vi.spyOn(topics, "saveGeneratedQuestions"),
    readQuestions: vi.spyOn(deps.questions, "listByTopic"),
  };
  return { deps: { ...deps, topics, questionWriter }, calls, stores, setUser };
}

type Fixture = ReturnType<typeof fixture>;
type TopicScope = { nogId: string };
type AddTopicInput = TopicScope & { title: string };
type AddTopic = (deps: Fixture["deps"], input: AddTopicInput) => Promise<unknown>;
type ListTopics = (deps: Fixture["deps"], input: TopicScope) => Promise<unknown>;

const addModules = import.meta.glob<{ addTopic: AddTopic }>("../use-cases/add-topic.ts");
const listModules = import.meta.glob<{ listTopics: ListTopics }>("../use-cases/list-topics.ts");

async function addTopic(deps: Fixture["deps"], value: AddTopicInput = input) {
  const load = addModules["../use-cases/add-topic.ts"];
  if (!load) throw new Error("Missing use case: src/core/application/use-cases/add-topic.ts");
  return (await load()).addTopic(deps, value);
}

async function listTopics(deps: Fixture["deps"], nogId = nog.id) {
  const load = listModules["../use-cases/list-topics.ts"];
  if (!load) throw new Error("Missing use case: src/core/application/use-cases/list-topics.ts");
  return (await load()).listTopics(deps, { nogId });
}

function hatchCustomSubject(deps: Fixture["deps"], input: { name: string; subjectName: string }) {
  return hatchNog(deps, input as unknown as Parameters<typeof hatchNog>[1]);
}

function expectCallOrder(...steps: { mock: { invocationCallOrder: number[] } }[]) {
  const order = steps.flatMap(({ mock }) => {
    expect(mock.invocationCallOrder).toHaveLength(1);
    return mock.invocationCallOrder;
  });
  expect(order).toEqual([...order].sort((a, b) => a - b));
}

describe("hatch-nog (SEC-Q1)", () => {
  it("hatches on official Networking and creates a private subject for a normalized custom name", async () => {
    const { deps, stores } = fixture({ nogs: [] });
    const createSubject = vi.spyOn(deps.subjects, "createUserSubject");
    await expect(hatchNog(deps, { name: "Pip", subjectId: networking.id })).resolves.toMatchObject({
      status: "ok", nog: { subjectId: networking.id, ownerId },
    });
    expect(createSubject).not.toHaveBeenCalled();
    expect(stores.subjects).toEqual([networking]);

    const createNog = vi.spyOn(deps.nogs, "create");
    const custom = { name: " Moss ", subjectName: "  Marine Bio\u0000logy  " };

    const result = await hatchCustomSubject(deps, custom);

    expectCallOrder(createSubject, createNog);
    expect(createSubject).toHaveBeenCalledWith({ ownerId, name: "Marine Biology", slug: "marine-biology" });
    const subject = stores.subjects.find(({ ownerId: id }) => id === ownerId);
    expect(subject).toMatchObject({ ownerId, name: "Marine Biology", slug: "marine-biology" });
    expect(createNog).toHaveBeenCalledWith({ ownerId, subjectId: subject?.id, name: "Moss" });
    expect(result).toMatchObject({ status: "ok", nog: { ownerId, subjectId: subject?.id, name: "Moss" } });
  });

  it("enforces one Nog per subject per owner for official and custom subjects", async () => {
    const subject = { ...networking, id: "subject-marine", ownerId, slug: "marine-biology", name: "Marine Biology" };
    const existingNog = { ...nog, id: "nog-marine", subjectId: subject.id };
    const { deps, stores, setUser } = fixture({ subjects: [networking, subject], nogs: [nog, existingNog] });
    const createNog = vi.spyOn(deps.nogs, "create");
    const selection = { name: "Nova", subjectId: networking.id };

    await expect(hatchNog(deps, selection)).resolves.toMatchObject({ status: "already_exists", existing: nog });
    expect(createNog).not.toHaveBeenCalled();
    setUser(otherUser);
    await expect(hatchNog(deps, selection)).resolves.toMatchObject({
      status: "ok", nog: { subjectId: networking.id, ownerId: otherUser },
    });

    setUser(ownerId);
    createNog.mockClear();
    const createSubject = vi.spyOn(deps.subjects, "createUserSubject");
    const duplicate = { name: "Moss", subjectName: "  MARINE biology  " };

    await expect(hatchCustomSubject(deps, duplicate)).resolves.toMatchObject({
      status: "already_exists",
    });
    expect(createSubject).not.toHaveBeenCalled();
    expect(createNog).not.toHaveBeenCalled();
    expect(stores.nogs.filter((record) => record.ownerId === ownerId)).toEqual([nog, existingNog]);
  });

  it("rejects a blocked subject before accessing repositories", async () => {
    const { deps, calls, stores } = fixture();
    const findSubject = vi.spyOn(deps.subjects, "findBySlug");
    const createSubject = vi.spyOn(deps.subjects, "createUserSubject");
    const findNog = vi.spyOn(deps.nogs, "findByOwnerAndSubject");
    const createNog = vi.spyOn(deps.nogs, "create");
    const invalid = { name: "Pip", subjectName: "Intro to FU\u0000CK" };

    const result = await hatchCustomSubject(deps, invalid);

    expect(result).toMatchObject({ status: expect.stringMatching(/^invalid_/) });
    for (const call of [findSubject, calls.subject, createSubject, findNog, createNog]) {
      expect(call).not.toHaveBeenCalled();
    }
    expect(stores.subjects).toEqual([networking]);
    expect(stores.nogs).toEqual([nog]);
  });
});

describe("add-topic (SEC-Q1, SEC-Q4, SEC-Q5)", () => {
  it("authenticates, checks ownership and normalized slug, then consumes quota before create, generate and save", async () => {
    const { deps, calls, stores } = fixture();
    calls.generate.mockImplementationOnce(async () => {
      expect(stores.topics).toEqual([{ ...pendingTopic, id: expect.any(String) }]);
      expect(stores.questions).toEqual([]);
      return questions;
    });

    const result = await addTopic(deps);

    expectCallOrder(calls.auth, calls.ownership, calls.lookup, calls.quota, calls.create, calls.generate, calls.save);
    expect(calls.ownership).toHaveBeenCalledWith(ownerId, nog.id);
    expect(calls.lookup.mock.calls[0].slice(0, 2)).toEqual([networking.id, "udp-datagrams"]);
    expect(calls.quota).toHaveBeenCalledWith(ownerId, "generate", 1);
    expect(calls.create).toHaveBeenCalledWith({ ownerId, subjectId: networking.id, title: "UDP Datagrams", slug: "udp-datagrams" });
    expect(calls.generate).toHaveBeenCalledWith(expect.objectContaining({ subjectName: "Networking", topicTitle: "UDP Datagrams" }));
    expect(stores.topics).toEqual([{ ...readyTopic, id: expect.any(String) }]);
    const [created] = stores.topics;
    expect(calls.save).toHaveBeenCalledWith({ ownerId, topicId: created.id, questions });
    expect(stores.questions).toHaveLength(8);
    expect(result).toStrictEqual({ status: "ok", topic: topicSummary(created) });
  });

  it.each([
    { user: null, status: "unauthenticated", checksOwnership: false },
    { user: otherUser, status: "not_found", checksOwnership: true },
  ])("returns $status before validating or touching topics", async ({ user, status, checksOwnership }) => {
    const { deps, calls, setUser, stores } = fixture();
    setUser(user);

    await expect(addTopic(deps, { ...input, title: " " })).resolves.toStrictEqual({ status });

    if (checksOwnership) {
      expectCallOrder(calls.auth, calls.ownership);
      expect(calls.ownership).toHaveBeenCalledWith(user, nog.id);
    } else {
      expect(calls.auth).toHaveBeenCalledTimes(1);
      expect(calls.ownership).not.toHaveBeenCalled();
    }
    for (const call of [calls.subject, calls.lookup, calls.quota, calls.create, calls.generate, calls.save]) {
      expect(call).not.toHaveBeenCalled();
    }
    expect(stores.topics).toEqual([]);
  });

  it.each([" \u0000 ", "x".repeat(61), "Intro to FU\u0000CK"])(
    "validates %j after ownership and before any subject lookup, topic lookup, quota or write",
    async (title) => {
      const { deps, calls, stores } = fixture();

      await expect(addTopic(deps, { ...input, title })).resolves.toMatchObject({ status: expect.stringMatching(/^invalid_/) });

      expectCallOrder(calls.auth, calls.ownership);
      for (const call of [calls.subject, calls.lookup, calls.quota, calls.create, calls.generate, calls.save]) {
        expect(call).not.toHaveBeenCalled();
      }
      expect(stores.topics).toEqual([]);
    },
  );

  it.each([officialTopic, readyTopic])("refuses the ready $title duplicate without spending quota", async (topic) => {
    const { deps, calls, stores } = fixture({ topics: [topic] });

    const result = await addTopic(deps, { ...input, title: topic.title.toUpperCase() });
    expect(result).toMatchObject({ status: "already_exists" });
    expect(JSON.stringify(result)).not.toMatch(/"(?:questions|answers|referenceAnswer|keyConcepts|sourceExcerpt)"\s*:/);

    expectCallOrder(calls.auth, calls.ownership, calls.lookup);
    for (const call of [calls.quota, calls.create, calls.generate, calls.save]) expect(call).not.toHaveBeenCalled();
    expect(stores.topics).toEqual([topic]);
  });

  it.each([
    { label: "a new topic", topics: [] },
    { label: "an existing pending topic", topics: [pendingTopic] },
  ])("returns tired_for_today for $label with no write or provider call", async ({ topics }) => {
    const { deps, calls, stores } = fixture({ topics, caps: { generate: 1 } });
    await deps.usage.consumeQuota(ownerId, "generate", 1);
    calls.quota.mockClear();

    await expect(addTopic(deps)).resolves.toStrictEqual({ status: "tired_for_today" });

    expectCallOrder(calls.auth, calls.ownership, calls.lookup, calls.quota);
    expect(calls.quota).toHaveBeenCalledWith(ownerId, "generate", 1);
    for (const call of [calls.create, calls.generate, calls.save]) expect(call).not.toHaveBeenCalled();
    expect(stores.topics).toEqual(topics);
    expect(stores.questions).toEqual([]);
  });

  it("retries an existing pending topic in place after consuming generate quota", async () => {
    const { deps, calls, stores } = fixture({ topics: [pendingTopic] });

    await expect(addTopic(deps)).resolves.toStrictEqual({ status: "ok", topic: topicSummary(readyTopic) });

    expectCallOrder(calls.auth, calls.ownership, calls.lookup, calls.quota, calls.generate, calls.save);
    expect(calls.quota).toHaveBeenCalledWith(ownerId, "generate", 1);
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.save).toHaveBeenCalledWith({ ownerId, topicId: pendingTopic.id, questions });
    expect(stores.topics).toEqual([readyTopic]);
    expect(stores.questions).toHaveLength(8);
  });

  it("keeps one pending row and saves no questions when generation fails", async () => {
    const { deps, calls, stores } = fixture();
    calls.generate.mockRejectedValueOnce(new Error("Question writer unavailable"));

    const result = await addTopic(deps);

    expectCallOrder(calls.auth, calls.ownership, calls.lookup, calls.quota, calls.create, calls.generate);
    expect(calls.save).not.toHaveBeenCalled();
    expect(stores.topics).toEqual([{ ...pendingTopic, id: expect.any(String) }]);
    expect(result).toStrictEqual({ status: expect.any(String), topic: topicSummary(stores.topics[0]) });
    expect(stores.questions).toEqual([]);
  });
});

describe("list-topics (SEC-Q5)", () => {
  it("returns only topic summaries scoped to the owned Nog's subject, even when questions exist", async () => {
    const { deps, calls } = fixture({
      topics: [
        { ...pendingTopic, id: "foreign-topic", ownerId: otherUser },
        { ...pendingTopic, id: "other-subject-topic", subjectId: "subject-other" },
        { ...readyTopic, id: "ready-owner-topic", title: "DNS", slug: "dns" },
        officialTopic,
        pendingTopic,
      ],
      questions: [{ ...questions[0], id: "private-question", topicId: officialTopic.id }],
    });

    const result = await listTopics(deps);

    expectCallOrder(calls.auth, calls.ownership, calls.list);
    expect(calls.list.mock.calls[0][0]).toBe(networking.id);
    const expected = [
      topicSummary(officialTopic),
      topicSummary(pendingTopic),
      topicSummary({ ...readyTopic, id: "ready-owner-topic", title: "DNS", slug: "dns" }),
    ];
    expect(result).toStrictEqual({ status: "ok", topics: expect.arrayContaining(expected) });
    expect(result).toHaveProperty("topics.length", expected.length);
    expect(calls.readQuestions).not.toHaveBeenCalled();
    expect(calls.quota).not.toHaveBeenCalled();
    expect(calls.generate).not.toHaveBeenCalled();
  });

  it.each([
    { user: null, status: "unauthenticated" },
    { user: otherUser, status: "not_found" },
  ])("returns $status without reading topic summaries", async ({ user, status }) => {
    const { deps, calls, setUser } = fixture({ topics: [officialTopic, pendingTopic] });
    setUser(user);

    await expect(listTopics(deps)).resolves.toStrictEqual({ status });

    expect(calls.list).not.toHaveBeenCalled();
    expect(calls.readQuestions).not.toHaveBeenCalled();
  });
});
