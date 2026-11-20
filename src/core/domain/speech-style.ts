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

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const part of text.split(/\s+/)) {
    const normalized = normalizeToken(part);
    if (normalized.length >= 2) {
      tokens.push(normalized);
    }
  }
  return tokens;
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
    for (const token of tokenize(term)) {
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
    const tokens = tokenize(lesson);
    const seenInLesson = new Set<string>();

    for (const token of tokens) {
      if (STOP_WORDS.has(token) || blocked.has(token)) {
        continue;
      }
      seenInLesson.add(token);
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const first = tokens[i];
      const second = tokens[i + 1];
      if (blocked.has(first) || blocked.has(second)) {
        continue;
      }
      if (STOP_WORDS.has(first) && STOP_WORDS.has(second)) {
        continue;
      }
      const bigram = `${first} ${second}`;
      if (blocked.has(bigram)) {
        continue;
      }
      seenInLesson.add(bigram);
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
