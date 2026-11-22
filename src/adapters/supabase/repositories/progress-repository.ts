import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProgressRepository,
  TopicMasteryRow,
} from "@/core/application/ports";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

interface OwnedNogIdRow {
  id: string;
}

interface MasteryViewRow {
  nog_id: string;
  topic_id: string;
  mastered: number;
  total: number;
}

interface TopicTitleRow {
  id: string;
  title: string;
}

export function createProgressRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): ProgressRepository {
  const { session, service, userId } = options;

  return {
    async listMastery(ownerId: string): Promise<TopicMasteryRow[]> {
      if (ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot read learning progress for another user.",
        );
      }

      const { data: nogRows, error: nogError } = await session
        .from("nogs")
        .select("id")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<OwnedNogIdRow[]>();

      if (nogError) {
        throw mapPostgrestError(nogError, "progress.listMastery");
      }

      const ownedNogIds = (nogRows ?? []).map((row) => row.id);
      if (ownedNogIds.length === 0) {
        return [];
      }

      const { data: masteryRows, error: masteryError } = await service
        .from("topic_mastery")
        .select("nog_id, topic_id, mastered, total")
        .in("nog_id", ownedNogIds)
        .returns<MasteryViewRow[]>();

      if (masteryError) {
        throw mapPostgrestError(masteryError, "progress.listMastery");
      }

      const rows = masteryRows ?? [];
      if (rows.length === 0) {
        return [];
      }

      const topicIds = Array.from(new Set(rows.map((row) => row.topic_id)));
      const { data: topicRows, error: topicError } = await session
        .from("topics")
        .select("id, title")
        .in("id", topicIds)
        .returns<TopicTitleRow[]>();

      if (topicError) {
        throw mapPostgrestError(topicError, "progress.listMastery");
      }

      const topicNameById = new Map<string, string>();
      for (const topic of topicRows ?? []) {
        topicNameById.set(topic.id, topic.title);
      }

      const ownedSet = new Set(ownedNogIds);
      return rows
        .filter((row) => ownedSet.has(row.nog_id))
        .map((row) => ({
          nogId: row.nog_id,
          topicId: row.topic_id,
          topicName: topicNameById.get(row.topic_id) ?? "Topic",
          mastered: Number(row.mastered) || 0,
          total: Number(row.total) || 0,
        }));
    },
  };
}
