import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  GrillMode,
  NogRecord,
  ProfileSettings,
  ThoughtCardRecord,
  TopicRecord,
} from "@/core/application/ports";
import { DEFAULT_PROFILE_SETTINGS } from "@/core/application/ports";
import { createInMemoryPorts } from "@/core/application/testing/fakes";

type SmallTalkModule = typeof import("@/core/domain/small-talk");
type AskUseCases = typeof import("@/core/application/use-cases/ask-nog");

let matchSmallTalk: SmallTalkModule["matchSmallTalk"];
let askNog: AskUseCases["askNog"];

beforeAll(async () => {
  ({ matchSmallTalk } = await import("@/core/domain/small-talk"));
  ({ askNog } = await import("@/core/application/use-cases/ask-nog"));
});

const root = resolve(__dirname, "../..");
const VALID_MOODS = ["happy", "excited", "proud", "confused", "shocked", "sleepy", "curious"];
const NOT_TAUGHT = "You haven't taught me that yet!";

type Context = Parameters<SmallTalkModule["matchSmallTalk"]>[1];

/** Vitality and happiness are on a 0-100 scale in the small-talk context. */
function context(overrides: Partial<Context> = {}): Context {
  return {
    nogName: "Pingu",
    grillMode: "roast",
    vitality: 90,
    happiness: 90,
    ...overrides,
  } as Context;
}

const ENGLISH_SMALL_TALK = ["hi", "hello", "how are you", "good morning", "thanks", "good job", "who are you", "bye"];
const FILIPINO_SMALL_TALK = ["kumusta", "kamusta ka", "salamat"];
const ALL_SMALL_TALK = [...ENGLISH_SMALL_TALK, ...FILIPINO_SMALL_TALK];

// Common Filipino function words: a Filipino/Taglish reply uses at least one, an English reply none.
const FILIPINO_WORD =
  /(?:^|[^\p{L}])(ako|ka|ko|ikaw|kita|mo|naman|lang|po|ba|ang|ng|sa|mabuti|ayos|salamat|tayo|natin|ito|yung|rin|talaga|sige|ingat)(?=$|[^\p{L}])/iu;
const SLEEPY_NUDGE = /sleep|tired|water|drink|nap|yawn|antok|tubig|inom|pagod|tulog/i;

function expectMatch(input: string, ctx: Context = context()) {
  const result = matchSmallTalk(input, ctx);
  expect(result, `expected "${input}" to be small talk`).not.toBeNull();
  if (!result) throw new Error("unreachable");
  return result;
}

describe("matchSmallTalk is pure domain logic", () => {
  it("imports nothing from outside src/core/domain/ and uses no randomness or clock", () => {
    const source = readFileSync(resolve(root, "src/core/domain/small-talk.ts"), "utf8");
    const specifiers = [
      ...source.matchAll(
        /(?:import|export)[^"'`;]*?from\s*["'`]([^"'`]+)["'`]|import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
      ),
    ].map((match) => match[1] ?? match[2] ?? match[3]);
    for (const specifier of specifiers) {
      expect(specifier, `forbidden import "${specifier}"`).toMatch(/^\.\/[^/]+$/);
    }
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(/);
  });

  it("returns the same reply and mood for the same input and context", () => {
    for (const input of ALL_SMALL_TALK) {
      expect(matchSmallTalk(input, context())).toEqual(matchSmallTalk(input, context()));
    }
  });
});

