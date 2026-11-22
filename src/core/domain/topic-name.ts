export const MIN_SUBJECT_NAME_LENGTH = 1;
export const MAX_SUBJECT_NAME_LENGTH = 40;
export const MIN_TOPIC_NAME_LENGTH = 1;
export const MAX_TOPIC_NAME_LENGTH = 60;

export type TopicNameRejectionReason =
  | "empty"
  | "too_long"
  | "blocked"
  | "invalid";

export type TopicNameValidationResult =
  | { ok: true; value: string; slug: string }
  | { ok: false; reason: TopicNameRejectionReason };

const CONTROL_CHARS_PATTERN =
  /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu;

const WORD_TOKEN_PATTERN =
  /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;

const BLOCKED_EXACT = new Set([
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

const BLOCKED_STEMS = [
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

function containsBlockedWord(text: string): boolean {
  const tokens = text.match(WORD_TOKEN_PATTERN);
  if (!tokens) {
    return false;
  }

  for (const token of tokens) {
    for (const variant of wordVariants(token)) {
      if (BLOCKED_EXACT.has(variant)) {
        return true;
      }
      if (BLOCKED_STEMS.some((stem) => variant.includes(stem))) {
        return true;
      }
    }
  }

  return false;
}

function fnv1aHex(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function slugifyCatalogName(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (ascii.length > 0) {
    return ascii.slice(0, 100).replace(/-+$/g, "");
  }

  const trimmed = value.trim().toLowerCase();
  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return "";
  }

  return `u-${fnv1aHex(trimmed)}`;
}

function validateCatalogName(
  raw: string,
  minLength: number,
  maxLength: number,
): TopicNameValidationResult {
  const normalized = raw.replace(CONTROL_CHARS_PATTERN, "").trim();

  if (normalized.length < minLength) {
    return { ok: false, reason: "empty" };
  }

  if (normalized.length > maxLength) {
    return { ok: false, reason: "too_long" };
  }

  if (containsBlockedWord(normalized)) {
    return { ok: false, reason: "blocked" };
  }

  const slug = slugifyCatalogName(normalized);
  if (slug.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, value: normalized, slug };
}

export function validateSubjectName(value: string): TopicNameValidationResult {
  return validateCatalogName(
    value,
    MIN_SUBJECT_NAME_LENGTH,
    MAX_SUBJECT_NAME_LENGTH,
  );
}

export function validateTopicName(value: string): TopicNameValidationResult {
  return validateCatalogName(
    value,
    MIN_TOPIC_NAME_LENGTH,
    MAX_TOPIC_NAME_LENGTH,
  );
}
