import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplyDigestInput,
  ApplyDigestResult,
  DigestOperation,
  LessonKind,
  LessonPage,
  ListenerDigest,
  NewPageInput,
  NotebookRepository,
  OwnedMessage,
  SavedDigestRecord,
  SaveFollowUpPageResult,
} from "@/core/application/ports";
import {
  mapPostgrestError,
  normalizeTimestamp,
  SupabaseAdapterError,
} from "./errors";

const LESSON_COLUMNS =
  "id, nog_id, topic_id, body, word_count, kind, parent_lesson_id, idempotency_key, created_at";

interface LessonRow {
  id: string;
  nog_id: string;
  topic_id: string;
  body: string;
  word_count: number;
  kind: LessonKind;
  parent_lesson_id: string | null;
  idempotency_key: string;
  created_at: string;
}

interface SavedDigestRow {
  digest_status: string;
  digest: ListenerDigest | null;
  digest_card_ids: string[] | null;
}

interface SaveFollowUpRpcPayload {
  status: "saved" | "existing" | "limit_reached" | "conflict";
  page?: LessonRow;
}

interface ApplyDigestRpcPayload {
  applied: boolean;
  card_ids?: string[];
  saved_digest?: ListenerDigest | null;
}

interface OwnedMessageRow {
  id: string;
  nog_id: string;
  lesson_id: string | null;
  role: "nog" | "student";
  kind: "reply" | "question" | "answer" | "reaction";
  body: string;
}

function mapLessonRow(row: LessonRow): LessonPage {
  const createdAt = normalizeTimestamp(row.created_at);
  return {
    id: row.id,
    nogId: row.nog_id,
    topicId: row.topic_id,
    body: row.body,
    wordCount: row.word_count,
    kind: row.kind,
    parentLessonId: row.parent_lesson_id ?? null,
    idempotencyKey: row.idempotency_key,
    createdAt,
    updatedAt: createdAt,
  };
}

function serializeDigestOperation(
  operation: DigestOperation,
): Record<string, unknown> {
  if (operation.type === "create") {
    return {
      type: "create",
      label: operation.label,
      paraphrase: operation.paraphrase,
      status: operation.status,
      quote: operation.quote,
    };
  }
  if (operation.type === "update") {
    return {
      type: "update",
      card_id: operation.cardId,
      ...(operation.label !== undefined ? { label: operation.label } : {}),
      ...(operation.paraphrase !== undefined
        ? { paraphrase: operation.paraphrase }
        : {}),
      ...(operation.status !== undefined ? { status: operation.status } : {}),
      ...(operation.quote !== undefined ? { quote: operation.quote } : {}),
    };
  }
  if (operation.type === "reinforce") {
    return {
      type: "reinforce",
      card_id: operation.cardId,
      quote: operation.quote,
      ...(operation.status !== undefined ? { status: operation.status } : {}),
    };
  }
  return {
    type: "conflict",
    card_id: operation.cardId,
    ...(operation.paraphrase !== undefined
      ? { paraphrase: operation.paraphrase }
      : {}),
    ...(operation.quote !== undefined ? { quote: operation.quote } : {}),
  };
}

export type SupabaseNotebookRepository = NotebookRepository &
  Required<
    Pick<
      NotebookRepository,
      "findPageByIdempotencyKey" | "findSavedDigest" | "countIssuedQuestions"
    >
  >;

