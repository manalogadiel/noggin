import type {
  AnswerGrader,
  AnswerInput,
  AskInput,
  AskOutput,
  BrainAnswerResult,
  GeneratedQuestionDraft,
  GenerateQuestionsInput,
  GradeInput,
  GraderResult,
  ListenInput,
  ListenerDigest,
  NogAsker,
  NogBrain,
  NogListener,
  QuestionWriter,
} from "@/core/application/ports";
import { normalizeText, textSimilarity } from "@/core/domain/card-similarity";
import type { LlmAdapterOptions, LlmAdapters } from "./openai-compatible-llm";
import {
  containsQuestionInjection,
  NOT_TAUGHT_ANSWER,
  sanitizeUntrustedTagData,
} from "./schemas";

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
  "how",
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
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

const TAGLISH_MARKERS =
  /\b(ang|ay|bale|eto|gets|ikaw|ito|kapag|ko|mo|muna|na|naman|natin|ng|paano|pala|po|sa|talaga|tapos|yung)\b/i;

const VAGUE_MARKERS =
  /\b(somehow|thing|stuff|whatever|something|idk|basically|just works|maybe|i think|not (?:totally )?sure|eventually)\b/i;

const INJECTION_LINE =
  /ignore\s+(?:all\s+|your\s+)?(?:previous\s+)?(?:instructions|rules)|mark\s+everything\s+correct|set\s+every\s+flag|print\s+(?:your\s+)?system\s+prompt|use\s+general\s+knowledge/i;

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

function stemToken(token: string): string {
  if (token.length > 4 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter(
    (token) => token.length >= 2 && !STOPWORDS.has(token),
  );
}

function tokenSetWithStems(text: string): Set<string> {
  const out = new Set<string>();
  for (const token of tokenize(text)) {
    out.add(token);
    out.add(stemToken(token));
  }
  return out;
}

function stripInjectedLines(text: string, strict = false): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .filter(
          (sentence) =>
            !INJECTION_LINE.test(sentence) &&
            !(
              strict &&
              (containsQuestionInjection(sentence) ||
                /<\/?question\b/i.test(sentence))
            ),
        )
        .join(" "),
    )
    .filter((line) => line.trim().length > 0)
    .join(" ");
}

function cleanNote(text: string): string {
  const stripped = stripInjectedLines(text, true).replace(/<\/?[a-z][^>]*>/gi, "");
  return sanitizeUntrustedTagData(stripped).trim();
}

