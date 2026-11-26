import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CardEvidenceLink,
  ReviewThoughtCardInput,
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

interface SearchCardRow extends ThoughtCardRow {
  evidence_count: number | null;
  score: number | null;
}

interface EvidenceRow {
  card_id: string;
  lesson_id: string;
}

/** Evidence kinds whose lesson pages support a card; conflicting lessons are left out. */
const SUPPORTING_EVIDENCE_KINDS = ["taught", "reinforced", "merged"];

export type SupabaseThoughtCardRepository = ThoughtCardRepository &
  Required<
    Pick<
      ThoughtCardRepository,
      "listByNog" | "reviewCard" | "search" | "listEvidenceLessonIds"
    >
  >;

export function createThoughtCardRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): SupabaseThoughtCardRepository {
  const { session, service, userId } = options;

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

    async search(
      nogId: string,
      topicId: string | null,
      query: string,
      limit: number,
    ): Promise<ThoughtCardRecord[]> {
      const { data, error } = await session.rpc("search_thought_cards", {
        p_nog_id: nogId,
        p_topic_id: topicId,
        p_query: query,
        p_limit: limit,
      });

      if (error) {
        throw mapPostgrestError(error, "thoughtCards.search");
      }
      return ((data as SearchCardRow[] | null) ?? []).map((row) => ({
        ...mapThoughtCardRow(row),
        ...(row.evidence_count === null || row.evidence_count === undefined
          ? {}
          : { evidenceCount: row.evidence_count }),
        ...(row.score === null || row.score === undefined
          ? {}
          : { score: row.score }),
      }));
    },

    async listEvidenceLessonIds(
      cardIds: string[],
    ): Promise<CardEvidenceLink[]> {
      const ids = [...new Set(cardIds)];
      if (ids.length === 0) {
        return [];
      }
      const { data, error } = await session
        .from("card_evidence")
        .select("card_id, lesson_id")
        .in("card_id", ids)
        .in("kind", SUPPORTING_EVIDENCE_KINDS)
        .order("created_at", { ascending: true })
        .returns<EvidenceRow[]>();

      if (error) {
        throw mapPostgrestError(error, "thoughtCards.listEvidenceLessonIds");
      }
      return (data ?? []).map((row) => ({
        cardId: row.card_id,
        lessonId: row.lesson_id,
      }));
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

    async reviewCard(
      input: ReviewThoughtCardInput,
    ): Promise<ThoughtCardRecord | null> {
      if (input.ownerId !== userId) {
        return null;
      }

      const { data, error } = await service.rpc("review_thought_card", {
        p_owner_id: input.ownerId,
        p_card_id: input.cardId,
        p_outcome: input.outcome,
      });

      if (error) {
        if (error.code === "42501" || error.code === "P0002") {
          return null;
        }
        throw mapPostgrestError(error, "thoughtCards.reviewCard");
      }

      if (!data || typeof data !== "object") {
        return null;
      }

      const mapped = mapThoughtCardRow(data as ThoughtCardRow);
      if (mapped.nogId !== input.nogId) {
        return null;
      }
      return mapped;
    },
  };
}
