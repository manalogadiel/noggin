export interface SpeechStyleOptions {
  minLessons?: number;
  maxPhrases?: number;
  blockedTerms?: ReadonlyArray<string>;
}

export const DEFAULT_SPEECH_STYLE_MIN_LESSONS = 2;
export const DEFAULT_SPEECH_STYLE_MAX_PHRASES = 10;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
  "ang",
  "ay",
  "ito",
  "iyan",
  "iyon",
  "ka",
  "kami",
  "kayo",
  "ko",
  "may",
  "mga",
  "mo",
  "na",
  "namin",
  "natin",
  "ng",
  "ni",
  "nila",
  "nito",
  "niya",
  "pa",
  "rin",
  "sa",
  "si",
  "sila",
  "siya",
  "tayo",
]);

const PROFANITY_EXACT = new Set([
  "ass",
  "asses",
  "asshole",
  "bastard",
  "bilat",
  "bitch",
  "bobo",
  "bullshit",
  "burat",
  "crap",
  "cunt",
  "damn",
  "dick",
  "fuck",
  "gaga",
  "gago",
  "hayop",
  "hinayupak",
  "inutil",
  "kantot",
  "kupal",
  "leche",
  "pakyu",
  "peste",
  "piss",
  "puke",
  "punyeta",
  "pussy",
  "puta",
  "putang",
  "putangina",
  "shit",
  "slut",
  "tanga",
  "tangina",
  "tarantado",
  "tite",
  "ulol",
  "whore",
]);

const PROFANITY_STEMS = [
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "fuck",
  "gago",
  "hinayupak",
  "kantot",
  "kupal",
  "motherfuck",
  "pakyu",
  "punyet",
  "putang",
  "shit",
  "slut",
  "tangina",
  "tarantad",
  "whore",
];

const SUBWORD_REGEX =
  /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
const CLAUSE_BREAK_END = /[,.;:!?()[\]{}"'”’—–]+$/;
const SENTENCE_BREAK_END = /[.!?]+["'”’)\]]*$/;

const EXPLICIT_INTRO_PATTERN =
  /\b(?:my\s+name\s+is|call\s+me|ako\s+si|pangalan\s+ko\s+ay)\s+([\p{L}][\p{L}\p{M}'’-]*(?:\s+[\p{L}][\p{L}\p{M}'’-]*){0,2})/giu;
const CAPITALIZED_INTRO_PATTERN =
  /\b(?:[Ii]\s+am|[Ii]['’]m|[Ii]m|[Tt]his\s+is)\s+(\p{Lu}[\p{L}\p{M}'’-]*(?:\s+\p{Lu}[\p{L}\p{M}'’-]*){0,2})/gu;

function stripEdgePunctuation(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}@+]+|[^\p{L}\p{N}]+$/gu, "");
}

function isPersonalInfoChunk(raw: string): boolean {
  const cleaned = stripEdgePunctuation(raw).toLowerCase();
  if (!cleaned) {
    return false;
  }
  if (cleaned.includes("@")) {
    return true;
  }
  if (/^(?:https?:\/\/|www\.)/i.test(cleaned)) {
    return true;
  }
  if (
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|edu|gov|io|ph|co|dev|app|ai)(?:\/.*)?$/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  if (/\d{3,}/.test(cleaned)) {
    return true;
  }
  const digitCount = (cleaned.match(/\d/g) ?? []).length;
  if (digitCount >= 7) {
    return true;
  }
  return false;
}

function extractRawSubwords(text: string): string[] {
  const matches = text.match(SUBWORD_REGEX);
  return matches ? matches.filter((word) => word.length >= 2) : [];
}

function wordVariants(word: string): string[] {
  const lower = word.toLowerCase();
  const variants = new Set<string>([lower]);

  const withoutPossessive = lower.replace(/['’]s$/u, "").replace(/['’]$/u, "");
  if (withoutPossessive.length >= 2) {
    variants.add(withoutPossessive);
  }

  for (const base of Array.from(variants)) {
    if (base.length >= 4 && base.endsWith("ies")) {
      variants.add(`${base.slice(0, -3)}y`);
    }
    if (base.length >= 4 && base.endsWith("es")) {
      variants.add(base.slice(0, -2));
    }
    if (base.length >= 3 && base.endsWith("s")) {
      variants.add(base.slice(0, -1));
    }
    if (base.length >= 5 && base.endsWith("ing")) {
      variants.add(base.slice(0, -3));
    }
    if (base.length >= 4 && base.endsWith("ed")) {
      variants.add(base.slice(0, -2));
    }
  }

  return Array.from(variants);
}

function isProfane(word: string): boolean {
  const variants = wordVariants(word);
  for (const variant of variants) {
    if (PROFANITY_EXACT.has(variant)) {
      return true;
    }
    if (PROFANITY_STEMS.some((stem) => variant.includes(stem))) {
      return true;
    }
  }
  return false;
}

function isBlockedWord(word: string, blocked: ReadonlySet<string>): boolean {
  if (isProfane(word)) {
    return true;
  }
  for (const variant of wordVariants(word)) {
    if (blocked.has(variant)) {
      return true;
    }
  }
  return false;
}

function isTitleCaseWord(raw: string): boolean {
  return /^\p{Lu}\p{Ll}/u.test(raw);
}

function extractSelfIntroNameTokens(lessons: ReadonlyArray<string>): Set<string> {
  const names = new Set<string>();
  const patterns = [EXPLICIT_INTRO_PATTERN, CAPITALIZED_INTRO_PATTERN];
  for (const lesson of lessons) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(lesson)) !== null) {
        const candidate = match[1];
        for (const rawWord of extractRawSubwords(candidate)) {
          const lower = rawWord.toLowerCase();
          if (!STOP_WORDS.has(lower)) {
            names.add(lower);
          }
        }
      }
    }
  }
  return names;
}

