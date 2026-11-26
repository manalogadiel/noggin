import { createClient } from "@supabase/supabase-js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createNotebookRepository } from "@/adapters/supabase/repositories/notebook-repository";
import type {
  ApplyDigestInput,
  ApplyDigestResult,
  LessonPage,
  ListenerDigest,
  SavedDigestRecord,
} from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import { answerFollowUp } from "@/core/application/use-cases/answer-follow-up";
import { reviseLesson } from "@/core/application/use-cases/revise-lesson";
import { speakAnswer } from "@/core/application/use-cases/speak-answer";
import { teachLesson } from "@/core/application/use-cases/teach-lesson";
import { fakeClient } from "../memory-adapters/fake-supabase";

const ownerId = "student-1";
const scope = { nogId: "nog-1", topicId: "networking" };
const rootPage: LessonPage = {
  ...scope,
  id: "root-lesson",
  body: "The client opens the connection with SYN.",
  wordCount: 7,
  kind: "lesson",
  parentLessonId: null,
  idempotencyKey: "root-key",
  createdAt: "2026-11-26T00:00:00.000Z",
  updatedAt: "2026-11-26T00:00:00.000Z",
};
const digest: ListenerDigest = {
  reply: "Got it! The server sends SYN-ACK.",
  mood: "happy",
  followUpQuestions: ["What does the client send next?", "When is the connection ready?"],
  operations: [],
};
const replyId = "00000000-0000-4000-8000-000000000001";
const questionIds = [
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];
const savedVoiceIds = {
  replyMessageId: replyId,
  followUpMessageIds: questionIds,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digestInput: ApplyDigestInput = {
  nogId: scope.nogId,
  lessonId: rootPage.id,
  idempotencyKey: rootPage.idempotencyKey,
  operations: [],
  messages: [
    { role: "nog", kind: "reply", body: digest.reply },
    ...digest.followUpQuestions.map((body) => ({
      role: "nog" as const,
      kind: "question" as const,
      body,
    })),
  ],
  digest,
};

type VoiceIds = { replyMessageId?: string; followUpMessageIds?: string[] };

function repositoryFixture({
  replyIds = [replyId],
  followUpIds = questionIds,
  applied = true,
} = {}) {
  const requests: URL[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requests.push(url);
    const kind = url.searchParams.get("kind");
    const table = url.pathname.split("/").at(-1);
    let rows: Record<string, unknown>[];
    switch (table) {
      case "nogs":
        rows = [{ id: scope.nogId }];
        break;
      case "lessons":
        rows = [{
          id: rootPage.id,
          nog_id: rootPage.nogId,
          topic_id: rootPage.topicId,
          body: rootPage.body,
          word_count: rootPage.wordCount,
          kind: rootPage.kind,
          parent_lesson_id: rootPage.parentLessonId,
          idempotency_key: rootPage.idempotencyKey,
          created_at: rootPage.createdAt,
          digest_status: "done",
          digest,
          digest_card_ids: [],
        }];
        break;
      case "nog_messages":
        rows = (kind === "eq.reply" ? replyIds : followUpIds).map((id) => ({ id }));
        break;
      default:
        throw new Error(`Unexpected session request: ${url.pathname}`);
    }
    const accept = new Headers(init?.headers).get("accept");
    return Response.json(accept?.includes("vnd.pgrst.object") ? rows[0] : rows);
  });
  const session = createClient("https://supabase.example.test", "session-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch },
  });
  const service = fakeClient({
    rpcs: {
      apply_lesson_digest: [{ data: { applied, card_ids: [], saved_digest: digest }, error: null }],
    },
  });
  return {
    notebook: createNotebookRepository({ session, service: service.client, userId: ownerId }),
    requests,
    service,
  };
}

const repositoryReads = [
  ["applyDigest", (notebook: ReturnType<typeof createNotebookRepository>) => notebook.applyDigest(digestInput)],
  ["findSavedDigest", (notebook: ReturnType<typeof createNotebookRepository>) =>
    notebook.findSavedDigest(scope.nogId, rootPage.idempotencyKey)],
] as const;

