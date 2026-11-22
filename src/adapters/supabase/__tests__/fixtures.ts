/// <reference types="vite/client" />
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterEach, expect, vi } from "vitest";
import type {
  ApplyDigestInput, AttemptRepository, CheckAttemptDraft, LessonPage, NewPageInput,
  NogRepository, NotebookRepository, QuestionBank, ThoughtCardRepository, UsageRepository,
} from "@/core/application/ports";
import {
  createNog, eq, lessonBody, localDb, success, type Credentials, type LocalDb, type Question,
} from "../../../../tests/db/helpers";

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("server-only", () => ({}));

vi.setConfig({ testTimeout: 30_000, hookTimeout: 15_000 });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  cookies.mockReset();
});

interface SessionClient {
  auth: {
    signInWithPassword(account: Credentials): Promise<{ error: { status?: number } | null }>;
  };
}

type Repositories = {
  nogs: NogRepository;
  notebook: NotebookRepository & Required<Pick<NotebookRepository,
    "findPageByIdempotencyKey" | "findSavedDigest" | "countIssuedQuestions">>;
  thoughtCards: ThoughtCardRepository & Required<Pick<ThoughtCardRepository, "listByNog">>;
  questions: QuestionBank;
  attempts: AttemptRepository & Required<Pick<AttemptRepository, "listByNog" | "withCheckReservation">>;
  usage: UsageRepository;
};

interface RepositoryModule {
  createSupabaseRepositories(options: {
    session: SessionClient;
    service: unknown;
    userId: string;
  }): Repositories;
}

// Lazy discovery keeps the tests collectible before the adapter entry points exist.
const repositoryModules = import.meta.glob<RepositoryModule>("../repositories/index.ts");
const sessionModules = import.meta.glob<{
  createServerSupabaseClient(): SessionClient | Promise<SessionClient>;
}>("../server-client.ts");
const serviceModules = import.meta.glob<{
  createServiceSupabaseClient(): unknown;
}>("../service-client.ts");

async function loadModule<T>(modules: Record<string, () => Promise<T>>, path: string) {
  const load = modules[path];
  if (!load) throw new Error(`Missing adapter entry point: src/adapters/supabase/${path.slice(3)}`);
  return load();
}

function stubLocalSettings() {
  const file = new URL("../../../../.env.test", import.meta.url);
  const settings = parseEnv(readFileSync(file, "utf8"));
  const url = URL.parse(settings.API_URL || settings.NEXT_PUBLIC_SUPABASE_URL || "");
  if (!url || url.protocol !== "http:" || url.href !== `${url.origin}/` ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Adapter tests require a loopback Supabase API URL in .env.test.");
  }
  const anon = settings.NEXT_PUBLIC_SUPABASE_ANON_KEY || settings.PUBLISHABLE_KEY || settings.ANON_KEY;
  const service = settings.SUPABASE_SERVICE_ROLE_KEY || settings.SECRET_KEY || settings.SERVICE_ROLE_KEY;
  if (!anon || !service) throw new Error(".env.test must provide both local Supabase keys.");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url.origin);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", service);
}

export async function repositoriesFor(account: Credentials & { id: string }) {
  stubLocalSettings();
  const [repositories, serverClient, serviceClient] = await Promise.all([
    loadModule(repositoryModules, "../repositories/index.ts"),
    loadModule(sessionModules, "../server-client.ts"),
    loadModule(serviceModules, "../service-client.ts"),
  ]);

  const jar = new Map<string, string>();
  cookies.mockResolvedValue({
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => jar.set(name, value),
  });
  const session = await serverClient.createServerSupabaseClient();
  const { error } = await session.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`Adapter session sign-in failed (HTTP ${error.status ?? "unknown"})`);
  // A fresh client must read the session from the server cookie adapter.
  return repositories.createSupabaseRepositories({
    session: await serverClient.createServerSupabaseClient(),
    service: serviceClient.createServiceSupabaseClient(),
    userId: account.id,
  });
}

