import { countWords } from "./lesson";

export const ASK_MAX_WORDS = 60;
export const ASK_MAX_CHARS = 400;
export const ASK_ANSWER_MAX_CHARS = 600;
export const ASK_MOOD_MAX_CHARS = 20;
export const ASK_SEARCH_LIMIT = 8;
export const ASK_MAX_PAGES = 5;
export const ASK_HISTORY_LIMIT = 20;
export const NOT_TAUGHT_ANSWER = "You haven't taught me that yet!";
export const DEFAULT_ASK_MOOD = "curious";

export type QuestionCheck =
  | { status: "ok"; question: string }
  | { status: "empty" }
  | { status: "too_long" };

export function checkQuestion(raw: string): QuestionCheck {
  const question = typeof raw === "string" ? raw.trim() : "";
  if (question.length === 0 || countWords(question) === 0) {
    return { status: "empty" };
  }
  if (question.length > ASK_MAX_CHARS || countWords(question) > ASK_MAX_WORDS) {
    return { status: "too_long" };
  }
  return { status: "ok", question };
}

export function boundAnswer(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const answer = raw.trim().slice(0, ASK_ANSWER_MAX_CHARS).trim();
  return answer.length > 0 ? answer : null;
}

export function boundMood(raw: unknown): string {
  if (typeof raw !== "string") {
    return DEFAULT_ASK_MOOD;
  }
  const mood = raw.trim();
  if (mood.length === 0 || mood.length > ASK_MOOD_MAX_CHARS) {
    return DEFAULT_ASK_MOOD;
  }
  return mood;
}

export function clampHistoryLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return ASK_HISTORY_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(raw), 1), ASK_HISTORY_LIMIT);
}
