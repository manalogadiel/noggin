import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AttemptRepository,
  CheckAttemptRecord,
  CheckReservationKey,
  GradedConcept,
  OwnedCheckAttempt,
  RecordCheckInput,
} from "@/core/application/ports";
import {
  mapPostgrestError,
  NogBusyError,
  normalizeTimestamp,
  SupabaseAdapterError,
} from "./errors";

const ATTEMPT_COLUMNS =
  "id, nog_id, question_id, nog_answer, concepts, correct, notebook_fingerprint, created_at";

const RESERVATION_TTL_SECONDS = 60;
const RESERVATION_MAX_WAIT_MS = 20_000;
const RESERVATION_INITIAL_BACKOFF_MS = 40;
const RESERVATION_MAX_BACKOFF_MS = 200;

interface AttemptRow {
  id: string;
  nog_id: string;
  question_id: string;
  nog_answer: string;
  concepts: unknown;
  correct: boolean;
  notebook_fingerprint: string;
  created_at: string;
}

interface OwnedAttemptRow {
  id: string;
  nog_id: string;
  nog_answer: string;
}

function mapAttemptRow(row: AttemptRow, topicId?: string): CheckAttemptRecord {
  return {
    id: row.id,
    nogId: row.nog_id,
    ...(topicId !== undefined ? { topicId } : {}),
    questionId: row.question_id,
    nogAnswer: row.nog_answer,
    concepts: Array.isArray(row.concepts)
      ? (row.concepts as GradedConcept[])
      : [],
    correct: Boolean(row.correct),
    notebookFingerprint: row.notebook_fingerprint,
    createdAt: normalizeTimestamp(row.created_at),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type SupabaseAttemptRepository = AttemptRepository &
  Required<Pick<AttemptRepository, "listByNog" | "withCheckReservation">>;

export function createAttemptRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): SupabaseAttemptRepository {
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

  async function fetchQuestionTopicMap(
    questionIds: string[],
    operation: string,
  ): Promise<Map<string, string>> {
    if (questionIds.length === 0) {
      return new Map();
    }

    const { data, error } = await service
      .from("questions")
      .select("id, topic_id")
      .in("id", questionIds)
      .returns<Array<{ id: string; topic_id: string }>>();

    if (error) {
      throw mapPostgrestError(error, operation);
    }

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      map.set(row.id, row.topic_id);
    }
    return map;
  }

  return {
    async findLatest(
      nogId: string,
      topicId: string,
    ): Promise<CheckAttemptRecord[]> {
      const { data: topicQuestions, error: questionError } = await service
        .from("questions")
        .select("id")
        .eq("topic_id", topicId)
        .returns<Array<{ id: string }>>();

      if (questionError) {
        throw mapPostgrestError(questionError, "attempts.findLatest");
      }

      const topicQuestionIds = (topicQuestions ?? []).map((row) => row.id);
      if (topicQuestionIds.length === 0) {
        return [];
      }

      const { data, error } = await session
        .from("check_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("nog_id", nogId)
        .in("question_id", topicQuestionIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .returns<AttemptRow[]>();

      if (error) {
        throw mapPostgrestError(error, "attempts.findLatest");
      }

      const seenQuestions = new Set<string>();
      const latest: CheckAttemptRecord[] = [];
      for (const row of data ?? []) {
        if (seenQuestions.has(row.question_id)) {
          continue;
        }
        seenQuestions.add(row.question_id);
        latest.push(mapAttemptRow(row, topicId));
      }

      return latest;
    },

    async recordCheck(input: RecordCheckInput): Promise<CheckAttemptRecord[]> {
      await assertNogOwned(input.nogId, "attempts.recordCheck");

      const draftQuestionIds = Array.from(
        new Set(input.attempts.map((attempt) => attempt.questionId)),
      );
      const readBackWindow = Math.max(input.attempts.length * 4, 100);

      const existingIds = new Set<string>();
      if (draftQuestionIds.length > 0) {
        const { data: priorRows, error: priorError } = await session
          .from("check_attempts")
          .select("id")
          .eq("nog_id", input.nogId)
          .in("question_id", draftQuestionIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(readBackWindow)
          .returns<Array<{ id: string }>>();

        if (priorError) {
          throw mapPostgrestError(priorError, "attempts.recordCheck");
        }
        for (const row of priorRows ?? []) {
          existingIds.add(row.id);
        }
      }

      const serializedAttempts = input.attempts.map((attempt) => ({
        question_id: attempt.questionId,
        nog_answer: attempt.nogAnswer,
        concepts: attempt.concepts,
        correct: attempt.correct,
        notebook_fingerprint: attempt.notebookFingerprint,
        model: input.model ?? null,
        prompt_version: null,
      }));

      const serializedCardUpdates = (input.cardUpdates ?? []).map((update) => ({
        card_id: update.cardId,
        strength: update.strength,
        status: update.status,
        interval_days: update.intervalDays,
        next_review_at: update.nextReviewAt,
      }));

      const { error } = await service.rpc("record_check_attempt", {
        p_nog_id: input.nogId,
        p_attempts: serializedAttempts,
        p_card_updates: serializedCardUpdates,
        p_stage: input.stage ?? null,
      });

      if (error) {
        throw mapPostgrestError(error, "attempts.recordCheck");
      }

      if (input.attempts.length === 0) {
        return [];
      }

      const { data: postRows, error: readBackError } = await session
        .from("check_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("nog_id", input.nogId)
        .in("question_id", draftQuestionIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(readBackWindow)
        .returns<AttemptRow[]>();

      if (readBackError) {
        throw mapPostgrestError(readBackError, "attempts.recordCheck");
      }

      const remaining = (postRows ?? [])
        .filter((row) => !existingIds.has(row.id))
        .reverse();
      const matched: CheckAttemptRecord[] = [];

      for (const draft of input.attempts) {
        const index = remaining.findIndex(
          (row) =>
            row.question_id === draft.questionId &&
            row.notebook_fingerprint === draft.notebookFingerprint &&
            row.nog_answer === draft.nogAnswer &&
            Boolean(row.correct) === draft.correct,
        );
        if (index === -1) {
          throw new SupabaseAdapterError(
            "DATABASE_ERROR",
            "Failed to read back recorded check attempts.",
          );
        }
        const [row] = remaining.splice(index, 1);
        matched.push(mapAttemptRow(row, input.topicId));
      }

      return matched;
    },

    async findOwned(
      ownerId: string,
      attemptId: string,
    ): Promise<OwnedCheckAttempt | null> {
      const { data, error } = await session
        .from("check_attempts")
        .select("id, nog_id, nog_answer, nogs!inner(owner_id)")
        .eq("id", attemptId)
        .eq("nogs.owner_id", ownerId)
        .maybeSingle<OwnedAttemptRow>();

      if (error) {
        throw mapPostgrestError(error, "attempts.findOwned");
      }
      if (!data) {
        return null;
      }

      return {
        id: data.id,
        nogId: data.nog_id,
        nogAnswer: data.nog_answer,
      };
    },

    async listByNog(nogId: string): Promise<CheckAttemptRecord[]> {
      const { data, error } = await session
        .from("check_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("nog_id", nogId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<AttemptRow[]>();

      if (error) {
        throw mapPostgrestError(error, "attempts.listByNog");
      }

      const rows = data ?? [];
      if (rows.length === 0) {
        return [];
      }

      const distinctQuestionIds = Array.from(
        new Set(rows.map((row) => row.question_id)),
      );
      const topicByQuestion = await fetchQuestionTopicMap(
        distinctQuestionIds,
        "attempts.listByNog",
      );

      return rows.map((row) =>
        mapAttemptRow(row, topicByQuestion.get(row.question_id)),
      );
    },

    async withCheckReservation<T>(
      key: CheckReservationKey,
      work: () => Promise<T>,
    ): Promise<T> {
      await assertNogOwned(key.nogId, "attempts.withCheckReservation");

      const holder = randomUUID();
      const deadline = Date.now() + RESERVATION_MAX_WAIT_MS;
      let backoffMs = RESERVATION_INITIAL_BACKOFF_MS;
      let acquired = false;

      while (true) {
        const { data, error } = await service.rpc("acquire_check_reservation", {
          p_nog_id: key.nogId,
          p_holder: holder,
          p_ttl_seconds: RESERVATION_TTL_SECONDS,
          p_owner_id: userId,
        });

        if (error) {
          throw mapPostgrestError(error, "attempts.acquireCheckReservation");
        }

        if (data === true) {
          acquired = true;
          break;
        }

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          break;
        }

        await sleep(Math.min(backoffMs, remainingMs));
        backoffMs = Math.min(
          RESERVATION_MAX_BACKOFF_MS,
          Math.round(backoffMs * 1.5),
        );
      }

      if (!acquired) {
        throw new NogBusyError();
      }

      try {
        return await work();
      } finally {
        try {
          await service.rpc("release_check_reservation", {
            p_nog_id: key.nogId,
            p_holder: holder,
            p_owner_id: userId,
          });
        } catch {
          // TTL bounds any lease whose release fails; never mask work outcome.
        }
      }
    },
  };
}
