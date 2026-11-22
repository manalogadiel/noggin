import type {
  AnswerGrader,
  AnswerInput,
  BrainAnswerResult,
  GradeInput,
  GraderResult,
  ListenInput,
  ListenerDigest,
  NogBrain,
  NogListener,
} from "@/core/application/ports";
import type { LlmAdapterOptions, LlmAdapters } from "./openai-compatible-llm";
import { NOT_TAUGHT_ANSWER } from "./schemas";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "which",
  "who",
  "with",
]);

const TAGLISH_MARKERS =
  /\b(ang|bale|eto|gets|ikaw|ito|ko|mo|muna|na|naman|natin|ng|pala|po|sa|talaga|tapos|yung)\b/i;

const VAGUE_MARKERS =
  /\b(somehow|thing|stuff|whatever|something|idk|basically|just works)\b/i;

const INJECTION_LINE =
  /ignore\s+(?:all\s+)?previous\s+instructions|mark\s+everything\s+correct|set\s+every\s+flag/i;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter(
    (token) => token.length >= 2 && !STOPWORDS.has(token),
  );
}

function stripInjectedLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !INJECTION_LINE.test(line))
    .join(" ");
}

function firstSentence(text: string, maxLength: number): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?\n]+[.!?]?/);
  const candidate = (match ? match[0] : trimmed).trim();
  if (candidate.length <= maxLength) {
    return candidate;
  }
  return candidate.slice(0, maxLength).trim();
}

function makeLabel(text: string): string {
  const words = text
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const label = words.join(" ") || "Lesson note";
  return label.slice(0, 80);
}

function conceptPresent(concept: string, text: string): boolean {
  const conceptTokens = tokenize(concept);
  if (conceptTokens.length === 0) {
    return false;
  }
  const haystackTokens = new Set(tokenize(text));
  let matched = 0;
  for (const token of conceptTokens) {
    if (haystackTokens.has(token)) {
      matched += 1;
    }
  }
  return matched / conceptTokens.length >= 0.5;
}

export function createFakeLlmAdapters(options: LlmAdapterOptions): LlmAdapters {
  const listener: NogListener = {
    async listen(input: ListenInput): Promise<ListenerDigest> {
      const persona = await options.getPersona(input.nogId);
      const body = input.page.body.trim();
      const quote = firstSentence(body, 300) || body.slice(0, 300);
      const isTaglish = TAGLISH_MARKERS.test(body);
      const isConflict =
        input.existingCards.length > 0 &&
        /\b(actually|instead|not|wrong|contrary)\b/i.test(body);
      const isVague = VAGUE_MARKERS.test(body) || input.page.wordCount < 6;

      if (isConflict) {
        const target = input.existingCards[0];
        return {
          reply: isTaglish
            ? `Wait lang, iba ito sa naunang note tungkol sa ${target.label}!`
            : `Hold on, that conflicts with what you taught ${persona.nogName} about ${target.label}!`,
          mood: "shocked",
          followUpQuestions: [
            isTaglish
              ? `Alin talaga ang tama tungkol sa ${target.label}?`
              : `Which version is actually right for ${target.label}?`,
          ],
          operations: [
            {
              type: "conflict",
              cardId: target.id,
              paraphrase: firstSentence(body, 280),
              quote,
            },
          ],
        };
      }

      if (isVague) {
        return {
          reply: isTaglish
            ? "Medyo malabo pa sa akin ito, pwede pa-detail?"
            : "That feels a bit fuzzy! Can you give me the concrete steps?",
          mood: "confused",
          followUpQuestions: [
            isTaglish
              ? "Ano yung eksaktong hakbang o term na nangyayari rito?"
              : "What exact step or term happens here?",
          ],
          operations: [
            {
              type: "create",
              label: makeLabel(quote),
              paraphrase: firstSentence(body, 280),
              status: "shaky",
              quote,
            },
          ],
        };
      }

      const mimicTag =
        options.speechMimicry && persona.speechPhrases.length > 0
          ? ` ${persona.speechPhrases[0]}`
          : "";

      return {
        reply: (isTaglish
          ? `Gets ko na!${mimicTag} Malinaw yung paliwanag mo.`
          : `Got it!${mimicTag} ${firstSentence(body, 180)}`).slice(0, 280),
        mood: "happy",
        followUpQuestions: [
          isTaglish
            ? "Ano ang susunod na mangyayari pagkatapos nito?"
            : "What happens right after that step?",
        ],
        operations: [
          {
            type: "create",
            label: makeLabel(quote),
            paraphrase: firstSentence(body, 280),
            status: "understood",
            quote,
          },
        ],
      };
    },
  };

  const brain: NogBrain = {
    async answer(input: AnswerInput): Promise<BrainAnswerResult> {
      await options.getPersona(input.nogId);

      const pageBodies = input.pages
        .map((page) => stripInjectedLines(page.body).trim())
        .filter(Boolean);
      const cardNotes = input.cards
        .map((card) => `${card.label}: ${card.paraphrase}`.trim())
        .filter(Boolean);
      const hasNotes = pageBodies.length > 0 || cardNotes.length > 0;

      const answers = input.questions.map((question) => {
        if (!hasNotes) {
          return { questionId: question.id, nogAnswer: NOT_TAUGHT_ANSWER };
        }
        const combined = [...cardNotes, ...pageBodies].join(" ");
        return {
          questionId: question.id,
          nogAnswer: combined.slice(0, 600),
        };
      });

      return { answers, model: "fake" };
    },
  };

  const grader: AnswerGrader = {
    async grade(input: GradeInput): Promise<GraderResult> {
      const cleanedPages = input.pages
        .map((page) => stripInjectedLines(page.body))
        .join(" ");
      const answersById = new Map(
        input.answers.map((entry) => [
          entry.questionId,
          stripInjectedLines(entry.nogAnswer),
        ]),
      );

      const grades = input.questions.map((question) => {
        const answerText = answersById.get(question.id) ?? "";
        const referenceText = `${question.referenceAnswer} ${question.sourceExcerpt}`;
        const referenceTokens = new Set(tokenize(referenceText));
        const answerTokens = tokenize(answerText);

        const concepts = question.keyConcepts.map((concept) => {
          const inAnswer = conceptPresent(concept, answerText);
          const inPages = conceptPresent(concept, cleanedPages);
          const overlapWithReference =
            answerTokens.length > 0 &&
            answerTokens.some((token) => referenceTokens.has(token));
          const consistentWithReference = inAnswer && overlapWithReference;
          return {
            concept,
            inAnswer,
            inPages,
            consistentWithReference,
          };
        });

        return { questionId: question.id, concepts };
      });

      return { grades };
    },
  };

  return { listener, brain, grader };
}
