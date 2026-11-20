import { describe, expect, it } from "vitest";
import { cardFreshness } from "../thought-card";

const nextReviewAt = new Date("2026-01-01T00:00:00.000Z");
const dayInMs = 24 * 60 * 60 * 1000;

describe("cardFreshness uses the review date, the tripled interval, and the 60-day limit", () => {
  it.each([
    { daysOverdue: -1, intervalDays: 7, expected: "fresh" },
    { daysOverdue: 1, intervalDays: 7, expected: "dusty" },
    { daysOverdue: 21, intervalDays: 7, expected: "dusty" },
    { daysOverdue: 22, intervalDays: 7, expected: "forgotten" },
    { daysOverdue: 59, intervalDays: 30, expected: "dusty" },
    { daysOverdue: 60, intervalDays: 30, expected: "forgotten" },
  ])("is $expected at $daysOverdue days overdue with a $intervalDays-day interval", ({ daysOverdue, intervalDays, expected }) => {
    const now = new Date(nextReviewAt.getTime() + daysOverdue * dayInMs);

    expect(cardFreshness({ nextReviewAt, intervalDays }, now)).toBe(expected);
  });
});
