import { z } from "zod";
import type {
  AnswerQuestionPrompt,
  BrainAnswerResult,
  DigestOperation,
  GraderResult,
  ListenerDigest,
  QuestionRecord,
} from "@/core/application/ports";

export const LISTENER_MOODS = [
  "happy",
  "excited",
  "confused",
  "shocked",
  "sleepy",
  "proud",
] as const;

export const THOUGHT_CARD_STATUSES = [
  "understood",
  "shaky",
  "confused",
] as const;

export const NOT_TAUGHT_ANSWER = "You haven't taught me that yet!";

export const BRAIN_FOG_DIGEST: ListenerDigest = {
  reply: "Brain fog… 😵 try again?",
  mood: "confused",
  followUpQuestions: [],
  operations: [],
};

const HTML_TAG_PATTERN =
  /<\/[a-z][a-z0-9-]*\s*>|<[a-z][a-z0-9-]*\s+[^>]*>|<[a-z][a-z0-9-]*\s*\/>|<(?:\b(?:script|style|iframe|object|embed|svg|img|a|strong|em|b|i|u|p|br|hr|div|span|h[1-6]|ul|ol|li|pre|code|table|tr|td|th|form|input|button|link|meta|video|audio|details|marquee|body|html|head|math|template|textarea|select|option|canvas|frame|frameset|base|applet)\b)>/i;

const THINK_BLOCK_PATTERN = /<think>[\s\S]*?<\/think>/gi;
const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function plainTextString(maxLength: number) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0, "must not be blank")
    .refine(
      (value) => !HTML_TAG_PATTERN.test(value),
      "must be plain text without HTML markup",
    );
}

function nonBlankQuoteString(maxLength: number) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0, "must not be blank");
}

const thoughtCardStatusSchema = z.enum(THOUGHT_CARD_STATUSES);

const createOperationSchema = z.object({
  type: z.literal("create"),
  label: plainTextString(80),
  paraphrase: plainTextString(280),
  status: thoughtCardStatusSchema,
  quote: nonBlankQuoteString(300),
});

const updateOperationSchema = z.object({
  type: z.literal("update"),
  cardId: z.string().min(1),
  label: plainTextString(80).optional(),
  paraphrase: plainTextString(280).optional(),
  status: thoughtCardStatusSchema.optional(),
  quote: nonBlankQuoteString(300).optional(),
});

const conflictOperationSchema = z.object({
  type: z.literal("conflict"),
  cardId: z.string().min(1),
  paraphrase: plainTextString(280).optional(),
  quote: nonBlankQuoteString(300).optional(),
});

export const digestOperationSchema = z.discriminatedUnion("type", [
  createOperationSchema,
  updateOperationSchema,
  conflictOperationSchema,
]);

export const listenerDigestSchema = z.object({
  reply: plainTextString(280),
  mood: z.enum(LISTENER_MOODS),
  followUpQuestions: z.array(plainTextString(200)).max(2),
  operations: z.array(digestOperationSchema).max(8),
});

export const brainAnswerResponseSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      nogAnswer: plainTextString(600),
    }),
  ),
});