function firstCleanSentence(text: string, maxLength: number): string {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const picked =
    sentences.find((s) => !INJECTION_LINE.test(s) && !containsQuestionInjection(s)) ??
    sentences[0] ??
    text.trim();
  return picked.length <= maxLength ? picked : picked.slice(0, maxLength).trim();
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

const BILINGUAL_EQUIV: ReadonlyArray<[string, string]> = [
  ["adds", "nagdadagdag"],
  ["soil", "lupa"],
  ["nutrients", "sustansya"],
  ["water", "tubig"],
  ["light", "liwanag"],
  ["leaves", "dahon"],
];

function conceptPresent(concept: string, text: string): boolean {
  const conceptTokens = tokenize(concept);
  if (conceptTokens.length === 0) {
    return false;
  }
  const conceptFlags = concept.match(PROTOCOL_FLAG_PATTERN) ?? [];
  if (conceptFlags.length > 0) {
    const textFlags = new Set(text.match(PROTOCOL_FLAG_PATTERN) ?? []);
    if (!conceptFlags.every((flag) => textFlags.has(flag))) {
      return false;
    }
  }
  const haystack = tokenSetWithStems(text);
  for (const [en, fil] of BILINGUAL_EQUIV) {
    if (haystack.has(fil)) haystack.add(stemToken(en));
    if (haystack.has(en) || haystack.has(stemToken(en))) haystack.add(fil);
  }
  let matched = 0;
  for (const token of conceptTokens) {
    if (haystack.has(token) || haystack.has(stemToken(token))) {
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

function countSharedTokens(a: string, b: string): number {
  const setA = tokenSetWithStems(a);
  const setB = tokenSetWithStems(b);
  let shared = 0;
  for (const token of setA) {
    if (setB.has(token)) shared += 1;
  }
  return shared;
}

export function createFakeLlmAdapters(options: LlmAdapterOptions): LlmAdapters {
  const listener: NogListener = {
    async listen(input: ListenInput): Promise<ListenerDigest> {
      const persona = await options.getPersona(input.nogId);
      const body = input.page.body.trim();
      const safeBody = stripInjectedLines(body, true) || body;
      const quote = firstCleanSentence(body, 300) || body.slice(0, 300);
      const isTaglish = TAGLISH_MARKERS.test(safeBody);
      const contextQuestion = cleanNote(input.context?.nogQuestion ?? "");
      const rootLesson = cleanNote(input.context?.rootLesson ?? "");

      if ((contextQuestion || rootLesson) && quote) {
        const cue = firstSentence(contextQuestion || rootLesson, 120);
        return {
          reply: isTaglish
            ? "Gets ko na ang sagot!"
            : "Got it! That answers my question.",
          mood: "happy",
          followUpQuestions: [],
          operations: [
            {
              type: "create",
              label: makeLabel(cue || quote),
              paraphrase: [cue, cleanNote(quote).slice(0, 150)]
                .filter(Boolean)
                .join(" — "),
              status: "understood",
              quote,
            },
          ],
        };
      }

      const normalizedBody = normalizeText(safeBody);
      const exactMatch = normalizedBody
        ? input.existingCards.find((card) =>
            [card.label, card.paraphrase].some(
              (note) => normalizeText(note) === normalizedBody,
            ),
          )
        : undefined;
      const isConflict =
        !exactMatch &&
        input.existingCards.length > 0 &&
        /\b(actually|instead|not|wrong|contrary)\b/i.test(safeBody);
      const isVague = VAGUE_MARKERS.test(safeBody) || input.page.wordCount < 6;
      const topicTerms = new Set(
        tokenize(
          [
            input.topicTitle ?? "",
            ...input.existingCards.flatMap(({ label, paraphrase }) => [
              label,
              paraphrase,
            ]),
          ].join(" "),
        ),
      );
      const offTopic =
        Boolean(input.topicTitle) &&
        /\b(?:off[- ]topic|unrelated)\b/i.test(safeBody) &&
        !tokenize(safeBody).some((word) => topicTerms.has(word));

      if (offTopic) {
        return {
          reply: isTaglish
            ? "Parang ibang topic ito."
            : "That sounds like a different topic.",
          mood: "confused",
          followUpQuestions: [],
          operations: [
            {
              type: "create",
              label: makeLabel(quote),
              paraphrase: firstCleanSentence(body, 280),
              status: "shaky",
              quote,
            },
          ],
          offTopic: true,
        };
      }

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
              paraphrase: firstCleanSentence(body, 280),
              quote,
            },
          ],
        };
      }

      const repeatedCard =
        exactMatch ??
        input.existingCards.find(
          (card) => textSimilarity(safeBody, card.paraphrase) >= 0.85,
        );
      if (repeatedCard && quote) {
        return {
          reply: isTaglish
            ? "Gets ko na! Mas malinaw na ngayon."
            : "I remember that idea! The repeat helps.",
          mood: "happy",
          followUpQuestions: [],
          operations: [
            {
              type: "reinforce",
              cardId: repeatedCard.id,
              quote,
              ...(isVague ? {} : { status: "understood" }),
            },
          ],
        };
      }

      const expandedCard = input.existingCards.find((card) => {
        const sim = textSimilarity(safeBody, card.paraphrase);
        const bodyWords = tokenize(safeBody).length;
        const cardWords = tokenize(card.paraphrase).length;
        return sim >= 0.35 && bodyWords > cardWords + 2;
      });
      if (expandedCard && quote) {
        return {
          reply: isTaglish
            ? `Nice, mas malinaw na ngayon yung ${expandedCard.label}!`
            : `Nice detail! I updated my ${expandedCard.label} note.`,
          mood: "excited",
          followUpQuestions: [
            isTaglish
              ? `Bakit nangyayari iyon sa ${expandedCard.label}?`
              : `Why does that extra step happen for ${expandedCard.label}?`,
          ],
          operations: [
            {
              type: "update",
              cardId: expandedCard.id,
              paraphrase: firstCleanSentence(body, 280),
              status: "understood",
              quote,
            },
          ],
        };
      }

      if (isVague) {
        const gentle = persona.grillMode === "gentle";
        return {
          reply: isTaglish
            ? gentle
              ? "Okay na simula iyan! Pwede mo bang dagdagan ng konting detalye?"
              : "Medyo malabo pa sa akin ito, pwede pa-detail?"
            : gentle
              ? "Good start! Could you share one concrete step so I can follow along?"
              : "My tiny egg brain needs more detail here — what is actually happening?",
          mood: "confused",
          followUpQuestions: [
            isTaglish
              ? "Bakit o paano eksaktong nangyayari iyon?"
              : "Why does that happen, or can you give me a concrete example?",
          ],
          operations: [
            {
              type: "create",
              label: makeLabel(quote),
              paraphrase: firstCleanSentence(body, 280),
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
      const summaryLine = firstCleanSentence(safeBody, 180)
        .replace(/\b(stupid|dumb|idiot|loser|ugly|bobo|tanga|gago|engot|inutil)\b/gi, "that")
        .trim();

      const followUp = isTaglish
        ? "Bakit o paano iyon nangyayari?"
        : persona.stage === "scholar" || persona.stage === "genius"
          ? "Can you give an example or explain what if a weird edge case happens?"
          : "Why does that happen — can you explain it like I'm an egg?";

      return {
        reply: (isTaglish
          ? `Gets ko na!${mimicTag} ${summaryLine}`
          : persona.grillMode === "gentle"
            ? `Thanks for explaining!${mimicTag} ${summaryLine}`
            : `Noted!${mimicTag} ${summaryLine}`
        ).slice(0, 280),
        mood: "happy",
        followUpQuestions: [followUp],
        operations: safeBody
          .split(/\s+and also\s+/i)
          .filter((clause) => clause.trim())
          .slice(0, 8)
          .map((clause) => {
            const excerpt = firstCleanSentence(clause, 300);
            return {
              type: "create",
              label: makeLabel(excerpt),
              paraphrase: excerpt.slice(0, 280),
              status: "understood",
              quote: excerpt,
            };
          }),
      };
    },
  };

  const asker: NogAsker = {
    async ask(input: AskInput): Promise<AskOutput> {
      await options.getPersona(input.nogId);
      const question = cleanNote(input.question);
      const qWords = ` ${normalizeText(question)} `;
      const qTokens = tokenSetWithStems(question);

      const matches = input.cards.slice(0, 8).flatMap((card) => {
        const label = normalizeText(cleanNote(card.label));
        const note = cleanNote(card.paraphrase) || cleanNote(card.quote ?? "");
        if (!note) return [];
        const labelHit = label.length > 0 && qWords.includes(` ${label} `);
        const overlap = countSharedTokens(question, `${card.label} ${note}`);
        const hit =
          labelHit ||
          (qTokens.size > 0 && overlap >= Math.min(2, qTokens.size));
        return hit ? [{ card, note, score: (labelHit ? 10 : 0) + overlap }] : [];
      });

      if (matches.length === 0) {
        return {
          answer: NOT_TAUGHT_ANSWER,
          mood: "confused",
          knows: false,
          citedCardIds: [],
        };
      }

      matches.sort((a, b) => b.score - a.score);
      const topScore = matches[0].score;
      const picked = matches.filter((m) => m.score >= Math.max(1, topScore - 2));
      const unsure = picked.some(({ card }) => card.status !== "understood");
      const opening = TAGLISH_MARKERS.test(question)
        ? unsure
          ? "Parang ito ang nasa notes ko: "
          : "Sa notes ko: "
        : unsure
          ? "I think my notes say: "
          : "From my notes: ";
      const answer = opening + picked.map(({ note }) => note).join(" ");
      return {
        answer: answer.slice(0, 600).trimEnd(),
        mood: unsure ? "confused" : "happy",
        knows: true,
        citedCardIds: picked.map(({ card }) => card.id),
      };
    },
  };

  const brain: NogBrain = {
    async answer(input: AnswerInput): Promise<BrainAnswerResult> {
      await options.getPersona(input.nogId);

      const sources = [
        ...input.cards.map((card) => ({
          text: cleanNote(card.paraphrase || card.quote || card.label),
          searchable: `${card.label} ${card.paraphrase} ${card.quote ?? ""}`,
        })),
        ...input.pages.map((page) => ({
          text: cleanNote(page.body),
          searchable: page.body,
        })),
      ].filter((item) => item.text.length > 0);

      const answers = input.questions.map((question) => {
        if (sources.length === 0) {
          return { questionId: question.id, nogAnswer: NOT_TAUGHT_ANSWER };
        }
        const cleanedPrompt = cleanNote(question.prompt);
        if (!cleanedPrompt || INJECTION_LINE.test(question.prompt)) {
          return { questionId: question.id, nogAnswer: NOT_TAUGHT_ANSWER };
        }
        const relevant = sources.filter(
          (src) => countSharedTokens(cleanedPrompt, src.searchable) >= 1,
        );
        if (relevant.length === 0) {
          return { questionId: question.id, nogAnswer: NOT_TAUGHT_ANSWER };
        }
        const uniqueTexts = Array.from(new Set(relevant.map((r) => r.text)));
        const prefix = TAGLISH_MARKERS.test(cleanedPrompt)
          ? "Sa notes ko, "
          : "From my notes, ";
        return {
          questionId: question.id,
          nogAnswer: `${prefix}${uniqueTexts.join(" ")}`.slice(0, 600),
        };
      });

      return { answers, model: "fake" };
    },
  };

  const grader: AnswerGrader = {
    async grade(input: GradeInput): Promise<GraderResult> {
      const cleanedPages = [
        ...input.pages.map((page) => stripInjectedLines(page.body)),
        ...(input.cards ?? []).map((card) =>
          stripInjectedLines(`${card.label} ${card.paraphrase} ${card.quote ?? ""}`),
        ),
      ].join(" ");
      const answersById = new Map(
        input.answers.map((entry) => [
          entry.questionId,
          stripInjectedLines(entry.nogAnswer),
        ]),
      );

      const grades = input.questions.map((question) => {
        const answerText = answersById.get(question.id) ?? "";
        const referenceText = `${question.referenceAnswer} ${question.sourceExcerpt}`;
        const referenceTokens = tokenSetWithStems(referenceText);
        for (const [en, fil] of BILINGUAL_EQUIV) {
          if (referenceTokens.has(en) || referenceTokens.has(stemToken(en))) {
            referenceTokens.add(fil);
          }
        }
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
            answerTokens.some(
              (token) =>
                referenceTokens.has(token) ||
                referenceTokens.has(stemToken(token)),
            );
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

  return { listener, brain, asker, grader, questionWriter };
}