describe("matchSmallTalk recognizes casual small talk", () => {
  it.each(ALL_SMALL_TALK)("matches %j with a non-empty reply and a valid mood", (input) => {
    const result = expectMatch(input);
    expect(typeof result.reply).toBe("string");
    expect(result.reply.trim().length).toBeGreaterThan(0);
    expect(result.reply).not.toBe(NOT_TAUGHT);
    expect(VALID_MOODS).toContain(result.mood);
  });

  it.each([
    ["Hi!", "hi"],
    ["  HELLO  ", "hello"],
    ["How are you?", "how are you"],
    ["Kamusta ka?", "kamusta ka"],
    ["Good morning!!", "good morning"],
    ["Thanks.", "thanks"],
    ["Salamat!", "salamat"],
    ["Who are you?", "who are you"],
    ["Bye!", "bye"],
  ])("ignores case, spacing and punctuation for %j", (variant, plain) => {
    expect(matchSmallTalk(variant, context())).toEqual(expectMatch(plain));
  });

  it("introduces itself by the Nog's name", () => {
    expect(expectMatch("who are you", context({ nogName: "Pingu" })).reply).toContain("Pingu");
    expect(expectMatch("who are you", context({ nogName: "Bytey" })).reply).toContain("Bytey");
  });

  it.each(ALL_SMALL_TALK)("sounds different in roast and gentle mode for %j", (input) => {
    const roast = expectMatch(input, context({ grillMode: "roast" as GrillMode }));
    const gentle = expectMatch(input, context({ grillMode: "gentle" as GrillMode }));
    expect(roast.reply).not.toBe(gentle.reply);
  });

  it.each(["how are you", "kumusta", "kamusta ka"])(
    "gives a sleepy or water nudge for %j when vitality is below 40",
    (input) => {
      const tired = expectMatch(input, context({ vitality: 20 }));
      expect(tired.mood).toBe("sleepy");
      expect(tired.reply).toMatch(SLEEPY_NUDGE);

      const rested = expectMatch(input, context({ vitality: 90 }));
      expect(rested.mood).not.toBe("sleepy");
      expect(rested.reply).not.toMatch(SLEEPY_NUDGE);
    },
  );

  it("reflects happiness in its wellbeing reply", () => {
    const happy = expectMatch("how are you", context({ happiness: 95, vitality: 90 }));
    const sad = expectMatch("how are you", context({ happiness: 10, vitality: 90 }));
    expect(["happy", "excited", "proud"]).toContain(happy.mood);
    expect(sad.reply).not.toBe(happy.reply);
  });

  it("mentions the active topic in a greeting only when one is given", () => {
    const withTopic = expectMatch("hi", context({ topicTitle: "TCP handshake" }));
    expect(withTopic.reply).toContain("TCP handshake");

    const withoutTopic = expectMatch("hi", context());
    expect(withoutTopic.reply).not.toMatch(/undefined|null|\{|\}/);
  });

  it.each(ENGLISH_SMALL_TALK)("replies in English to English small talk %j", (input) => {
    for (const grillMode of ["roast", "gentle"] as const) {
      expect(expectMatch(input, context({ grillMode })).reply).not.toMatch(FILIPINO_WORD);
    }
  });

  it.each(FILIPINO_SMALL_TALK)("mirrors Filipino/Taglish for %j", (input) => {
    for (const grillMode of ["roast", "gentle"] as const) {
      expect(expectMatch(input, context({ grillMode })).reply).toMatch(FILIPINO_WORD);
    }
  });
});

describe("matchSmallTalk keeps knowledge on the zero-knowledge path", () => {
  it.each([
    ["a lesson statement", "TCP uses a three-way handshake"],
    ["a short lesson statement", "SYN comes first"],
    ["a factual question", "what is a TCP handshake?"],
    ["a short factual question", "what is DNS?"],
    ["a greeting mixed with a question", "hi, what is a TCP handshake?"],
    ["a greeting mixed with a request", "hello can you explain subnetting"],
    ["thanks mixed with a question", "thanks, but why does SYN come first?"],
    ["a wellbeing check mixed with a question", "how are you and what is UDP?"],
    ["a greeting embedded in a lesson", "the server says hi back with SYN-ACK"],
    ["more than eight words", "hi hi hi hi hi hi hi hi hi"],
    ["a long friendly message", "hello there my dear Nog how are you doing today"],
    ["the 60-word ask boundary", [...Array(59).fill("hello"), "a".repeat(46)].join(" ")],
    ["blank input", "   "],
    ["punctuation only", "???"],
  ])("returns null for %s", (_case, input) => {
    expect(matchSmallTalk(input, context())).toBeNull();
  });
});

const ownerId = "student-1";
const otherOwnerId = "student-2";
const nog: NogRecord = {
  id: "nog-1",
  ownerId,
  subjectId: "networking",
  name: "Pingu",
  stage: "hatchling",
};
const otherNog = { ...nog, id: "nog-2", ownerId: otherOwnerId };
const topic: TopicRecord = {
  id: "tcp",
  subjectId: nog.subjectId,
  ownerId: null,
  slug: "tcp-handshake",
  title: "TCP handshake",
  status: "ready",
  questionCount: 8,
};
const questionMessageId = "20000000-0000-4000-8000-000000000001";
const answerMessageId = "20000000-0000-4000-8000-000000000002";
const taughtCard: ThoughtCardRecord = {
  id: "syn",
  nogId: nog.id,
  topicId: topic.id,
  label: "SYN",
  paraphrase: "The client sends SYN first.",
  quote: "The client starts with SYN.",
  status: "understood",
  sourceLessonId: "lesson-syn",
};