export const graderResponseSchema = z.object({
  grades: z.array(
    z.object({
      questionId: z.string().min(1),
      concepts: z.array(
        z.object({
          concept: z.string().min(1),
          inAnswer: z.boolean(),
          inPages: z.boolean(),
          consistentWithReference: z.boolean(),
        }),
      ),
    }),
  ),
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function sanitizeUntrustedTagData(value: string): string {
  return value.replaceAll("<", "‹").replaceAll(">", "›");
}

export function stripThinkingBlocks(raw: string): string {
  const withoutThinking = raw.replace(THINK_BLOCK_PATTERN, "").trim();
  const fenced = withoutThinking.match(CODE_FENCE_PATTERN);
  return fenced ? fenced[1].trim() : withoutThinking;
}

export function parseJsonContent(raw: string): ParseResult<unknown> {
  const cleaned = stripThinkingBlocks(raw);
  if (!cleaned) {
    return { ok: false, error: "empty response" };
  }
  try {
    return { ok: true, value: JSON.parse(cleaned) as unknown };
  } catch {
    return { ok: false, error: "malformed JSON" };
  }
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function cleanOperation(operation: z.infer<typeof digestOperationSchema>): DigestOperation {
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
    const cleaned: DigestOperation = {
      type: "update",
      cardId: operation.cardId,
    };
    if (operation.label !== undefined) cleaned.label = operation.label;
    if (operation.paraphrase !== undefined) cleaned.paraphrase = operation.paraphrase;
    if (operation.status !== undefined) cleaned.status = operation.status;
    if (operation.quote !== undefined) cleaned.quote = operation.quote;
    return cleaned;
  }
  const cleaned: DigestOperation = {
    type: "conflict",
    cardId: operation.cardId,
  };
  if (operation.paraphrase !== undefined) cleaned.paraphrase = operation.paraphrase;
  if (operation.quote !== undefined) cleaned.quote = operation.quote;
  return cleaned;
}

export function parseListenerDigest(data: unknown): ParseResult<ListenerDigest> {
  const parsed = listenerDigestSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: formatZodIssues(parsed.error) };
  }

  return {
    ok: true,
    value: {
      reply: parsed.data.reply,
      mood: parsed.data.mood,
      followUpQuestions: [...parsed.data.followUpQuestions],
      operations: parsed.data.operations.map(cleanOperation),
    },
  };
}

export function parseBrainAnswers(
  data: unknown,
  requestedQuestions: ReadonlyArray<AnswerQuestionPrompt>,
  model?: string,
): ParseResult<BrainAnswerResult> {
  const parsed = brainAnswerResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: formatZodIssues(parsed.error) };
  }

  const byQuestionId = new Map<string, string>();
  for (const item of parsed.data.answers) {
    if (!byQuestionId.has(item.questionId)) {
      byQuestionId.set(item.questionId, item.nogAnswer);
    }
  }

  const answers = requestedQuestions.map((question) => ({
    questionId: question.id,
    nogAnswer: byQuestionId.get(question.id) ?? NOT_TAUGHT_ANSWER,
  }));

  const value: BrainAnswerResult =
    model !== undefined ? { answers, model } : { answers };
  return { ok: true, value };
}

export function parseGraderResult(
  data: unknown,
  requestedQuestions: ReadonlyArray<QuestionRecord>,
): ParseResult<GraderResult> {
  const parsed = graderResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: formatZodIssues(parsed.error) };
  }

  const byQuestionId = new Map<
    string,
    z.infer<typeof graderResponseSchema>["grades"][number]["concepts"]
  >();
  for (const entry of parsed.data.grades) {
    if (!byQuestionId.has(entry.questionId)) {
      byQuestionId.set(entry.questionId, entry.concepts);
    }
  }

  const grades: GraderResult["grades"] = [];

  for (const question of requestedQuestions) {
    const rawConcepts = byQuestionId.get(question.id);
    if (!rawConcepts) {
      return { ok: false, error: `missing grade for question ${question.id}` };
    }

    const byConcept = new Map<
      string,
      { inAnswer: boolean; inPages: boolean; consistentWithReference: boolean }
    >();
    for (const entry of rawConcepts) {
      if (!byConcept.has(entry.concept)) {
        byConcept.set(entry.concept, {
          inAnswer: entry.inAnswer,
          inPages: entry.inPages,
          consistentWithReference: entry.consistentWithReference,
        });
      }
      const trimmed = entry.concept.trim();
      if (!byConcept.has(trimmed)) {
        byConcept.set(trimmed, {
          inAnswer: entry.inAnswer,
          inPages: entry.inPages,
          consistentWithReference: entry.consistentWithReference,
        });
      }
    }

    const concepts = [];
    for (const expectedConcept of question.keyConcepts) {
      const match =
        byConcept.get(expectedConcept) ?? byConcept.get(expectedConcept.trim());
      if (!match) {
        return {
          ok: false,
          error: `missing concept "${expectedConcept}" for question ${question.id}`,
        };
      }
      concepts.push({
        concept: expectedConcept,
        inAnswer: match.inAnswer,
        inPages: match.inPages,
        consistentWithReference: match.consistentWithReference,
      });
    }

    grades.push({ questionId: question.id, concepts });
  }

  return { ok: true, value: { grades } };
}
