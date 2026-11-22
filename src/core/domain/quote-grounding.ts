interface IndexedToken {
  norm: string;
  start: number;
  end: number;
}

const TOKEN_PATTERN =
  /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['\u2018\u2019\u02BC\-\u2010-\u2015][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*|[<>\u2039\u203A]/gu;

const FILLER_TOKENS = new Set([
  "uh",
  "uhm",
  "um",
  "umm",
  "ah",
  "eh",
  "er",
  "hmm",
  "like",
  "parang",
  "ano",
  "bale",
  "kasi",
  "ganun",
  "ganon",
  "diba",
]);

function normalizeToken(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("‹", "<")
    .replaceAll("›", ">")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");
}

function tokenizeWithoutFillers(text: string): IndexedToken[] {
  const tokens: IndexedToken[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index;
    if (start === undefined) {
      continue;
    }
    const norm = normalizeToken(raw);
    if (norm.length === 0 || FILLER_TOKENS.has(norm)) {
      continue;
    }
    tokens.push({ norm, start, end: start + raw.length });
  }
  return tokens;
}

export function groundQuote(pageBody: string, quote: string): string | null {
  if (pageBody.trim().length === 0 || quote.trim().length === 0) {
    return null;
  }

  const pageTokens = tokenizeWithoutFillers(pageBody);
  const quoteTokens = tokenizeWithoutFillers(quote);

  if (pageTokens.length === 0 || quoteTokens.length === 0) {
    return null;
  }

  const minTokens = pageTokens.length < 2 ? 1 : 2;
  if (quoteTokens.length < minTokens || quoteTokens.length > pageTokens.length) {
    return null;
  }

  const lastStart = pageTokens.length - quoteTokens.length;
  for (let i = 0; i <= lastStart; i += 1) {
    let matched = true;
    for (let j = 0; j < quoteTokens.length; j += 1) {
      if (pageTokens[i + j].norm !== quoteTokens[j].norm) {
        matched = false;
        break;
      }
    }
    if (matched) {
      const start = pageTokens[i].start;
      const end = pageTokens[i + quoteTokens.length - 1].end;
      return pageBody.slice(start, end);
    }
  }

  return null;
}