function settings(grillMode: GrillMode | null): ProfileSettings | null {
  return grillMode === null ? null : { ...DEFAULT_PROFILE_SETTINGS, grillMode };
}

function fixture(grillMode: GrillMode | null = "roast") {
  const { deps: base, setUser } = createInMemoryPorts({
    userId: ownerId,
    nogs: [nog, otherNog],
    topics: [topic],
  });
  if (!base.topics) throw new Error("Expected a topic repository");
  const deps = {
    currentUser: { get: vi.fn(base.currentUser.get) },
    nogs: { findOwned: vi.fn(base.nogs.findOwned) },
    topics: { findById: vi.fn(base.topics.findById) },
    thoughtCards: {
      search: vi.fn(async (): Promise<ThoughtCardRecord[]> => [taughtCard]),
      listEvidenceLessonIds: vi.fn(async (): Promise<Array<{ cardId: string; lessonId: string }>> => []),
    },
    notebook: { findPagesByIds: vi.fn(async () => []) },
    usage: { consumeQuota: vi.fn(async () => ({ allowed: true, used: 1, cap: 15 })) },
    asker: {
      ask: vi.fn(async () => ({
        answer: taughtCard.quote ?? "",
        mood: "happy",
        knows: true,
        citedCardIds: [taughtCard.id],
      })),
    },
    askHistory: { save: vi.fn(async () => ({ questionMessageId, answerMessageId })) },
    profiles: { getSettings: vi.fn(async (): Promise<ProfileSettings | null> => settings(grillMode)) },
  };
  return { deps, setUser };
}

function expectNoAiWork(deps: ReturnType<typeof fixture>["deps"]) {
  expect(deps.thoughtCards.search).not.toHaveBeenCalled();
  expect(deps.thoughtCards.listEvidenceLessonIds).not.toHaveBeenCalled();
  expect(deps.notebook.findPagesByIds).not.toHaveBeenCalled();
  expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
  expect(deps.asker.ask).not.toHaveBeenCalled();
}