describe.each(repositoryReads)("Supabase %s", (name, read) => {
  it("returns the latest reply and oldest-first questions from lesson-scoped session queries", async () => {
    expectTypeOf<Pick<ApplyDigestResult, keyof VoiceIds>>().toEqualTypeOf<VoiceIds>();
    expectTypeOf<Pick<SavedDigestRecord, keyof VoiceIds>>().toEqualTypeOf<VoiceIds>();

    const { notebook, requests, service } = repositoryFixture();
    await expect(read(notebook)).resolves.toMatchObject(savedVoiceIds);

    const messageQueries = requests
      .filter((url) => url.pathname.endsWith("/nog_messages"))
      .map((url) => url.searchParams);
    const reply = messageQueries.find((query) => query.get("kind") === "eq.reply");
    const questions = messageQueries.find((query) => query.get("kind") === "eq.question");
    for (const query of [reply, questions]) {
      expect(query?.get("nog_id")).toBe(`eq.${scope.nogId}`);
      expect(query?.get("lesson_id")).toBe(`eq.${rootPage.id}`);
      expect(query?.get("role")).toBe("eq.nog");
    }
    expect(reply?.get("order")?.split(",")[0]).toMatch(/^created_at\.desc(?:\.|$)/);
    expect(reply?.get("limit")).toBe("1");
    expect(questions?.get("order")?.split(",")[0]).toMatch(/^created_at\.asc(?:\.|$)/);
    expect(service.queries.filter(({ table }) => table === "nog_messages")).toEqual([]);
    if (name === "findSavedDigest") {
      const lesson = requests.find((url) => url.pathname.endsWith("/lessons"));
      expect(lesson?.searchParams.get("select")?.split(",")).toContain("id");
    }
  });

  it("omits the reply ID when only questions are saved", async () => {
    const { notebook } = repositoryFixture({ replyIds: [] });
    const result = await read(notebook);
    expect(result).toMatchObject({ followUpMessageIds: questionIds });
    expect(result).not.toHaveProperty("replyMessageId");
  });

  it("omits the question IDs when only a reply is saved", async () => {
    const { notebook } = repositoryFixture({ followUpIds: [] });
    const result = await read(notebook);
    expect(result).toMatchObject({ replyMessageId: replyId });
    expect(result).not.toHaveProperty("followUpMessageIds");
  });
});

it("returns saved voice IDs when the digest RPC reports an idempotent replay", async () => {
  const { notebook } = repositoryFixture({ applied: false });
  await expect(notebook.applyDigest(digestInput)).resolves.toMatchObject({
    applied: false,
    ...savedVoiceIds,
  });
});

function memoryFixture() {
  const subjectId = "computer-science";
  const { deps } = createInMemoryPorts({
    userId: ownerId,
    nogs: [{ id: scope.nogId, ownerId, subjectId, name: "Nog", stage: "hatchling" }],
    topics: [{
      id: scope.topicId,
      subjectId,
      ownerId: null,
      slug: "networking",
      title: "Networking",
      status: "ready",
      questionCount: 8,
    }],
    pages: [rootPage],
  });
  const listen = vi.spyOn(deps.listener, "listen").mockResolvedValue(digest);
  return { deps, listen };
}

it("records deterministic, owned UUIDs for the reply and each speakable question", async () => {
  const { deps } = memoryFixture();
  const speak = vi.spyOn(deps.textToSpeech, "speak");
  const applied = await deps.notebook.applyDigest(digestInput);
  const { replyMessageId, followUpMessageIds } = applied;
  const ids = [replyMessageId, ...(followUpMessageIds ?? [])];
  expect(ids).toEqual(digestInput.messages.map(() => expect.stringMatching(uuid)));
  expect(new Set(ids).size).toBe(ids.length);

  const voiceIds = { replyMessageId, followUpMessageIds };
  await expect(memoryFixture().deps.notebook.applyDigest(digestInput)).resolves.toMatchObject(voiceIds);
  await expect(deps.notebook.findSavedDigest?.(scope.nogId, rootPage.idempotencyKey))
    .resolves.toMatchObject(voiceIds);
  await expect(deps.notebook.applyDigest(digestInput)).resolves.toMatchObject({
    applied: false,
    ...voiceIds,
  });

  for (const [index, id] of ids.entries()) {
    if (!id) throw new Error("Expected a saved message ID");
    const { role, kind, body } = digestInput.messages[index];
    await expect(deps.notebook.findOwnedMessage(ownerId, id)).resolves.toMatchObject({
      id, nogId: scope.nogId, lessonId: rootPage.id, role, kind, body,
    });
    await expect(deps.notebook.findOwnedMessage("other-student", id)).resolves.toBeNull();
    await expect(speakAnswer(deps, { source: "nog_message", id })).resolves.toMatchObject({ status: "ok" });
    expect(speak).toHaveBeenLastCalledWith({ text: body });
  }
});

