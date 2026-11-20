import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ThoughtCardRecord,
  ThoughtCardRepository,
} from "@/core/application/ports";
import type { ThoughtCardStatus } from "@/core/domain/thought-card";
import { mapPostgrestError, normalizeTimestamp } from "./errors";

const CARD_COLUMNS =
  "id, nog_id, topic_id, label, paraphrase, status, strength, interval_days, next_review_at, source_lesson_id, quote";

interface ThoughtCardRow {
  id: string;
  nog_id: string;
  topic_id: string;
  label: string;
  paraphrase: string;
  status: ThoughtCardStatus;
  strength: number;
  interval_days: number;
  next_review_at: string;
  source_lesson_id: string;
  quote: string;
}

function mapThoughtCardRow(row: ThoughtCardRow): ThoughtCardRecord {
  return {
    id: row.id,
    nogId: row.nog_id,
    topicId: row.topic_id,
    label: row.label,
    paraphrase: row.paraphrase,
    status: row.status,
    strength: row.strength,
    intervalDays: row.interval_days,
    nextReviewAt: normalizeTimestamp(row.next_review_at),
    sourceLessonId: row.source_lesson_id,
    quote: row.quote,
  };
}

export type SupabaseThoughtCardRepository = ThoughtCardRepository &
  Required<Pick<ThoughtCardRepository, "listByNog">>;

export function createThoughtCardRepository(options: {
  session: SupabaseClient;
}): SupabaseThoughtCardRepository {
  const { session } = options;

  return {
    async listByTopic(
      nogId: string,
      topicId: string,
    ): Promise<ThoughtCardRecord[]> {
      const { data, error } = await session
        .from("thought_cards")
        .select(CARD_COLUMNS)
        .eq("nog_id", nogId)
        .eq("topic_id", topicId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<ThoughtCardRow[]>();

      if (error) {
        throw mapPostgrestError(error, "thoughtCards.listByTopic");
      }
      return (data ?? []).map(mapThoughtCardRow);
    },

    async listByNog(nogId: string): Promise<ThoughtCardRecord[]> {
      const { data, error } = await session
        .from("thought_cards")
        .select(CARD_COLUMNS)
        .eq("nog_id", nogId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<ThoughtCardRow[]>();

      if (error) {
        throw mapPostgrestError(error, "thoughtCards.listByNog");
      }
      return (data ?? []).map(mapThoughtCardRow);
    },
  };
}
