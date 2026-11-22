import { randomUUID } from "node:crypto";
import { onTestFinished } from "vitest";
import { eq, exactlyOne, localDb, success, type LocalDb, type Row } from "./helpers";

export type Subject = Row & { owner_id: string | null; slug: string; name: string };
export type Topic = Row & {
  owner_id: string | null;
  subject_id: string;
  slug: string;
  title: string;
  visibility: string;
  trust_level: string;
  status: string;
  question_count: number;
};

export function uniqueSlug(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function topicUsers() {
  const db = localDb();
  const { subject, topic } = await db.tcpTopic();
  const userA = await db.createUser();
  const userB = await db.createUser();
  return { db, subject, topic, userA, userB };
}

export async function insertFixture<T extends Row>(
  db: LocalDb,
  table: "subjects" | "topics" | "lessons",
  body: Record<string, unknown>,
) {
  const row = exactlyOne(await db.admin.rows<T>(table, {}, "POST", body), `Insert fixture in ${table}`);
  onTestFinished(async () => {
    success(await db.admin.rows(table, { id: eq(row.id) }, "DELETE"), `Remove fixture from ${table}`);
  });
  return row;
}

export function privateTopic(subjectId: string, ownerId: string, slug = uniqueSlug("udp")) {
  return {
    subject_id: subjectId, owner_id: ownerId, slug, title: slug,
    visibility: "private", trust_level: "community",
  };
}
