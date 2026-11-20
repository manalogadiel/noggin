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

const PROFANITY_LIST = new Set([
  "ass",
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
  "fucked",
  "fucker",
  "fucking",
  "gaga",
  "gago",
  "hayop",
  "hinayupak",
  "inutil",
  "kantot",
  "kupal",
  "leche",
  "motherfucker",
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
  "shitty",
  "slut",
  "tanga",
  "tangina",
  "tarantado",
  "tite",
  "ulol",
  "whore",
]);

const SUBWORD_REGEX = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const CLAUSE_BREAK_END = /[,.;:!?()[\]{}"'”’—–]+$/;

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
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|edu|gov|io|ph|co|dev|app|ai)(?:\/.*)?$/i.test(cleaned)) {
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

function extractSubwords(text: string): string[] {
  const matches = text.toLowerCase().match(SUBWORD_REGEX);
  return matches ? matches.filter((word) => word.length >= 2) : [];
}

function buildBlockedSet(
  topicTerms: ReadonlyArray<string>,
  extraBlockedTerms: ReadonlyArray<string> = [],
): Set<string> {
  const blocked = new Set<string>(PROFANITY_LIST);
  for (const term of [...topicTerms, ...extraBlockedTerms]) {
    const normalizedPhrase = term.toLowerCase().trim();
    if (normalizedPhrase) {
      blocked.add(normalizedPhrase);
    }
    for (const token of extractSubwords(term)) {
      blocked.add(token);
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
  const blocked = buildBlockedSet(topicTerms, options.blockedTerms);

  const documentFrequency = new Map<string, number>();

  for (const lesson of lessons) {
    const seenInLesson = new Set<string>();
    const rawChunks = lesson.split(/\s+/).filter(Boolean);
    let previousToken: string | null = null;

    for (const rawChunk of rawChunks) {
      const endsClause = CLAUSE_BREAK_END.test(rawChunk);

      if (isPersonalInfoChunk(rawChunk)) {
        previousToken = null;
        continue;
      }

      const subwords = extractSubwords(rawChunk);
      if (subwords.length === 0) {
        previousToken = null;
        continue;
      }

      if (subwords.some((word) => blocked.has(word))) {
        previousToken = null;
        continue;
      }

      if (subwords.length > 1) {
        const joined = subwords.join(" ");
        if (blocked.has(joined)) {
          previousToken = null;
          continue;
        }
      }

      for (const word of subwords) {
        if (!STOP_WORDS.has(word)) {
          seenInLesson.add(word);
        }

        if (previousToken !== null) {
          if (!STOP_WORDS.has(previousToken) || !STOP_WORDS.has(word)) {
            const bigram = `${previousToken} ${word}`;
            if (!blocked.has(bigram)) {
              seenInLesson.add(bigram);
            }
          }
        }

        previousToken = word;
      }

      if (endsClause) {
        previousToken = null;
      }
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
