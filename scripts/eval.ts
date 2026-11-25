import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { groundQuote } from "../src/core/domain/quote-grounding";
import type {
  AnswerInput,
  AskInput,
  AskOutput,
  DigestOperation,
  GenerateQuestionsInput,
  GradeInput,
  GraderResult,
  ListenInput,
  ListenerDigest,
} from "../src/core/application/ports";
import { createFakeLlmAdapters } from "../src/adapters/ai/fake-llm";
import {
  createOpenAiCompatibleAdapters,
  LlmConfigError,
  type LlmAdapters,
  type LlmUsageEvent,
} from "../src/adapters/ai/openai-compatible-llm";
import { PROMPT_VERSION as ANSWERER_PROMPT_VERSION } from "../src/adapters/ai/prompts/answerer";
import { PROMPT_VERSION as ASKER_PROMPT_VERSION } from "../src/adapters/ai/prompts/asker";
import { PROMPT_VERSION as GRADER_PROMPT_VERSION } from "../src/adapters/ai/prompts/grader";
import {
  PROMPT_VERSION as LISTENER_PROMPT_VERSION,
  type NogPersona,
} from "../src/adapters/ai/prompts/listener";
import { PROMPT_VERSION as QUESTION_WRITER_PROMPT_VERSION } from "../src/adapters/ai/prompts/question-writer";
import {
  parseListenerDigest,
  questionWriterResponseSchema,
} from "../src/adapters/ai/schemas";

type GoldenCase = { id: string; required?: boolean } & (
  | {
      port: "listener";
      input: ListenInput;
      providerResponse?: unknown;
      expected: {
        operation?: Partial<DigestOperation>;
        operationStatuses?: string[];
        offTopic?: boolean;
        minFollowUpQuestions?: number;
        minCreateOps?: number;
        allQuotesGrounded?: boolean;
        replyPatterns?: string[];
        replyNotMatch?: string[];
        output?: ListenerDigest;
      };
    }
  | {
      port: "grader";
      input: GradeInput;
      expected: { output: GraderResult; sameVerdictAs?: string };
    }
  | {
      port: "answerer";
      input: AnswerInput;
      expected: { answers: { questionId: string; nogAnswerPattern: string }[] };
    }
  | {
      port: "asker";
      input: AskInput;
      expected: { knows: boolean; citedCardIds: string[]; answerPattern?: string };
    }
  | {
      port: "question-writer";
      input: GenerateQuestionsInput;
      expected?: { questionCount?: number };
    }
);

interface GoldenSuite {
  cases: GoldenCase[];
}

interface CaseOutcome {
  id: string;
  required: boolean;
  passed: boolean;
  reason?: string;
}

const EVAL_PERSONA: NogPersona = {
  nogName: "Pingu",
  stage: "sprout",
  grillMode: "roast",
  speechPhrases: [],
};

