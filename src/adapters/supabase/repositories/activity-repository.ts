import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityEvent,
  ActivityRepository,
  LessonKind,
} from "@/core/application/ports";
import {
  mapPostgrestError,
  normalizeTimestamp,
  SupabaseAdapterError,
} from "./errors";

const DEFAULT_LIMIT = 30;

interface OwnedNogSummaryRow {
  id: string;
  name: string;
}

interface TopicJoinRow {
  title: string;
}

interface LessonActivityRow {
  id: string;
  nog_id: string;
  topic_id: string;
  kind: LessonKind;
  created_at: string;
  topics?: TopicJoinRow | TopicJoinRow[] | null;
}

interface CheckAttemptActivityRow {
  id: string;
  nog_id: string;
  question_id: string;
  correct: boolean;
  created_at: string;
}

interface QuestionTopicSummaryRow {
  id: string;
  topic_id: string;
  topics?: TopicJoinRow | TopicJoinRow[] | null;
}

function extractTopicTitle(
  topics: TopicJoinRow | TopicJoinRow[] | null | undefined,
): string | undefined {
  if (!topics) {
    return undefined;
  }
  const entry = Array.isArray(topics) ? topics[0] : topics;
  return typeof entry?.title === "string" ? entry.title : undefined;
}

export function createActivityRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): ActivityRepository {
  const { session, service, userId } = options;

  return {
    async listRecent(
      ownerId: string,
      limit = DEFAULT_LIMIT,
    ): Promise<ActivityEvent[]> {
      if (ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot read activity for another user.",
        );
      }

      const maxItems =
        typeof limit === "number" && limit > 0
          ? Math.floor(limit)
          : DEFAULT_LIMIT;

      const { data: nogRows, error: nogError } = await session
        .from("nogs")
        .select("id, name")
        .eq("owner_id", ownerId)
        .returns<OwnedNogSummaryRow[]>();

      if (nogError) {
        throw mapPostgrestError(nogError, "activity.listRecent");
      }

      const ownedNogs = nogRows ?? [];
      if (ownedNogs.length === 0) {
        return [];
      }

      const ownedNogIds = ownedNogs.map((row) => row.id);
      const nogNameById = new Map(
        ownedNogs.map((row) => [row.id, row.name]),
      );

      const [lessonsResponse, attemptsResponse] = await Promise.all([
        session
          .from("lessons")
          .select("id, nog_id, topic_id, kind, created_at, topics(title)")
          .in("nog_id", ownedNogIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(maxItems)
          .returns<LessonActivityRow[]>(),
        service
          .from("check_attempts")
          .select("id, nog_id, question_id, correct, created_at")
          .in("nog_id", ownedNogIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(maxItems * 10)
          .returns<CheckAttemptActivityRow[]>(),
      ]);

      if (lessonsResponse.error) {
        throw mapPostgrestError(lessonsResponse.error, "activity.listRecent");
      }
      if (attemptsResponse.error) {
        throw mapPostgrestError(attemptsResponse.error, "activity.listRecent");
      }

      const lessonRows = lessonsResponse.data ?? [];
      const attemptRows = attemptsResponse.data ?? [];

      const questionIds = Array.from(
        new Set(attemptRows.map((row) => row.question_id)),
      );
      const questionTopicById = new Map<
        string,
        { topicId: string; topicName: string }
      >();

      if (questionIds.length > 0) {
        // Select only question id, topic_id, and topic title — never select reference_answer or key_concepts.
        const { data: questionRows, error: questionError } = await service
          .from("questions")
          .select("id, topic_id, topics(title)")
          .in("id", questionIds)
          .returns<QuestionTopicSummaryRow[]>();

        if (questionError) {
          throw mapPostgrestError(questionError, "activity.listRecent");
        }

        for (const q of questionRows ?? []) {
          questionTopicById.set(q.id, {
            topicId: q.topic_id,
            topicName: extractTopicTitle(q.topics) ?? "Topic",
          });
        }
      }

      const events: ActivityEvent[] = [];

      for (const lesson of lessonRows) {
        const nogName = nogNameById.get(lesson.nog_id);
        if (!nogName) continue;
        events.push({
          kind: "lesson",
          id: lesson.id,
          nogId: lesson.nog_id,
          nogName,
          topicName: extractTopicTitle(lesson.topics) ?? "Topic",
          at: normalizeTimestamp(lesson.created_at),
          followUp: lesson.kind === "follow_up_answer",
        });
      }

      const checkRuns = new Map<
        string,
        {
          id: string;
          nogId: string;
          nogName: string;
          topicName: string;
          at: string;
          correct: number;
          total: number;
        }
      >();

      for (const attempt of attemptRows) {
        const nogName = nogNameById.get(attempt.nog_id);
        if (!nogName) continue;
        const topicMeta = questionTopicById.get(attempt.question_id);
        const topicId = topicMeta?.topicId ?? "";
        const topicName = topicMeta?.topicName ?? "Topic";
        const at = normalizeTimestamp(attempt.created_at);
        const runKey = `${attempt.nog_id}:${topicId}:${at}`;

        const existing = checkRuns.get(runKey);
        if (existing) {
          existing.total += 1;
          if (attempt.correct) {
            existing.correct += 1;
          }
        } else {
          checkRuns.set(runKey, {
            id: attempt.id,
            nogId: attempt.nog_id,
            nogName,
            topicName,
            at,
            correct: attempt.correct ? 1 : 0,
            total: 1,
          });
        }
      }

      for (const run of checkRuns.values()) {
        events.push({
          kind: "check",
          ...run,
        });
      }

      return events
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, maxItems);
    },
  };
}
