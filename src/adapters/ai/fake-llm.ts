import type {
  AnswerGrader,
  AnswerInput,
  BrainAnswerResult,
  GeneratedQuestionDraft,
  GenerateQuestionsInput,
  GradeInput,
  GraderResult,
  ListenInput,
  ListenerDigest,
  NogBrain,
  NogListener,
  QuestionWriter,
} from "@/core/application/ports";
import type { LlmAdapterOptions, LlmAdapters } from "./openai-compatible-llm";
import { containsQuestionInjection, NOT_TAUGHT_ANSWER } from "./schemas";

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

const PROTOCOL_FLAG_PATTERN = /\b(?:SYN-ACK|SYN|ACK|FIN|RST|PSH|URG)\b/g;

function sanitizeTopicLabel(
  raw: string,
  fallback: string,
  maxLength: number,
): string {
  const cleaned = raw
    .replace(/\p{Cc}/gu, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (
    cleaned.length < 2 ||
    containsQuestionInjection(raw) ||
    containsQuestionInjection(cleaned) ||
    /<\/?[a-z]/i.test(raw)
  ) {
    return fallback;
  }
  return cleaned.slice(0, maxLength).trim() || fallback;
}

const ENGLISH_QUESTION_ASPECTS = [
  {
    prompt: (topic: string, subject: string) =>
      `What is the main purpose of ${topic} in ${subject}?`,
    answer: (topic: string, subject: string) =>
      `${topic} provides a core mechanism within ${subject} for organizing how key components work together.`,
    excerpt: (topic: string, subject: string) =>
      `In ${subject}, ${topic} defines the foundational role and main purpose of this area.`,
    concepts: ["core purpose", "foundational role"],
  },
  {
    prompt: (topic: string) =>
      `Which main components make up ${topic}?`,
    answer: (topic: string) =>
      `${topic} relies on clearly separated components with distinct responsibilities.`,
    excerpt: (topic: string) =>
      `Understanding ${topic} requires identifying its primary parts and how each part contributes.`,
    concepts: ["main components", "distinct responsibilities"],
  },
  {
    prompt: (topic: string) =>
      `In what order do the key steps of ${topic} happen?`,
    answer: (topic: string) =>
      `The steps in ${topic} follow a predictable sequence from initial setup to completion.`,
    excerpt: (topic: string) =>
      `${topic} follows an ordered workflow where each stage prepares inputs for the next stage.`,
    concepts: ["step sequence", "ordered workflow"],
  },
  {
    prompt: (topic: string) =>
      `What input or condition is needed to start ${topic}?`,
    answer: (topic: string) =>
      `${topic} starts once its required initial state and triggering input are present.`,
    excerpt: (topic: string) =>
      `Before ${topic} can proceed, the initial conditions and starting inputs must be established.`,
    concepts: ["initial condition", "starting input"],
  },
  {
    prompt: (topic: string) =>
      `What output or result does ${topic} produce when completed?`,
    answer: (topic: string) =>
      `Completing ${topic} produces a verifiable outcome that confirms the process succeeded.`,
    excerpt: (topic: string) =>
      `The final result of ${topic} confirms that the expected state or output has been reached.`,
    concepts: ["expected outcome", "completion state"],
  },
  {
    prompt: (topic: string) =>
      `What common mistake or failure mode occurs with ${topic}?`,
    answer: (topic: string) =>
      `Skipping validation or mixing up step order causes common errors in ${topic}.`,
    excerpt: (topic: string) =>
      `Typical failures in ${topic} arise when prerequisites are omitted or steps are performed out of order.`,
    concepts: ["failure mode", "missing prerequisite"],
  },
  {
    prompt: (topic: string, subject: string) =>
      `How does ${topic} trade off simplicity against reliability in ${subject}?`,
    answer: (topic: string) =>
      `${topic} balances lower overhead with the guarantees needed for its intended use case.`,
    excerpt: (topic: string, subject: string) =>
      `Design choices in ${subject} around ${topic} weigh performance overhead against predictability.`,
    concepts: ["design trade-off", "overhead vs reliability"],
  },
  {
    prompt: (topic: string) =>
      `When is ${topic} the right choice in a practical scenario?`,
    answer: (topic: string) =>
      `${topic} fits best when a task matches its core strengths and operating constraints.`,
    excerpt: (topic: string) =>
      `Choosing ${topic} in practice depends on matching real-world constraints to its capabilities.`,
    concepts: ["practical use case", "operating constraints"],
  },
] as const;

const TAGLISH_QUESTION_ASPECTS = [
  {
    prompt: (topic: string, subject: string) =>
      `Ano ang pangunahing layunin ng ${topic} sa ${subject}?`,
    answer: (topic: string, subject: string) =>
      `Ginagamit ang ${topic} sa ${subject} para malinaw na maayos ang pangunahing proseso nito.`,
    excerpt: (topic: string, subject: string) =>
      `Sa ${subject}, ipinapaliwanag ng ${topic} ang pangunahing papel ng bawat bahagi.`,
    concepts: ["pangunahing layunin", "papel sa proseso"],
  },
  {
    prompt: (topic: string) =>
      `Anu-ano ang mga pangunahing bahagi ng ${topic}?`,
    answer: (topic: string) =>
      `Binubuo ang ${topic} ng mga malinaw na bahagi na may sariling tungkulin.`,
    excerpt: (topic: string) =>
      `Mahalagang makilala ang mga pangunahing bahagi ng ${topic} at ang ambag ng bawat isa.`,
    concepts: ["pangunahing bahagi", "tungkulin ng bahagi"],
  },
  {
    prompt: (topic: string) =>
      `Paano ang tamang pagkakasunod-sunod ng mga hakbang sa ${topic}?`,
    answer: (topic: string) =>
      `May malinaw na sunod-sunod na hakbang ang ${topic} mula simula hanggang dulo.`,
    excerpt: (topic: string) =>
      `Sinusundan ng ${topic} ang maayos na daloy kung saan naghahanda ang bawat hakbang sa susunod.`,
    concepts: ["sunod-sunod na hakbang", "daloy ng proseso"],
  },
  {
    prompt: (topic: string) =>
      `Ano ang kailangang kondisyon bago magsimula ang ${topic}?`,
    answer: (topic: string) =>
      `Kailangan muna ng tamang paunang input at kondisyon bago gumana ang ${topic}.`,
    excerpt: (topic: string) =>
      `Bago umandar ang ${topic}, dapat handa ang paunang estado at kinakailangang detalye.`,
    concepts: ["paunang kondisyon", "kinakailangang input"],
  },
  {
    prompt: (topic: string) =>
      `Ano ang inaasahang resulta kapag natapos ang ${topic}?`,
    answer: (topic: string) =>
      `Nagbibigay ang ${topic} ng malinaw at masusuring resulta kapag kumpleto ang proseso.`,
    excerpt: (topic: string) =>
      `Pinatutunayan ng huling resulta ng ${topic} na naabot ang tamang estado.`,
    concepts: ["inaasahang resulta", "huling estado"],
  },
  {
    prompt: (topic: string) =>
      `Ano ang karaniwang pagkakamali kapag inilalapat ang ${topic}?`,
    answer: (topic: string) =>
      `Madalas magkamali sa ${topic} kapag nilaktawan ang mahalagang hakbang o nagkapalit ang ayos.`,
    excerpt: (topic: string) =>
      `Nagkakaroon ng error sa ${topic} kapag kulang ang paunang check o mali ang pagkakasunod.`,
    concepts: ["karaniwang pagkakamali", "nilaktawang hakbang"],
  },
  {
    prompt: (topic: string, subject: string) =>
      `Ano ang trade-off sa paggamit ng ${topic} sa ${subject}?`,
    answer: (topic: string) =>
      `Binabalanse ng ${topic} ang bilis at kasimplehan laban sa mas mahigpit na kontrol.`,
    excerpt: (topic: string, subject: string) =>
      `Sa ${subject}, tinitimbang ng ${topic} ang bilis ng proseso at ang pagiging maaasahan nito.`,
    concepts: ["trade-off sa bilis", "pagiging maaasahan"],
  },
  {
    prompt: (topic: string) =>
      `Kailan pinakamainam gamitin ang ${topic} sa totoong sitwasyon?`,
    answer: (topic: string) =>
      `Pinakamainam ang ${topic} kapag tugma ang pangangailangan ng gawain sa lakas nito.`,
    excerpt: (topic: string) =>
      `Nakadepende ang pagpili sa ${topic} sa aktwal na limitasyon at layunin ng gumagamit.`,
    concepts: ["praktikal na gamit", "limitasyon ng gawain"],
  },
] as const;

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
  if (matched / conceptTokens.length >= 0.5) {
    return true;
  }
  if (
    /\bflag\b/i.test(concept) &&
    matched >= 1 &&
    (text.match(PROTOCOL_FLAG_PATTERN)?.length ?? 0) > 0
  ) {
    return true;
  }
  return false;
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
          ? `Gets ko na!${mimicTag} ${firstSentence(body, 180)}`
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

        const excerptFlags = new Set(
          question.sourceExcerpt.match(PROTOCOL_FLAG_PATTERN) ?? [],
        );
        const answerFlags = new Set(
          answerText.match(PROTOCOL_FLAG_PATTERN) ?? [],
        );
        const flagsConsistent =
          excerptFlags.size === 0 ||
          answerFlags.size === 0 ||
          Array.from(excerptFlags).every((flag) => answerFlags.has(flag));

        const concepts = question.keyConcepts.map((concept) => {
          const inAnswer = conceptPresent(concept, answerText);
          const inPages = conceptPresent(concept, cleanedPages);
          const overlapWithReference =
            answerTokens.length > 0 &&
            answerTokens.some((token) => referenceTokens.has(token));
          const consistentWithReference =
            inAnswer && overlapWithReference && flagsConsistent;
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

  const questionWriter: QuestionWriter = {
    async generate(
      input: GenerateQuestionsInput,
    ): Promise<GeneratedQuestionDraft[]> {
      const safeSubject = sanitizeTopicLabel(
        input.subjectName,
        "General Studies",
        40,
      );
      const safeTopic = sanitizeTopicLabel(
        input.topicTitle,
        "core fundamentals",
        60,
      );
      const isTaglish =
        TAGLISH_MARKERS.test(safeTopic) || TAGLISH_MARKERS.test(safeSubject);
      const templates = isTaglish
        ? TAGLISH_QUESTION_ASPECTS
        : ENGLISH_QUESTION_ASPECTS;

      return templates.map((template, index) => ({
        position: index + 1,
        prompt: template.prompt(safeTopic, safeSubject).slice(0, 240),
        referenceAnswer: template.answer(safeTopic, safeSubject).slice(0, 400),
        sourceExcerpt: template.excerpt(safeTopic, safeSubject).slice(0, 500),
        keyConcepts: [...template.concepts],
      }));
    },
  };

  return { listener, brain, grader, questionWriter };
}
