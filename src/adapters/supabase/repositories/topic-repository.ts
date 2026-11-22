import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateUserTopicInput,
  SaveGeneratedQuestionsInput,
  TopicRecord,
  TopicRepository,
  TopicStatus,
} from "@/core/application/ports";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

const TOPIC_COLUMNS =
  "id, subject_id, owner_id, slug, title, status, question_count";

interface TopicRow {
  id: string;
  subject_id: string;
  owner_id: string | null;
  slug: string;
  title: string;
  status: string;
  question_count: number;
}

function normalizeTopicStatus(status: string): TopicStatus {
  return status === "ready" ? "ready" : "pending";
}

function mapTopicRow(row: TopicRow): TopicRecord {
  return {
    id: row.id,
    subjectId: row.subject_id,
    ownerId: row.owner_id ?? null,
    slug: row.slug,
    title: row.title,
    status: normalizeTopicStatus(row.status),
    questionCount: Number(row.question_count ?? 0),
  };
}

export function createTopicRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): TopicRepository {
  const { session, service, userId } = options;

  return {
    async findById(topicId: string): Promise<TopicRecord | null> {
      const { data, error } = await session
        .from("topics")
        .select(TOPIC_COLUMNS)
        .eq("id", topicId)
        .maybeSingle<TopicRow>();

      if (error) {
        throw mapPostgrestError(error, "topics.findById");
      }
      return data ? mapTopicRow(data) : null;
    },

    async findBySubjectAndSlug(
      subjectId: string,
      slug: string,
      ownerId?: string | null,
    ): Promise<TopicRecord | null> {
      const normalizedSlug = slug.trim().toLowerCase();
      let query = session
        .from("topics")
        .select(TOPIC_COLUMNS)
        .eq("subject_id", subjectId)
        .eq("slug", normalizedSlug);

      if (ownerId === null) {
        query = query.is("owner_id", null);
      } else if (ownerId !== undefined) {
        query = query.eq("owner_id", ownerId);
      } else {
        query = query.order("owner_id", { ascending: true, nullsFirst: true });
      }

      const { data, error } = await query.limit(1).returns<TopicRow[]>();
      if (error) {
        throw mapPostgrestError(error, "topics.findBySubjectAndSlug");
      }
      const row = data?.[0];
      return row ? mapTopicRow(row) : null;
    },

    async listBySubject(subjectId: string): Promise<TopicRecord[]> {
      const { data, error } = await session
        .from("topics")
        .select(TOPIC_COLUMNS)
        .eq("subject_id", subjectId)
        .order("title", { ascending: true })
        .order("id", { ascending: true })
        .returns<TopicRow[]>();

      if (error) {
        throw mapPostgrestError(error, "topics.listBySubject");
      }
      return (data ?? []).map(mapTopicRow);
    },

    async createUserTopic(input: CreateUserTopicInput): Promise<TopicRecord> {
      if (input.ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot create a topic for another user.",
        );
      }

      const { data, error } = await service.rpc("create_user_topic", {
        p_owner_id: input.ownerId,
        p_subject_id: input.subjectId,
        p_title: input.title,
        p_slug: input.slug,
      });

      if (error) {
        throw mapPostgrestError(error, "topics.createUserTopic");
      }

      const payload = data as TopicRow | null;
      if (!payload || typeof payload.id !== "string") {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Malformed response from create_user_topic.",
        );
      }
      return mapTopicRow(payload);
    },

    async saveGeneratedQuestions(
      input: SaveGeneratedQuestionsInput,
    ): Promise<TopicRecord> {
      if (input.ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot save generated questions for another user.",
        );
      }

      const serialized = input.questions.map((question) => ({
        position: question.position,
        prompt: question.prompt,
        reference_answer: question.referenceAnswer,
        source_excerpt: question.sourceExcerpt,
        key_concepts: question.keyConcepts,
      }));

      const { data, error } = await service.rpc("save_generated_questions", {
        p_owner_id: input.ownerId,
        p_topic_id: input.topicId,
        p_questions: serialized,
      });

      if (error) {
        throw mapPostgrestError(error, "topics.saveGeneratedQuestions");
      }

      const payload = data as TopicRow | null;
      if (!payload || typeof payload.id !== "string") {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Malformed response from save_generated_questions.",
        );
      }
      return mapTopicRow(payload);
    },
  };
}