const submission = {
  ...scope,
  body: "The server sends SYN-ACK to acknowledge the request.",
  idempotencyKey: "new-submission",
};
const childSubmission = { ...submission, lessonId: rootPage.id };
type MemoryDeps = ReturnType<typeof memoryFixture>["deps"];
const submissions = [
  ["teachLesson", (deps: MemoryDeps) => teachLesson(deps, submission), 2],
  ["answerFollowUp", (deps: MemoryDeps) => answerFollowUp(deps, childSubmission), 1],
  ["reviseLesson", (deps: MemoryDeps) => reviseLesson(deps, childSubmission), 2],
] as const;

describe.each(submissions)("%s replay", (_name, submit, expectedQuestionCount) => {
  it("returns the original voice IDs when the same submission is sent again", async () => {
    const { deps, listen } = memoryFixture();
    const first = await submit(deps);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") throw new Error("Expected the first submission to succeed");
    expect(first.applied).toMatchObject({
      applied: true,
      replyMessageId: expect.stringMatching(uuid),
      followUpMessageIds: Array.from({ length: expectedQuestionCount }, () => expect.stringMatching(uuid)),
    });

    await expect(submit(deps)).resolves.toMatchObject({
      status: "ok",
      page: { id: first.page.id },
      digest: first.digest,
      applied: {
        applied: false,
        replyMessageId: first.applied.replyMessageId,
        followUpMessageIds: first.applied.followUpMessageIds,
      },
    });
    expect(listen).toHaveBeenCalledOnce();
  });

  it("recovers voice IDs from the saved record when an apply race returns no digest", async () => {
    const { deps } = memoryFixture();
    const saved = {
      digest: { ...digest, followUpQuestions: digest.followUpQuestions.slice(0, expectedQuestionCount) },
      cardIds: [],
      ...savedVoiceIds,
      followUpMessageIds: questionIds.slice(0, expectedQuestionCount),
    };
    vi.spyOn(deps.notebook, "applyDigest").mockResolvedValueOnce({ applied: false, cardIds: [] });
    vi.spyOn(deps.notebook, "findSavedDigest").mockImplementation(async (_nogId, key) =>
      key === submission.idempotencyKey ? saved : null,
    );

    await expect(submit(deps)).resolves.toMatchObject({
      status: "ok",
      digest: saved.digest,
      applied: {
        applied: false,
        replyMessageId: saved.replyMessageId,
        followUpMessageIds: saved.followUpMessageIds,
      },
    });
  });
});

it("preserves voice IDs when the atomic follow-up save discovers an existing answer", async () => {
  const { deps, listen } = memoryFixture();
  const first = await answerFollowUp(deps, childSubmission);
  expect(first.status).toBe("ok");
  if (first.status !== "ok") throw new Error("Expected an existing follow-up answer");
  const voiceIds = { ...savedVoiceIds, followUpMessageIds: questionIds.slice(0, 1) };
  const saved = { digest: first.digest, cardIds: [], ...voiceIds };
  vi.spyOn(deps.notebook, "findPageByIdempotencyKey").mockResolvedValueOnce(null);
  vi.spyOn(deps.notebook, "saveFollowUpPage").mockResolvedValueOnce({
    status: "existing",
    page: first.page,
  });
  vi.spyOn(deps.notebook, "findSavedDigest").mockResolvedValueOnce(saved);

  await expect(answerFollowUp(deps, childSubmission)).resolves.toMatchObject({
    status: "ok",
    page: { id: first.page.id },
    digest: saved.digest,
    applied: { applied: false, ...voiceIds },
  });
  expect(listen).toHaveBeenCalledOnce();
});