const OVERALL_PASS_THRESHOLD = 0.8;

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readNonNegativeNumberEnv(key: string): number {
  const raw = readEnv(key);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function validateHttpUrl(key: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LlmConfigError(`Invalid ${key}: must be a valid http(s) URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LlmConfigError(`Invalid ${key}: must use http or https.`);
  }
  return value;
}

function buildEvalAdapters(onUsage: (event: LlmUsageEvent) => void): {
  adapters: LlmAdapters;
  modelId: string;
} {
  const provider = readEnv("LLM_PROVIDER")?.toLowerCase();
  const offlineByDefault =
    !provider && !process.argv.includes("--live") && !readEnv("LLM_BASE_URL");
  if (provider === "fake" || offlineByDefault) {
    if (process.env.NODE_ENV === "production") {
      throw new LlmConfigError(
        "LLM_PROVIDER=fake cannot be enabled when NODE_ENV is production.",
      );
    }
    return {
      adapters: createFakeLlmAdapters({
        getPersona: async () => EVAL_PERSONA,
        speechMimicry: false,
      }),
      modelId: "fake",
    };
  }

  const baseUrl = readEnv("LLM_BASE_URL");
  const apiKey = readEnv("LLM_API_KEY");
  const model = readEnv("LLM_MODEL");
  const askerModel = readEnv("LLM_ASKER_MODEL");
  const missing = [
    !baseUrl ? "LLM_BASE_URL" : null,
    !apiKey ? "LLM_API_KEY" : null,
    !model ? "LLM_MODEL" : null,
  ].filter((item): item is string => item !== null);

  if (missing.length > 0) {
    throw new LlmConfigError(
      `Missing required language provider configuration: ${missing.join(", ")}`,
    );
  }

  const fallbackBaseUrl = readEnv("LLM_FALLBACK_BASE_URL");
  const fallbackModel = readEnv("LLM_FALLBACK_MODEL");
  const fallbackApiKey = readEnv("LLM_FALLBACK_API_KEY");

  const fallback =
    fallbackBaseUrl && fallbackModel
      ? {
          baseUrl: validateHttpUrl("LLM_FALLBACK_BASE_URL", fallbackBaseUrl),
          apiKey: fallbackApiKey,
          model: fallbackModel,
        }
      : undefined;

  return {
    adapters: createOpenAiCompatibleAdapters(
      {
        primary: {
          baseUrl: validateHttpUrl("LLM_BASE_URL", baseUrl!),
          apiKey: apiKey!,
          model: model!,
        },
        fallback,
        ...(askerModel ? { roleModels: { asker: askerModel } } : {}),
      },
      {
        getPersona: async () => EVAL_PERSONA,
        speechMimicry: false,
        onUsage,
      },
    ),
    modelId: model!,
  };
}

function operationMatchesPartial(
  actual: DigestOperation,
  expected: Partial<DigestOperation>,
): boolean {
  const actualRecord = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    if (value !== undefined && actualRecord[key] !== value) {
      return false;
    }
  }
  return true;
}

function evaluateListenerOutput(
  testCase: Extract<GoldenCase, { port: "listener" }>,
  actual: ListenerDigest,
): { passed: boolean; reason?: string } {
  const { expected } = testCase;

  if (expected.offTopic !== undefined && (actual.offTopic ?? false) !== expected.offTopic) {
    return { passed: false, reason: "unexpected topic fit verdict" };
  }

  if (expected.output !== undefined) {
    if (!isDeepStrictEqual(actual, expected.output)) {
      return { passed: false, reason: "output mismatch" };
    }
  }

  if (expected.operation !== undefined) {
    const matched = actual.operations.some((op) =>
      operationMatchesPartial(op, expected.operation!),
    );
    if (!matched) {
      return { passed: false, reason: "expected operation not found" };
    }
  }

  if (expected.operationStatuses !== undefined) {
    const allowed = new Set(expected.operationStatuses);
    const hasStatus = actual.operations.some(
      (op) => "status" in op && op.status !== undefined && allowed.has(op.status),
    );
    if (!hasStatus) {
      return { passed: false, reason: "expected operation status not found" };
    }
  }

  if (expected.minFollowUpQuestions !== undefined) {
    if (actual.followUpQuestions.length < expected.minFollowUpQuestions) {
      return { passed: false, reason: "insufficient follow-up questions" };
    }
  }

  if (expected.minCreateOps !== undefined) {
    const createCount = actual.operations.filter(
      (op) => op.type === "create",
    ).length;
    if (createCount < expected.minCreateOps) {
      return { passed: false, reason: "insufficient create operations" };
    }
  }

  if (expected.replyPatterns !== undefined) {
    for (const pattern of expected.replyPatterns) {
      if (!new RegExp(pattern, "i").test(actual.reply)) {
        return { passed: false, reason: `reply did not match pattern ${pattern}` };
      }
    }
  }

  if (expected.replyNotMatch !== undefined) {
    for (const pattern of expected.replyNotMatch) {
      if (new RegExp(pattern, "i").test(actual.reply)) {
        return { passed: false, reason: `reply matched forbidden pattern ${pattern}` };
      }
    }
  }

  if (expected.allQuotesGrounded && actual.operations.length === 0) {
    return { passed: false, reason: "expected at least one grounded operation" };
  }

  const ungrounded = actual.operations.some(
    (op) =>
      "quote" in op &&
      op.quote !== undefined &&
      groundQuote(testCase.input.page.body, op.quote) === null,
  );
  if (ungrounded) {
    return { passed: false, reason: "operation quote not found in lesson page" };
  }

  return { passed: true };
}

function evaluateAskerOutput(
  { expected }: Extract<GoldenCase, { port: "asker" }>,
  { knows, citedCardIds, answer }: AskOutput,
): { passed: boolean; reason?: string } {
  if (knows !== expected.knows) {
    return { passed: false, reason: "unexpected knowledge verdict" };
  }
  const validCitations = knows
    ? citedCardIds.length > 0 && citedCardIds.every((id) => expected.citedCardIds.includes(id))
    : citedCardIds.length === 0;
  if (!validCitations) {
    return { passed: false, reason: "unexpected citations" };
  }
  if (expected.answerPattern && !new RegExp(expected.answerPattern, "i").test(answer)) {
    return { passed: false, reason: "answer did not match expected pattern" };
  }
  return { passed: true };
}

export async function runEval(): Promise<boolean> {
  const goldenPath = new URL("../evals/golden.json", import.meta.url);
  const suite = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenSuite;

  const totals = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  const { adapters, modelId } = buildEvalAdapters((event) => {
    totals.calls += 1;
    totals.promptTokens += event.promptTokens;
    totals.completionTokens += event.completionTokens;
    totals.totalTokens += event.totalTokens;
  });

  console.log(`Model: ${modelId}`);
  console.log(
    `Prompt versions: listener=${LISTENER_PROMPT_VERSION}, answerer=${ANSWERER_PROMPT_VERSION}, asker=${ASKER_PROMPT_VERSION}, grader=${GRADER_PROMPT_VERSION}, questionWriter=${QUESTION_WRITER_PROMPT_VERSION}`,
  );

  const graderResults = new Map<string, GraderResult>();
  const outcomes: CaseOutcome[] = [];

  for (const testCase of suite.cases) {
    const required = Boolean(testCase.required);
    try {
      if (testCase.port === "listener") {
        let digest: ListenerDigest;
        if (testCase.providerResponse !== undefined) {
          const parsed = parseListenerDigest(testCase.providerResponse);
          if (!parsed.ok) {
            outcomes.push({
              id: testCase.id,
              required,
              passed: false,
              reason: parsed.error,
            });
            console.log(`FAIL ${testCase.id} — ${parsed.error}`);
            continue;
          }
          digest = parsed.value;
        } else {
          digest = await adapters.listener.listen(testCase.input);
        }

        const check = evaluateListenerOutput(testCase, digest);
        outcomes.push({ id: testCase.id, required, ...check });
        console.log(
          check.passed
            ? `PASS ${testCase.id}`
            : `FAIL ${testCase.id} — ${check.reason ?? "failed"}`,
        );
      } else if (testCase.port === "asker") {
        if (!adapters.asker) {
          outcomes.push({
            id: testCase.id,
            required,
            passed: false,
            reason: "asker adapter not configured",
          });
          console.log(`FAIL ${testCase.id} — asker adapter not configured`);
          continue;
        }
        const result = await adapters.asker.ask(testCase.input);
        const check = evaluateAskerOutput(testCase, result);
        outcomes.push({ id: testCase.id, required, ...check });
        console.log(
          check.passed
            ? `PASS ${testCase.id}`
            : `FAIL ${testCase.id} — ${check.reason ?? "failed"}`,
        );
      } else if (testCase.port === "answerer") {
        const result = await adapters.brain.answer(testCase.input);
        const byId = new Map(
          result.answers.map((entry) => [entry.questionId, entry.nogAnswer]),
        );
        let reason: string | undefined;
        for (const expectedAnswer of testCase.expected.answers) {
          const actualAnswer = byId.get(expectedAnswer.questionId);
          if (actualAnswer === undefined) {
            reason = `missing answer for ${expectedAnswer.questionId}`;
            break;
          }
          if (!new RegExp(expectedAnswer.nogAnswerPattern, "i").test(actualAnswer)) {
            reason = `answer for ${expectedAnswer.questionId} did not match expected pattern`;
            break;
          }
        }
        const passed = reason === undefined;
        outcomes.push({ id: testCase.id, required, passed, reason });
        console.log(
          passed ? `PASS ${testCase.id}` : `FAIL ${testCase.id} — ${reason}`,
        );
      } else if (testCase.port === "question-writer") {
        if (!adapters.questionWriter) {
          outcomes.push({
            id: testCase.id,
            required,
            passed: false,
            reason: "questionWriter adapter not configured",
          });
          console.log(
            `FAIL ${testCase.id} — questionWriter adapter not configured`,
          );
          continue;
        }
        const generated = await adapters.questionWriter.generate(
          testCase.input,
        );
        const schemaCheck = questionWriterResponseSchema.safeParse({
          questions: generated.map(
            ({ prompt, referenceAnswer, sourceExcerpt, keyConcepts }) => ({
              prompt,
              referenceAnswer,
              sourceExcerpt,
              keyConcepts,
            }),
          ),
        });
        const expectedCount = testCase.expected?.questionCount ?? 8;
        const positionsValid =
          generated.length === expectedCount &&
          generated.every((item, index) => item.position === index + 1);
        const passed = schemaCheck.success && positionsValid;
        const reason = !schemaCheck.success
          ? "generated questions failed schema validation"
          : !positionsValid
            ? "generated questions had invalid count or positions"
            : undefined;
        outcomes.push({ id: testCase.id, required, passed, reason });
        console.log(
          passed ? `PASS ${testCase.id}` : `FAIL ${testCase.id} — ${reason}`,
        );
      } else {
        const result = await adapters.grader.grade(testCase.input);
        graderResults.set(testCase.id, result);

        let passed = isDeepStrictEqual(result, testCase.expected.output);
        let reason: string | undefined = passed ? undefined : "grade verdict mismatch";

        if (passed && testCase.expected.sameVerdictAs) {
          const baseline = graderResults.get(testCase.expected.sameVerdictAs);
          if (!baseline || !isDeepStrictEqual(result, baseline)) {
            passed = false;
            reason = `verdict diverged from ${testCase.expected.sameVerdictAs}`;
          }
        }

        outcomes.push({ id: testCase.id, required, passed, reason });
        console.log(
          passed ? `PASS ${testCase.id}` : `FAIL ${testCase.id} — ${reason}`,
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.name : "unexpected error";
      outcomes.push({ id: testCase.id, required, passed: false, reason });
      console.log(`FAIL ${testCase.id} — ${reason}`);
    }
  }

  const passedCount = outcomes.filter((item) => item.passed).length;
  const totalCount = outcomes.length;
  const passRate = totalCount > 0 ? passedCount / totalCount : 0;
  const requiredOutcomes = outcomes.filter((item) => item.required);
  const requiredPassed = requiredOutcomes.every((item) => item.passed);
  const threshold = modelId === "fake" ? 1 : OVERALL_PASS_THRESHOLD;
  const overallPassed = requiredPassed && passRate >= threshold;
  const avgTokens =
    totals.calls > 0 ? Math.round(totals.totalTokens / totals.calls) : 0;
  const inputRatePerMillion = readNonNegativeNumberEnv("LLM_INPUT_COST_PER_1M");
  const outputRatePerMillion = readNonNegativeNumberEnv(
    "LLM_OUTPUT_COST_PER_1M",
  );
  const totalCostUsd =
    (totals.promptTokens * inputRatePerMillion +
      totals.completionTokens * outputRatePerMillion) /
    1_000_000;
  const costPerCallUsd = totals.calls > 0 ? totalCostUsd / totals.calls : 0;

  console.log(
    `Summary: ${passedCount}/${totalCount} passed (${Math.round(passRate * 100)}%), required: ${requiredOutcomes.filter((item) => item.passed).length}/${requiredOutcomes.length}`,
  );
  console.log(
    `Tokens: prompt=${totals.promptTokens}, completion=${totals.completionTokens}, total=${totals.totalTokens} (avg ${avgTokens} tokens/call across ${totals.calls} calls, est. $${costPerCallUsd.toFixed(6)}/call)`,
  );

  process.exitCode = overallPassed ? 0 : 1;
  return overallPassed;
}

function isDirectEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }
  const current = resolve(fileURLToPath(import.meta.url));
  const target = resolve(invoked);
  return process.platform === "win32"
    ? current.toLowerCase() === target.toLowerCase()
    : current === target;
}

if (isDirectEntryPoint()) {
  void runEval().catch((error) => {
    const message = error instanceof LlmConfigError ? error.message : "Eval failed";
    console.error(message);
    process.exitCode = 1;
  });
}
