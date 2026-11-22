import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { expect, onTestFinished } from "vitest";

type Fields = Record<string, unknown>;
type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string };

const root = new URL("../../", import.meta.url);
const resetFiles = [
  "supabase/config.toml",
  "supabase/migrations/20261121000001_core.sql",
  "supabase/migrations/20261121000002_rpc.sql",
  "supabase/seed.sql",
];

export function expectResetFiles() {
  const missing = resetFiles.filter((path) => {
    const file = new URL(path, root);
    return !existsSync(file) || !readFileSync(file, "utf8").trim();
  });
  expect(missing, "Missing inputs for supabase db reset --local").toEqual([]);
}

function readLocalSettings() {
  const file = new URL(".env.test", root);
  if (!existsSync(file)) {
    throw new Error("Local Supabase settings are missing. Run supabase status -o env and save its output to .env.test.");
  }

  const env = parseEnv(readFileSync(file, "utf8"));
  const url = env.API_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.PUBLISHABLE_KEY;
  const serviceKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SECRET_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error(".env.test must specify the local API URL, anon key and service role key.");
  }

  const address = URL.parse(url);
  if (!address || address.protocol !== "http:" || address.username || address.password ||
      address.pathname !== "/" || address.search || address.hash ||
      !["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)) {
    throw new Error("Database tests require a loopback Supabase API URL in .env.test.");
  }

  return { origin: address.origin, anonKey, serviceKey };
}

class Client {
  constructor(
    private readonly origin: string,
    private readonly key: string,
    private readonly token = key.startsWith("sb_") ? undefined : key,
  ) {}

  async request<T>(path: string, method = "GET", body?: Fields): Promise<Reply<T>> {
    const headers = new Headers({ apikey: this.key });
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    if (body) headers.set("Content-Type", "application/json");
    if (path.startsWith("/rest/v1/") && method !== "GET") {
      headers.set("Prefer", "return=representation");
    }

    const response = await fetch(`${this.origin}${path}`, {
      method,
      headers,
      body: body && JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.text();
    if (response.ok) {
      return { ok: true, data: (result ? JSON.parse(result) : undefined) as T };
    }
    // Auth and PostgREST error bodies can echo fixture contents.
    const error = response.headers.get("content-type")?.includes("application/json")
      ? (JSON.parse(result) as { error_code?: unknown; code?: unknown } | null)
      : undefined;
    const code = [error?.error_code, error?.code].find((value) => typeof value === "string");
    return { ok: false, status: response.status, code };
  }

  rows<T>(table: string, query: Fields = {}, method = "GET", body?: Fields) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) params.set(key, String(value));
    return this.request<T[]>(`/rest/v1/${table}?${params}`, method, body);
  }

  rpc<T>(name: string, args: Fields) {
    return this.request<T>(`/rest/v1/rpc/${name}`, "POST", args);
  }
}

export function success<T>(reply: Reply<T>, operation: string): T {
  if (!reply.ok) {
    throw new Error(`${operation} failed (HTTP ${reply.status}, code ${reply.code ?? "none"})`);
  }
  return reply.data;
}

export function exactlyOne<T>(reply: Reply<T[]>, operation: string): T {
  const rows = success(reply, operation);
  expect(rows.length, operation).toBe(1);
  return rows[0];
}

export function expectDenied(reply: Reply<unknown>, operation: string) {
  if (reply.ok) throw new Error(`${operation} unexpectedly succeeded`);
  expect(reply.code, operation).toBe("42501");
  expect([401, 403], operation).toContain(reply.status);
}

export function expectNoRows(reply: Reply<unknown[]>, operation: string) {
  if (!reply.ok) return expectDenied(reply, operation);
  expect(reply.data.length, operation).toBe(0);
}

export function eq(value: string | number) {
  return `eq.${value}`;
}

export function birthDate(age: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - age);
  date.setUTCDate(date.getUTCDate() - 180);
  return date.toISOString().slice(0, 10);
}

type AuthUser = { id: string };
type AuthResponse = AuthUser & { user?: AuthUser };
export type Credentials = { email: string; password: string };