describe("askNog answers small talk without spending AI or quota", () => {
  it("returns an in-character small-talk reply and saves it for playback", async () => {
    const { deps } = fixture("roast");

    const result = await askNog(deps, { nogId: nog.id, question: "  hi!  " });

    expect(result).toEqual({
      status: "ok",
      knows: true,
      smallTalk: true,
      answer: expect.any(String),
      mood: expect.any(String),
      citedCards: [],
      answerMessageId,
    });
    if (result.status !== "ok") throw new Error("Expected ok");
    expect(result.answer.trim().length).toBeGreaterThan(0);
    expect(result.answer).not.toBe(NOT_TAUGHT);
    expect(VALID_MOODS).toContain(result.mood);
    expectNoAiWork(deps);
    expect(deps.askHistory.save).toHaveBeenCalledExactlyOnceWith({
      ownerId,
      nogId: nog.id,
      question: "hi!",
      answer: result.answer,
      mood: result.mood,
    });
  });

  it("uses the Nog's name and works for Filipino small talk", async () => {
    const { deps } = fixture("roast");

    const who = await askNog(deps, { nogId: nog.id, question: "who are you?" });
    expect(who).toMatchObject({ status: "ok", smallTalk: true });
    if (who.status !== "ok") throw new Error("Expected ok");
    expect(who.answer).toContain(nog.name);

    const kumusta = await askNog(deps, { nogId: nog.id, question: "kumusta" });
    expect(kumusta).toMatchObject({ status: "ok", smallTalk: true, citedCards: [] });
    if (kumusta.status !== "ok") throw new Error("Expected ok");
    expect(kumusta.answer).toMatch(FILIPINO_WORD);
    expectNoAiWork(deps);
  });

  it("reads the owner's grill mode, and the gentle reply differs from the roast reply", async () => {
    const roast = fixture("roast");
    const gentle = fixture("gentle");

    const roastResult = await askNog(roast.deps, { nogId: nog.id, question: "how are you" });
    const gentleResult = await askNog(gentle.deps, { nogId: nog.id, question: "how are you" });

    expect(gentle.deps.profiles.getSettings).toHaveBeenCalledWith(ownerId);
    expect(roastResult).toMatchObject({ status: "ok", smallTalk: true });
    expect(gentleResult).toMatchObject({ status: "ok", smallTalk: true });
    if (roastResult.status !== "ok" || gentleResult.status !== "ok") throw new Error("Expected ok");
    expect(gentleResult.answer).not.toBe(roastResult.answer);
  });

  it("defaults to roast mode when profiles are omitted or the owner has no saved settings", async () => {
    const roast = fixture("roast");
    const noSettings = fixture(null);
    const { profiles: _unused, ...withoutProfiles } = fixture("gentle").deps;

    const expected = await askNog(roast.deps, { nogId: nog.id, question: "how are you" });
    expect(expected).toMatchObject({ status: "ok", smallTalk: true });
    if (expected.status !== "ok") throw new Error("Expected ok");

    for (const deps of [noSettings.deps, withoutProfiles]) {
      const result = await askNog(deps, { nogId: nog.id, question: "how are you" });
      expect(result).toMatchObject({ status: "ok", smallTalk: true, answer: expected.answer });
    }
  });

  it("checks auth, ownership and topic before small talk and never reads settings for a stranger", async () => {
    const unauth = fixture();
    unauth.setUser(null);
    expect(await askNog(unauth.deps, { nogId: nog.id, question: "hi" })).toEqual({ status: "unauthenticated" });

    const foreign = fixture();
    foreign.setUser(otherOwnerId);
    expect(await askNog(foreign.deps, { nogId: nog.id, question: "hi" })).toEqual({ status: "not_found" });

    const badTopic = fixture();
    badTopic.deps.topics.findById.mockResolvedValueOnce(null);
    expect(await askNog(badTopic.deps, { nogId: nog.id, question: "hi", topicId: topic.id }))
      .toEqual({ status: "not_found" });

    for (const { deps } of [unauth, foreign, badTopic]) {
      expectNoAiWork(deps);
      expect(deps.askHistory.save).not.toHaveBeenCalled();
      expect(deps.profiles.getSettings).not.toHaveBeenCalled();
    }
  });

  it("answers small talk inside a valid topic scope", async () => {
    const { deps } = fixture();

    expect(await askNog(deps, { nogId: nog.id, question: "thanks", topicId: topic.id }))
      .toMatchObject({ status: "ok", knows: true, smallTalk: true, citedCards: [], answerMessageId });
    expect(deps.topics.findById).toHaveBeenCalledExactlyOnceWith(topic.id);
    expectNoAiWork(deps);
  });

  it("keeps the empty-question check ahead of small talk", async () => {
    const { deps } = fixture();

    expect(await askNog(deps, { nogId: nog.id, question: "   " })).toEqual({ status: "empty" });
    expectNoAiWork(deps);
    expect(deps.askHistory.save).not.toHaveBeenCalled();
  });
});

describe("askNog keeps knowledge questions on the zero-knowledge path", () => {
  it.each([
    "hi, what is a TCP handshake?",
    "Which flag starts the handshake?",
    "thanks, but why does SYN come first?",
  ])("searches taught cards and spends quota for %j", async (question) => {
    const { deps } = fixture();

    const result = await askNog(deps, { nogId: nog.id, question });

    expect(result).toMatchObject({ status: "ok", knows: true, citedCards: [{ id: taughtCard.id }] });
    expect(result).not.toHaveProperty("smallTalk", true);
    expect(deps.thoughtCards.search).toHaveBeenCalledExactlyOnceWith(nog.id, null, question, 8);
    expect(deps.usage.consumeQuota).toHaveBeenCalledExactlyOnceWith(ownerId, "ask", 1);
    expect(deps.asker.ask).toHaveBeenCalledOnce();
  });

  it("still admits not knowing an untaught question without a small-talk flag", async () => {
    const { deps } = fixture();
    deps.thoughtCards.search.mockResolvedValueOnce([]);

    const result = await askNog(deps, { nogId: nog.id, question: "what is DNS?" });

    expect(result).toMatchObject({ status: "ok", knows: false, answer: NOT_TAUGHT, citedCards: [] });
    expect(result).not.toHaveProperty("smallTalk", true);
  });
});

describe("container wiring", () => {
  it("passes the profile repository into askNog", () => {
    const source = readFileSync(resolve(root, "src/composition/container.ts"), "utf8");
    const block = source.match(
      /askNog:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?return\s+askNog\(\s*\{([\s\S]*?)\},\s*input/,
    );
    expect(block, "askNog wiring block not found").not.toBeNull();
    expect(block?.[1]).toMatch(/\bprofiles\s*:\s*\w+/);
  });
});
