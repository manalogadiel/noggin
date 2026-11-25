const TOKEN_PATTERN =
  /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['\u2018\u2019\u02BC\-\u2010-\u2015][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu;

const FILLER_TOKENS = new Set([
  "uh",
  "uhm",
  "um",
  "umm",
  "parang",
  "ano",
  "bale",
  "like",
]);

function normalizeToken(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010-\u2015]/g, "-");
}

export function tokenizeNormalized(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const norm = normalizeToken(match[0]);
    if (norm.length === 0 || FILLER_TOKENS.has(norm)) {
      continue;
    }
    tokens.push(norm);
  }
  return tokens;
}

export function normalizeText(text: string): string {
  return tokenizeNormalized(text).join(" ");
}

function multisetDice(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): number {
  const total = a.length + b.length;
  if (total === 0) {
    return 0;
  }

  const countsA = new Map<string, number>();
  for (const item of a) {
    countsA.set(item, (countsA.get(item) ?? 0) + 1);
  }

  const countsB = new Map<string, number>();
  for (const item of b) {
    countsB.set(item, (countsB.get(item) ?? 0) + 1);
  }

  let overlap = 0;
  for (const [key, countA] of countsA) {
    const countB = countsB.get(key);
    if (countB !== undefined) {
      overlap += Math.min(countA, countB);
    }
  }

  return (2 * overlap) / total;
}

function toBigrams(tokens: ReadonlyArray<string>): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    pairs.push(`${tokens[i]}\u0000${tokens[i + 1]}`);
  }
  return pairs;
}

export function textSimilarity(a: string, b: string): number {
  const tokensA = tokenizeNormalized(a);
  const tokensB = tokenizeNormalized(b);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  if (
    tokensA.length === tokensB.length &&
    tokensA.every((token, index) => token === tokensB[index])
  ) {
    return 1;
  }

  const unigram = multisetDice(tokensA, tokensB);
  if (tokensA.length < 2 || tokensB.length < 2) {
    return unigram;
  }

  const bigram = multisetDice(toBigrams(tokensA), toBigrams(tokensB));
  return 0.9 * unigram + 0.1 * bigram;
}
