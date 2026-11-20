export const DEFAULT_LESSON_WORD_LIMIT = 120;

const WORD_REGEX = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

const ABBREVIATIONS = new Set([
  "al",
  "approx",
  "dr",
  "eq",
  "etc",
  "fig",
  "jr",
  "mr",
  "mrs",
  "ms",
  "no",
  "prof",
  "sr",
  "st",
  "vs",
]);

export function countWords(text: string): number {
  const matches = text.match(WORD_REGEX);
  return matches ? matches.length : 0;
}

export function isLessonOverloaded(
  text: string,
  maxWords: number = DEFAULT_LESSON_WORD_LIMIT,
): boolean {
  return countWords(text) > maxWords;
}

interface Segment {
  text: string;
  wordCount: number;
}

function isAbbreviationBoundary(text: string, punctuationStart: number, punctuation: string): boolean {
  if (!punctuation.startsWith(".") || punctuation.length > 1) {
    return false;
  }

  const beforeDot = text.slice(0, punctuationStart + 1);
  if (/(?:^|[\s([{"'“‘])(?:[\p{L}]\.){2,}$/iu.test(beforeDot)) {
    return true;
  }

  const wordMatch = /([\p{L}]+)\.$/u.exec(beforeDot);
  if (wordMatch && ABBREVIATIONS.has(wordMatch[1].toLowerCase())) {
    return true;
  }

  return false;
}

function splitLongSegmentByWords(text: string, maxWords: number): string[] {
  const parts: string[] = [];
  const regex = new RegExp(WORD_REGEX.source, WORD_REGEX.flags);
  let match: RegExpExecArray | null;
  let chunkStart = 0;
  let wordsInChunk = 0;

  while ((match = regex.exec(text)) !== null) {
    wordsInChunk += 1;

    if (wordsInChunk === maxWords) {
      let splitEnd = match.index + match[0].length;
      while (splitEnd < text.length && !/[\p{L}\p{N}\s]/u.test(text[splitEnd])) {
        splitEnd += 1;
      }
      while (splitEnd < text.length && /\s/.test(text[splitEnd])) {
        splitEnd += 1;
      }
      parts.push(text.slice(chunkStart, splitEnd));
      chunkStart = splitEnd;
      wordsInChunk = 0;
      regex.lastIndex = splitEnd;
    }
  }

  if (chunkStart < text.length) {
    const remainder = text.slice(chunkStart);
    if (parts.length > 0 && countWords(remainder) === 0) {
      parts[parts.length - 1] += remainder;
    } else {
      parts.push(remainder);
    }
  }

  return parts;
}

function segmentSentences(text: string): Segment[] {
  const segments: Segment[] = [];
  const boundaryRegex = /([.!?]+)["'”’)\]]*(?=\s+|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = boundaryRegex.exec(text)) !== null) {
    if (isAbbreviationBoundary(text, match.index, match[1])) {
      continue;
    }

    const sentenceEnd = match.index + match[0].length;
    let spaceEnd = sentenceEnd;
    while (spaceEnd < text.length && /\s/.test(text[spaceEnd])) {
      spaceEnd += 1;
    }

    const rawSlice = text.slice(cursor, spaceEnd);
    const words = countWords(rawSlice);
    if (words > 0) {
      segments.push({ text: rawSlice, wordCount: words });
      cursor = spaceEnd;
    }
  }

  if (cursor < text.length) {
    const remainder = text.slice(cursor);
    const words = countWords(remainder);
    if (words > 0) {
      segments.push({ text: remainder, wordCount: words });
    } else if (segments.length > 0) {
      segments[segments.length - 1].text += remainder;
    }
  }

  return segments;
}

export function splitLesson(
  draft: string,
  maxWords: number = DEFAULT_LESSON_WORD_LIMIT,
): string[] {
  if (maxWords < 1) {
    throw new RangeError("maxWords must be at least 1");
  }

  if (countWords(draft) <= maxWords) {
    return [draft];
  }

  const segments = segmentSentences(draft);
  const parts: string[] = [];
  let currentText = "";
  let currentWords = 0;

  const flushCurrent = () => {
    if (currentWords > 0) {
      parts.push(currentText);
      currentText = "";
      currentWords = 0;
    }
  };

  for (const segment of segments) {
    if (segment.wordCount > maxWords) {
      flushCurrent();
      parts.push(...splitLongSegmentByWords(segment.text, maxWords));
      continue;
    }

    if (currentWords === 0) {
      currentText = segment.text;
      currentWords = segment.wordCount;
      continue;
    }

    if (currentWords + segment.wordCount <= maxWords) {
      currentText += segment.text;
      currentWords += segment.wordCount;
    } else {
      flushCurrent();
      currentText = segment.text;
      currentWords = segment.wordCount;
    }
  }

  flushCurrent();

  return parts.length > 0 ? parts : [draft];
}