function buildBlockedSet(
  topicTerms: ReadonlyArray<string>,
  extraBlockedTerms: ReadonlyArray<string> = [],
  personalNames: ReadonlySet<string> = new Set(),
): Set<string> {
  const blocked = new Set<string>(PROFANITY_EXACT);
  for (const name of personalNames) {
    blocked.add(name);
  }
  for (const term of [...topicTerms, ...extraBlockedTerms]) {
    const normalizedPhrase = term.toLowerCase().trim();
    if (normalizedPhrase) {
      blocked.add(normalizedPhrase);
    }
    for (const token of extractRawSubwords(term)) {
      for (const variant of wordVariants(token)) {
        blocked.add(variant);
      }
    }
  }
  return blocked;
}

export function extractSpeechStyle(
  lessons: ReadonlyArray<string>,
  topicTerms: ReadonlyArray<string> = [],
  options: SpeechStyleOptions = {},
): string[] {
  const minLessons = options.minLessons ?? DEFAULT_SPEECH_STYLE_MIN_LESSONS;
  const maxPhrases = options.maxPhrases ?? DEFAULT_SPEECH_STYLE_MAX_PHRASES;
  const personalNames = extractSelfIntroNameTokens(lessons);
  const blocked = buildBlockedSet(
    topicTerms,
    options.blockedTerms,
    personalNames,
  );

  const documentFrequency = new Map<string, number>();

  for (const lesson of lessons) {
    const seenInLesson = new Set<string>();
    const rawChunks = lesson.split(/\s+/).filter(Boolean);
    let previousToken: { lower: string; capitalized: boolean } | null = null;
    let atSentenceStart = true;

    for (const rawChunk of rawChunks) {
      const endsClause = CLAUSE_BREAK_END.test(rawChunk);
      const endsSentence = SENTENCE_BREAK_END.test(rawChunk);

      if (isPersonalInfoChunk(rawChunk)) {
        previousToken = null;
        atSentenceStart = endsSentence;
        continue;
      }

      const rawSubwords = extractRawSubwords(rawChunk);
      if (rawSubwords.length === 0) {
        previousToken = null;
        atSentenceStart = endsSentence;
        continue;
      }

      if (rawSubwords.some((rawWord) => isBlockedWord(rawWord, blocked))) {
        previousToken = null;
        atSentenceStart = endsSentence;
        continue;
      }

      const loweredSubwords = rawSubwords.map((rawWord) =>
        rawWord.toLowerCase(),
      );
      if (loweredSubwords.length > 1 && blocked.has(loweredSubwords.join(" "))) {
        previousToken = null;
        atSentenceStart = endsSentence;
        continue;
      }

      for (let i = 0; i < rawSubwords.length; i += 1) {
        const rawWord = rawSubwords[i];
        const lower = loweredSubwords[i];
        const capitalized = isTitleCaseWord(rawWord);
        const midSentenceProperNoun = capitalized && !(atSentenceStart && i === 0);

        if (!STOP_WORDS.has(lower) && !midSentenceProperNoun) {
          seenInLesson.add(lower);
        }

        if (previousToken !== null) {
          const bothCapitalized = previousToken.capitalized && capitalized;
          const includesProperNoun =
            bothCapitalized || midSentenceProperNoun;
          if (
            !includesProperNoun &&
            (!STOP_WORDS.has(previousToken.lower) || !STOP_WORDS.has(lower))
          ) {
            const bigram = `${previousToken.lower} ${lower}`;
            if (!blocked.has(bigram)) {
              seenInLesson.add(bigram);
            }
          }
        }

        previousToken = { lower, capitalized };
      }

      if (endsClause) {
        previousToken = null;
      }
      atSentenceStart = endsSentence;
    }

    for (const phrase of seenInLesson) {
      documentFrequency.set(phrase, (documentFrequency.get(phrase) ?? 0) + 1);
    }
  }

  return Array.from(documentFrequency.entries())
    .filter(([, count]) => count >= minLessons)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxPhrases)
    .map(([phrase]) => phrase);
}
