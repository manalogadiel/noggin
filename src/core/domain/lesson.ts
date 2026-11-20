export const DEFAULT_LESSON_WORD_LIMIT = 120;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function isLessonOverloaded(
  text: string,
  maxWords: number = DEFAULT_LESSON_WORD_LIMIT,
): boolean {
  return countWords(text) > maxWords;
}

interface Segment {
  text: string;
  trailingSpace: string;
  wordCount: number;
}

function splitLongSegmentByWords(text: string, maxWords: number): string[] {
  const parts: string[] = [];
  const tokenRegex = /\S+/g;
  let match: RegExpExecArray | null;
  let chunkStart = 0;
  let chunkEnd = 0;
  let wordsInChunk = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (wordsInChunk === 0) {
      chunkStart = match.index;
    }
    wordsInChunk += 1;
    chunkEnd = match.index + match[0].length;

    if (wordsInChunk === maxWords) {
      parts.push(text.slice(chunkStart, chunkEnd));
      wordsInChunk = 0;
    }
  }

  if (wordsInChunk > 0) {
    parts.push(text.slice(chunkStart, chunkEnd));
  }

  return parts;
}

function segmentSentences(text: string): Segment[] {
  const segments: Segment[] = [];
  const boundaryRegex = /[.!?]+["'”’)\]]*(?=\s+|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = boundaryRegex.exec(text)) !== null) {
    const sentenceEnd = match.index + match[0].length;
    const rawSentence = text.slice(cursor, sentenceEnd);

    let spaceEnd = sentenceEnd;
    while (spaceEnd < text.length && /\s/.test(text[spaceEnd])) {
      spaceEnd += 1;
    }
    const trailingSpace = text.slice(sentenceEnd, spaceEnd);

    if (rawSentence.trim().length > 0) {
      segments.push({
        text: rawSentence,
        trailingSpace,
        wordCount: countWords(rawSentence),
      });
    }
    cursor = spaceEnd;
  }

  if (cursor < text.length) {
    const remainder = text.slice(cursor);
    if (remainder.trim().length > 0) {
      segments.push({
        text: remainder,
        trailingSpace: "",
        wordCount: countWords(remainder),
      });
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
  let currentTrailingSpace = "";
  let currentWords = 0;

  const flushCurrent = () => {
    if (currentWords > 0) {
      parts.push(currentText);
      currentText = "";
      currentTrailingSpace = "";
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
      currentTrailingSpace = segment.trailingSpace;
      currentWords = segment.wordCount;
      continue;
    }

    if (currentWords + segment.wordCount <= maxWords) {
      currentText += currentTrailingSpace + segment.text;
      currentTrailingSpace = segment.trailingSpace;
      currentWords += segment.wordCount;
    } else {
      flushCurrent();
      currentText = segment.text;
      currentTrailingSpace = segment.trailingSpace;
      currentWords = segment.wordCount;
    }
  }

  flushCurrent();

  return parts.length > 0 ? parts : [draft];
}
