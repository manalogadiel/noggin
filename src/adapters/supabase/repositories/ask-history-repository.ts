import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AskExchangeRecord,
  AskHistoryRepository,
  SaveAskExchangeInput,
  SavedAskExchange,
} from "@/core/application/ports";
import {
  mapPostgrestError,
  normalizeTimestamp,
  SupabaseAdapterError,
} from "./errors";

interface AskMessageRow {
  id: string;
  nog_id: string;
  kind: "ask" | "ask_answer";
  body: string;
  mood: string | null;
  created_at: string;
}

interface SaveAskExchangePayload {
  question_id?: unknown;
  answer_id?: unknown;
}

export function createAskHistoryRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): AskHistoryRepository {
  const { session, service, userId } = options;

  return {
    async save(input: SaveAskExchangeInput): Promise<SavedAskExchange> {
      if (input.ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Permission denied during askHistory.save.",
        );
      }

      const { data, error } = await service.rpc("save_ask_exchange", {
        p_owner_id: input.ownerId,
        p_nog_id: input.nogId,
        p_question: input.question,
        p_answer: input.answer,
        p_mood: input.mood,
      });

      if (error) {
        throw mapPostgrestError(error, "askHistory.save");
      }
      const payload = (data ?? {}) as SaveAskExchangePayload;
      if (
        typeof payload.question_id !== "string" ||
        typeof payload.answer_id !== "string"
      ) {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Unexpected response during askHistory.save.",
        );
      }
      return {
        questionMessageId: payload.question_id,
        answerMessageId: payload.answer_id,
      };
    },

    async listRecent(
      ownerId: string,
      nogId: string,
      limit: number,
    ): Promise<AskExchangeRecord[]> {
      if (ownerId !== userId || limit <= 0) {
        return [];
      }

      // Each exchange is two messages; read a little extra so a stray message
      // at the edge of the window does not hide a complete exchange.
      const { data, error } = await session
        .from("nog_messages")
        .select("id, nog_id, kind, body, mood, created_at")
        .eq("nog_id", nogId)
        .in("kind", ["ask", "ask_answer"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit * 2 + 2)
        .returns<AskMessageRow[]>();

      if (error) {
        throw mapPostgrestError(error, "askHistory.listRecent");
      }

      const oldestFirst = [...(data ?? [])].sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
      );
      const exchanges: AskExchangeRecord[] = [];
      let pending: AskMessageRow | null = null;
      for (const row of oldestFirst) {
        if (row.kind === "ask") {
          pending = row;
          continue;
        }
        if (pending && row.nog_id === pending.nog_id) {
          exchanges.push({
            questionMessageId: pending.id,
            answerMessageId: row.id,
            nogId: row.nog_id,
            question: pending.body,
            answer: row.body,
            mood: row.mood ?? null,
            createdAt: normalizeTimestamp(row.created_at),
          });
        }
        pending = null;
      }

      return exchanges.reverse().slice(0, limit);
    },
  };
}
