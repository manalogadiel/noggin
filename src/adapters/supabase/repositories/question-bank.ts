import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionBank, QuestionRecord } from "@/core/application/ports";
import { mapPostgrestError } from "./errors";

const QUESTION_COLUMNS =
  "id, topic_id, prompt, reference_answer, source_excerpt, key_concepts";

interface QuestionRow {
  id: string;
  topic_id: string;
  prompt: string;
  reference_answer: string;
  source_excerpt: string;
  key_concepts: string[];
}

export function createQuestionBank(options: {
  service: SupabaseClient;
}): QuestionBank {
  const { service } = options;

  return {
    async listByTopic(topicId: string): Promise<QuestionRecord[]> {
      const { data, error } = await service
        .from("questions")
        .select(QUESTION_COLUMNS)
        .eq("topic_id", topicId)
        .eq("status", "active")
        .order("position", { ascending: true })
        .returns<QuestionRow[]>();

      if (error) {
        throw mapPostgrestError(error, "questions.listByTopic");
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        topicId: row.topic_id,
        prompt: row.prompt,
        referenceAnswer: row.reference_answer,
        sourceExcerpt: row.source_excerpt,
        keyConcepts: row.key_concepts,
      }));
    },
  };
}