export function createNotebookRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): SupabaseNotebookRepository {
  const { session, service, userId } = options;

  async function assertNogOwned(nogId: string, operation: string): Promise<void> {
    const { data, error } = await session
      .from("nogs")
      .select("id")
      .eq("id", nogId)
      .eq("owner_id", userId)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw mapPostgrestError(error, operation);
    }
    if (!data) {
      throw new SupabaseAdapterError("NOT_FOUND", "Nog not found for owner.");
    }
  }

  async function findPageByIdempotencyKey(
    nogId: string,
    idempotencyKey: string,
  ): Promise<LessonPage | null> {
    const { data, error } = await session
      .from("lessons")
      .select(LESSON_COLUMNS)
      .eq("nog_id", nogId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<LessonRow>();

    if (error) {
      throw mapPostgrestError(error, "notebook.findPageByIdempotencyKey");
    }
    return data ? mapLessonRow(data) : null;
  }

  return {
    async savePage(input: NewPageInput): Promise<LessonPage> {
      const { data, error } = await session
        .from("lessons")
        .insert({
          nog_id: input.nogId,
          topic_id: input.topicId,
          body: input.body,
          word_count: input.wordCount,
          kind: input.kind,
          parent_lesson_id: input.parentLessonId ?? null,
          idempotency_key: input.idempotencyKey,
        })
        .select(LESSON_COLUMNS)
        .single<LessonRow>();

      if (error) {
        if (error.code === "23505") {
          const existing = await findPageByIdempotencyKey(
            input.nogId,
            input.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
        }
        throw mapPostgrestError(error, "notebook.savePage");
      }

      return mapLessonRow(data);
    },

    async saveFollowUpPage(
      input: NewPageInput & { parentLessonId: string; maxFollowUps: number },
    ): Promise<SaveFollowUpPageResult> {
      await assertNogOwned(input.nogId, "notebook.saveFollowUpPage");

      const { data, error } = await service.rpc("save_follow_up_page", {
        p_nog_id: input.nogId,
        p_parent_lesson_id: input.parentLessonId,
        p_topic_id: input.topicId,
        p_body: input.body,
        p_word_count: input.wordCount,
        p_idempotency_key: input.idempotencyKey,
        p_max: input.maxFollowUps,
        p_owner_id: userId,
      });

      if (error) {
        throw mapPostgrestError(error, "notebook.saveFollowUpPage");
      }

      const payload = data as SaveFollowUpRpcPayload | null;
      if (!payload) {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Empty response from save_follow_up_page.",
        );
      }

      if (payload.status === "limit_reached") {
        return { status: "limit_reached" };
      }
      if (payload.status === "conflict") {
        return { status: "conflict" };
      }
      if (
        (payload.status === "saved" || payload.status === "existing") &&
        payload.page
      ) {
        return {
          status: payload.status,
          page: mapLessonRow(payload.page),
        };
      }

      throw new SupabaseAdapterError(
        "DATABASE_ERROR",
        "Malformed response from save_follow_up_page.",
      );
    },

    async findPage(
      nogId: string,
      lessonId: string,
    ): Promise<LessonPage | null> {
      const { data, error } = await session
        .from("lessons")
        .select(LESSON_COLUMNS)
        .eq("nog_id", nogId)
        .eq("id", lessonId)
        .maybeSingle<LessonRow>();

      if (error) {
        throw mapPostgrestError(error, "notebook.findPage");
      }
      return data ? mapLessonRow(data) : null;
    },

    findPageByIdempotencyKey,

    async findSavedDigest(
      nogId: string,
      idempotencyKey: string,
    ): Promise<SavedDigestRecord | null> {
      const { data, error } = await session
        .from("lessons")
        .select("digest_status, digest, digest_card_ids")
        .eq("nog_id", nogId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle<SavedDigestRow>();

      if (error) {
        throw mapPostgrestError(error, "notebook.findSavedDigest");
      }
      if (!data || data.digest_status !== "done" || !data.digest) {
        return null;
      }

      return {
        digest: data.digest,
        cardIds: Array.isArray(data.digest_card_ids)
          ? data.digest_card_ids
          : [],
      };
    },

    async listPages(nogId: string, topicId: string): Promise<LessonPage[]> {
      const { data, error } = await session
        .from("lessons")
        .select(LESSON_COLUMNS)
        .eq("nog_id", nogId)
        .eq("topic_id", topicId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<LessonRow[]>();

      if (error) {
        throw mapPostgrestError(error, "notebook.listPages");
      }
      return (data ?? []).map(mapLessonRow);
    },

    async countFollowUps(
      nogId: string,
      rootLessonId: string,
    ): Promise<number> {
      const { count, error } = await session
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("nog_id", nogId)
        .eq("parent_lesson_id", rootLessonId)
        .eq("kind", "follow_up_answer");

      if (error) {
        throw mapPostgrestError(error, "notebook.countFollowUps");
      }
      return count ?? 0;
    },

    async countIssuedQuestions(
      nogId: string,
      rootLessonId: string,
    ): Promise<number> {
      const { data: followUps, error: followUpError } = await session
        .from("lessons")
        .select("id")
        .eq("nog_id", nogId)
        .eq("parent_lesson_id", rootLessonId)
        .eq("kind", "follow_up_answer")
        .returns<Array<{ id: string }>>();

      if (followUpError) {
        throw mapPostgrestError(followUpError, "notebook.countIssuedQuestions");
      }

      const threadLessonIds = [
        rootLessonId,
        ...(followUps ?? []).map((row) => row.id),
      ];

      const { count, error } = await session
        .from("nog_messages")
        .select("id", { count: "exact", head: true })
        .eq("nog_id", nogId)
        .eq("kind", "question")
        .in("lesson_id", threadLessonIds);

      if (error) {
        throw mapPostgrestError(error, "notebook.countIssuedQuestions");
      }
      return count ?? 0;
    },

    async applyDigest(input: ApplyDigestInput): Promise<ApplyDigestResult> {
      await assertNogOwned(input.nogId, "notebook.applyDigest");

      const serializedOps = input.operations.map(serializeDigestOperation);
      const serializedMessages = input.messages.map((message) => ({
        role: message.role,
        kind: message.kind,
        body: message.body,
        ...(message.mood !== undefined ? { mood: message.mood } : {}),
      }));

      const { data, error } = await service.rpc("apply_lesson_digest", {
        p_nog_id: input.nogId,
        p_idempotency_key: input.idempotencyKey,
        p_ops: serializedOps,
        p_messages: serializedMessages,
        p_digest: input.digest ?? null,
        p_owner_id: userId,
      });

      if (error) {
        throw mapPostgrestError(error, "notebook.applyDigest");
      }

      const payload = data as ApplyDigestRpcPayload | null;
      if (!payload) {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Empty response from apply_lesson_digest.",
        );
      }

      const result: ApplyDigestResult = {
        applied: Boolean(payload.applied),
        cardIds: Array.isArray(payload.card_ids) ? payload.card_ids : [],
      };
      if (payload.saved_digest) {
        result.savedDigest = payload.saved_digest;
      }
      return result;
    },

    async findOwnedMessage(
      ownerId: string,
      messageId: string,
    ): Promise<OwnedMessage | null> {
      const { data, error } = await session
        .from("nog_messages")
        .select("id, nog_id, lesson_id, role, kind, body, nogs!inner(owner_id)")
        .eq("id", messageId)
        .eq("nogs.owner_id", ownerId)
        .maybeSingle<OwnedMessageRow>();

      if (error) {
        throw mapPostgrestError(error, "notebook.findOwnedMessage");
      }
      if (!data) {
        return null;
      }

      return {
        id: data.id,
        nogId: data.nog_id,
        lessonId: data.lesson_id ?? null,
        role: data.role,
        kind: data.kind,
        body: data.body,
      };
    },
  };
}