export function observeRequests() {
  const requests: { method: string; path: string }[] = [];
  const fetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error("Adapter tests only send requests to local Supabase.");
    }
    const response = await fetch(input, { ...init, redirect: "error" });
    requests.push({ method: init?.method ?? (input instanceof Request ? input.method : "GET"), path: url.pathname });
    return response;
  });
  return {
    reset: () => { requests.length = 0; },
    rpcCount: (name: string) => requests.filter(({ method, path }) =>
      method === "POST" && path === `/rest/v1/rpc/${name}`).length,
    expectOnlyRpcWrites(name: string, count = 1) {
      expect(requests.filter(({ method, path }) =>
        path.startsWith("/rest/v1/") && !["GET", "HEAD"].includes(method)),
      ).toEqual(Array.from({ length: count }, () => ({ method: "POST", path: `/rest/v1/rpc/${name}` })));
    },
  };
}

export async function ownerFixture() {
  const db = localDb();
  const { subject, topic } = await db.tcpTopic();
  const owner = await db.createUser();
  const nog = await createNog(db, owner.id, subject.id);
  return { db, subject, topic, owner, nog };
}

export function pageInput(nogId: string, topicId: string): NewPageInput {
  return { nogId, topicId, body: lessonBody, kind: "lesson", wordCount: 6, idempotencyKey: randomUUID() };
}

export function followUpInput(root: Pick<LessonPage, "id" | "nogId" | "topicId">) {
  return {
    ...pageInput(root.nogId, root.topicId), kind: "follow_up_answer" as const,
    parentLessonId: root.id, maxFollowUps: 2, body: "The server replies with SYN-ACK.",
  };
}

export function followUpArgs(input: ReturnType<typeof followUpInput>) {
  return {
    p_nog_id: input.nogId, p_parent_lesson_id: input.parentLessonId, p_topic_id: input.topicId,
    p_body: input.body, p_word_count: input.wordCount, p_idempotency_key: input.idempotencyKey,
    p_max: input.maxFollowUps,
  };
}

export function digestInput(page: LessonPage) {
  const reply = "SYN starts the handshake.";
  const question = "What does the server send back?";
  const operations: ApplyDigestInput["operations"] = [{
    type: "create", label: "SYN", status: "understood",
    paraphrase: "The client initiates the handshake.", quote: page.body,
  }];
  return {
    nogId: page.nogId, lessonId: page.id, idempotencyKey: page.idempotencyKey, operations,
    messages: [
      { role: "nog", kind: "reply", body: reply, mood: "happy" },
      { role: "nog", kind: "question", body: question },
    ],
    digest: { reply, mood: "happy", followUpQuestions: [question], operations },
  } satisfies ApplyDigestInput;
}

export async function seededQuestions(db: LocalDb, topicId: string) {
  const questions = success(await db.admin.rows<Question>("questions", {
    topic_id: eq(topicId), status: eq("active"), order: "position.asc",
    select: "id,prompt,reference_answer,source_excerpt,key_concepts",
  }), "Read seeded TCP questions");
  expect(questions.length).toBeGreaterThan(1);
  return questions;
}

export function attemptDraft(question: Question): CheckAttemptDraft {
  return {
    questionId: question.id, nogAnswer: "The client starts with SYN.", correct: true,
    concepts: question.key_concepts.map((concept) => ({
      concept, inAnswer: true, inPages: true, consistentWithReference: true,
    })),
    notebookFingerprint: randomUUID(),
  };
}

export function reservationArgs(nogId: string, holder: string) {
  return { p_nog_id: nogId, p_holder: holder, p_ttl_seconds: 60 };
}

export type Lease = { holder: string; expires_at: string };

export async function leases(db: LocalDb, nogId: string) {
  return success(await db.admin.rows<Lease>("check_reservations", {
    nog_id: eq(nogId), select: "holder,expires_at",
  }), "Read check reservation");
}