export function credentials(): Credentials {
  return { email: `noggin-db-${randomUUID()}@example.com`, password: `T!${randomUUID()}` };
}

export type Row = { id: string };
type Profile = Row & { birth_date: string; guardian_consent_status: string; plan_code: string };
type Topic = Row & { title: string; visibility: string; trust_level: string };
type Subject = Row & { name: string };
export type Question = Row & {
  position: number;
  source_id: string;
  prompt: string;
  reference_answer: string;
  source_excerpt: string;
  key_concepts: string[];
};

export function localDb() {
  const settings = readLocalSettings();
  const admin = new Client(settings.origin, settings.serviceKey);
  const anon = new Client(settings.origin, settings.anonKey);

  function trackUser(data: AuthResponse) {
    const user = data.user ?? data;
    if (user.id) {
      onTestFinished(async () => {
        success(await admin.request(`/auth/v1/admin/users/${user.id}`, "DELETE"), "Remove test user");
      });
    }
    return user;
  }

  return {
    admin,
    anon,
    async createUser(account = credentials(), date = birthDate(24)) {
      const response = await admin.request<AuthResponse>("/auth/v1/admin/users", "POST", {
        ...account,
        email_confirm: true,
        user_metadata: { birth_date: date, display_name: "DB Test" },
      });
      const user = trackUser(success(response, "Create test user"));
      expect(Boolean(user.id), "Created user has an ID").toBe(true);
      return { ...account, id: user.id, date };
    },
    async signUp(account: Credentials, date?: string) {
      const reply = await anon.request<AuthResponse>("/auth/v1/signup", "POST", {
        ...account,
        data: date ? { birth_date: date } : {},
      });
      if (!reply.ok) return reply;
      const user = trackUser(reply.data);
      return { ok: true as const, data: { id: user.id } };
    },
    async signIn(account: Credentials) {
      const session = success(await anon.request<{ access_token: string }>(
        "/auth/v1/token?grant_type=password", "POST", { email: account.email, password: account.password },
      ), "Sign in test user");
      expect(Boolean(session.access_token), "User session has an access token").toBe(true);
      return new Client(settings.origin, settings.anonKey, session.access_token);
    },
    async profile(id: string) {
      return exactlyOne(await admin.rows<Profile>("profiles", { id: eq(id) }), "Read generated profile");
    },
    async tcpTopic() {
      const subject = exactlyOne(await admin.rows<Subject>("subjects", { slug: eq("networking") }), "Read Networking subject");
      const topic = exactlyOne(await admin.rows<Topic>("topics", {
        subject_id: eq(subject.id), slug: eq("tcp-handshake"),
      }), "Read TCP handshake topic");
      return { subject, topic };
    },
  };
}

export type LocalDb = ReturnType<typeof localDb>;
export type Lesson = Row & { idempotency_key: string; digest_status: string };

export const lessonBody = "The client sends a SYN segment.";

export async function createNog(db: LocalDb, ownerId: string, subjectId: string) {
  return exactlyOne(await db.admin.rows<Row>("nogs", {}, "POST", {
    owner_id: ownerId, subject_id: subjectId, name: "Fixture Nog",
  }), "Create test Nog");
}

export function lessonInput(nogId: string, topicId: string) {
  return { nog_id: nogId, topic_id: topicId, idempotency_key: randomUUID(), body: lessonBody, word_count: 6 };
}

export async function createLesson(db: LocalDb, nogId: string, topicId: string) {
  return exactlyOne(await db.admin.rows<Lesson>("lessons", {}, "POST", lessonInput(nogId, topicId)), "Create test lesson");
}

export function createCardOp() {
  return { type: "create", label: "SYN", paraphrase: "The client initiates the handshake.", status: "understood", quote: lessonBody };
}

export async function createCard(db: LocalDb, nogId: string, topicId: string, lessonId: string) {
  const { label, paraphrase, status, quote } = createCardOp();
  return exactlyOne(await db.admin.rows<Row>("thought_cards", {}, "POST", {
    nog_id: nogId, topic_id: topicId, source_lesson_id: lessonId, label, paraphrase, status, quote,
  }), "Create test thought card");
}
