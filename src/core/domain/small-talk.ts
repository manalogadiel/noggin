export type SmallTalkGrillMode = "roast" | "gentle";

export type SmallTalkMood =
  | "happy"
  | "excited"
  | "proud"
  | "confused"
  | "shocked"
  | "sleepy"
  | "curious";

export interface SmallTalkContext {
  nogName: string;
  grillMode: SmallTalkGrillMode;
  vitality: number;
  happiness: number;
  topicTitle?: string | null;
}

export interface SmallTalkMatch {
  reply: string;
  mood: SmallTalkMood;
}

type SmallTalkIntent =
  | "greeting"
  | "morning"
  | "wellbeing"
  | "thanks"
  | "praise"
  | "identity"
  | "bye";

type SmallTalkLang = "en" | "fil";

interface ClassifiedSmallTalk {
  intent: SmallTalkIntent;
  lang: SmallTalkLang;
}

const MAX_SMALL_TALK_WORDS = 8;
const LOW_VITALITY_THRESHOLD = 40;
const LOW_HAPPINESS_THRESHOLD = 50;

const EXACT_PHRASES: ReadonlyMap<string, ClassifiedSmallTalk> = new Map([
  // English greetings
  ["hi", { intent: "greeting", lang: "en" }],
  ["hello", { intent: "greeting", lang: "en" }],
  ["hey", { intent: "greeting", lang: "en" }],
  ["hiya", { intent: "greeting", lang: "en" }],
  ["heya", { intent: "greeting", lang: "en" }],
  ["yo", { intent: "greeting", lang: "en" }],
  ["hi there", { intent: "greeting", lang: "en" }],
  ["hello there", { intent: "greeting", lang: "en" }],
  ["hey there", { intent: "greeting", lang: "en" }],
  ["sup", { intent: "greeting", lang: "en" }],
  ["whats up", { intent: "greeting", lang: "en" }],
  ["what s up", { intent: "greeting", lang: "en" }],
  ["good morning", { intent: "morning", lang: "en" }],
  ["good afternoon", { intent: "morning", lang: "en" }],
  ["good evening", { intent: "morning", lang: "en" }],
  ["morning", { intent: "morning", lang: "en" }],

  // Filipino / Taglish greetings
  ["magandang umaga", { intent: "morning", lang: "fil" }],
  ["magandang hapon", { intent: "morning", lang: "fil" }],
  ["magandang gabi", { intent: "morning", lang: "fil" }],
  ["uy", { intent: "greeting", lang: "fil" }],
  ["oy", { intent: "greeting", lang: "fil" }],

  // English wellbeing
  ["how are you", { intent: "wellbeing", lang: "en" }],
  ["how are you doing", { intent: "wellbeing", lang: "en" }],
  ["how r u", { intent: "wellbeing", lang: "en" }],
  ["hru", { intent: "wellbeing", lang: "en" }],
  ["hows it going", { intent: "wellbeing", lang: "en" }],
  ["how s it going", { intent: "wellbeing", lang: "en" }],
  ["you good", { intent: "wellbeing", lang: "en" }],
  ["are you okay", { intent: "wellbeing", lang: "en" }],
  ["are you ok", { intent: "wellbeing", lang: "en" }],
  ["how do you feel", { intent: "wellbeing", lang: "en" }],

  // Filipino / Taglish wellbeing
  ["kumusta", { intent: "wellbeing", lang: "fil" }],
  ["kamusta", { intent: "wellbeing", lang: "fil" }],
  ["kumusta ka", { intent: "wellbeing", lang: "fil" }],
  ["kamusta ka", { intent: "wellbeing", lang: "fil" }],
  ["kumusta ka na", { intent: "wellbeing", lang: "fil" }],
  ["kamusta ka na", { intent: "wellbeing", lang: "fil" }],
  ["musta", { intent: "wellbeing", lang: "fil" }],
  ["musta ka", { intent: "wellbeing", lang: "fil" }],
  ["ayos ka lang", { intent: "wellbeing", lang: "fil" }],
  ["ok ka lang", { intent: "wellbeing", lang: "fil" }],
  ["okay ka lang", { intent: "wellbeing", lang: "fil" }],

  // English thanks
  ["thanks", { intent: "thanks", lang: "en" }],
  ["thank you", { intent: "thanks", lang: "en" }],
  ["thank u", { intent: "thanks", lang: "en" }],
  ["thx", { intent: "thanks", lang: "en" }],
  ["ty", { intent: "thanks", lang: "en" }],
  ["tysm", { intent: "thanks", lang: "en" }],
  ["thanks a lot", { intent: "thanks", lang: "en" }],
  ["thank you so much", { intent: "thanks", lang: "en" }],

  // Filipino / Taglish thanks
  ["salamat", { intent: "thanks", lang: "fil" }],
  ["salamat po", { intent: "thanks", lang: "fil" }],
  ["maraming salamat", { intent: "thanks", lang: "fil" }],
  ["thank you po", { intent: "thanks", lang: "fil" }],
  ["ty po", { intent: "thanks", lang: "fil" }],

  // English praise
  ["good job", { intent: "praise", lang: "en" }],
  ["great job", { intent: "praise", lang: "en" }],
  ["nice job", { intent: "praise", lang: "en" }],
  ["well done", { intent: "praise", lang: "en" }],
  ["proud of you", { intent: "praise", lang: "en" }],
  ["love you", { intent: "praise", lang: "en" }],
  ["cute", { intent: "praise", lang: "en" }],
  ["youre cute", { intent: "praise", lang: "en" }],
  ["you re cute", { intent: "praise", lang: "en" }],
  ["youre smart", { intent: "praise", lang: "en" }],
  ["you re smart", { intent: "praise", lang: "en" }],

  // Filipino / Taglish praise
  ["galing", { intent: "praise", lang: "fil" }],
  ["galing mo", { intent: "praise", lang: "fil" }],
  ["ang galing", { intent: "praise", lang: "fil" }],
  ["ang galing mo", { intent: "praise", lang: "fil" }],
  ["cute mo", { intent: "praise", lang: "fil" }],

  // English identity
  ["who are you", { intent: "identity", lang: "en" }],
  ["what is your name", { intent: "identity", lang: "en" }],
  ["whats your name", { intent: "identity", lang: "en" }],
  ["what s your name", { intent: "identity", lang: "en" }],
  ["introduce yourself", { intent: "identity", lang: "en" }],

  // Filipino / Taglish identity
  ["sino ka", { intent: "identity", lang: "fil" }],
  ["ano pangalan mo", { intent: "identity", lang: "fil" }],
  ["anong pangalan mo", { intent: "identity", lang: "fil" }],
  ["pakilala ka", { intent: "identity", lang: "fil" }],

  // English bye
  ["bye", { intent: "bye", lang: "en" }],
  ["goodbye", { intent: "bye", lang: "en" }],
  ["good bye", { intent: "bye", lang: "en" }],
  ["see ya", { intent: "bye", lang: "en" }],
  ["see you", { intent: "bye", lang: "en" }],
  ["see you later", { intent: "bye", lang: "en" }],
  ["good night", { intent: "bye", lang: "en" }],
  ["goodnight", { intent: "bye", lang: "en" }],
  ["gn", { intent: "bye", lang: "en" }],

  // Filipino / Taglish bye
  ["paalam", { intent: "bye", lang: "fil" }],
  ["babye", { intent: "bye", lang: "fil" }],
  ["bye na", { intent: "bye", lang: "fil" }],
  ["ingat", { intent: "bye", lang: "fil" }],
]);

function normalizeSmallTalk(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "Nog";
}

function cleanTopic(raw?: string | null): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function replyForWellbeing(
  lang: SmallTalkLang,
  roast: boolean,
  vitality: number,
  happiness: number,
  topic: string | null,
): SmallTalkMatch {
  if (vitality < LOW_VITALITY_THRESHOLD) {
    if (lang === "fil") {
      return {
        mood: "sleepy",
        reply: roast
          ? "Antok na antok na ako — painom naman ng tubig sa Water bago ma-lowbatt yung utak ko!"
          : "Medyo pagod at antok pa ako ngayon — pwede mo ba akong bigyan ng tubig sa Water muna?",
      };
    }
    return {
      mood: "sleepy",
      reply: roast
        ? "Running on fumes over here! Toss me some Water before I yawn through our study session."
        : "I'm feeling a little sleepy right now — some Water would help me perk right back up!",
    };
  }

  if (happiness < LOW_HAPPINESS_THRESHOLD) {
    if (lang === "fil") {
      return {
        mood: "curious",
        reply: roast
          ? "Medyo malungkot ako pero gising na gising — tap mo naman ako o turuan mo na ako!"
          : "Medyo tahimik lang ako ngayon, pero gagaan agad ang loob ko kapag nag-aral na tayo.",
      };
    }
    return {
      mood: "curious",
      reply: roast
        ? "A little gloomy, honestly — give me a quick pat or hit me with a spicy lesson!"
        : "I'm feeling a bit low today, but studying together always cheers me right up.",
    };
  }

  const topicTailEn = topic ? ` about ${topic}` : "";
  const topicTailFil = topic ? ` tungkol sa ${topic}` : "";
  if (lang === "fil") {
    return {
      mood: roast ? "excited" : "happy",
      reply: roast
        ? `Ayos na ayos ako! Handa na akong kulitin ka${topicTailFil} — tara, turuan mo na ako!`
        : `Mabuti naman ako! Masaya akong kasama ka — ready na akong matuto${topicTailFil}.`,
    };
  }

  return {
    mood: roast ? "excited" : "happy",
    reply: roast
      ? `Sharp, dramatic, and totally ready${topicTailEn}! Hit me with a lesson or quiz me on what you taught.`
      : `I'm doing great! Ready whenever you want to teach or quiz me${topicTailEn}.`,
  };
}

export function matchSmallTalk(
  input: string,
  context: SmallTalkContext,
): SmallTalkMatch | null {
  if (typeof input !== "string") {
    return null;
  }

  const normalized = normalizeSmallTalk(input);
  if (normalized.length === 0) {
    return null;
  }

  const words = normalized.split(" ");
  if (words.length > MAX_SMALL_TALK_WORDS) {
    return null;
  }

  const classified = EXACT_PHRASES.get(normalized);
  if (!classified) {
    return null;
  }

  const name = cleanName(context.nogName);
  const topic = cleanTopic(context.topicTitle);
  const roast = context.grillMode === "roast";
  const vitality = Number.isFinite(context.vitality) ? context.vitality : 100;
  const happiness = Number.isFinite(context.happiness) ? context.happiness : 80;

  switch (classified.intent) {
    case "wellbeing":
      return replyForWellbeing(
        classified.lang,
        roast,
        vitality,
        happiness,
        topic,
      );

    case "greeting": {
      if (classified.lang === "fil") {
        const suffix = topic ? ` tungkol sa ${topic}` : "";
        return {
          mood: roast ? "excited" : "happy",
          reply: roast
            ? `Uy, nandiyan ka na! Ready na akong matuto${suffix} — bawal ang malabo ah!`
            : `Uy, hello! Masaya akong makita ka — tara, aral na tayo${suffix}!`,
        };
      }
      const topicLine = topic ? ` about ${topic}` : "";
      return {
        mood: roast ? "excited" : "happy",
        reply: roast
          ? `Hey! My brain is wide open${topicLine} — explain it clearly or I will totally grill you!`
          : `Hi there! I'm happy to see you — ready to study${topicLine} whenever you are.`,
      };
    }

    case "morning": {
      if (classified.lang === "fil") {
        const suffix = topic ? ` sa ${topic}` : "";
        return {
          mood: "happy",
          reply: roast
            ? `Magandang araw! Gising na yung utak ko${suffix} — simulan na natin ang lesson!`
            : `Magandang araw din sa iyo! Tara, dahan-dahan nating aralin${suffix}.`,
        };
      }
      const topicLine = topic ? ` on ${topic}` : "";
      return {
        mood: "happy",
        reply: roast
          ? `Rise and shine! Feed my brain a crisp explanation${topicLine} — no vague hand-waving today!`
          : `Good day to you! Whenever you're ready, I'd love to learn more${topicLine}.`,
      };
    }

    case "thanks": {
      if (classified.lang === "fil") {
        return {
          mood: "proud",
          reply: roast
            ? "Walang anuman! Bawi ka naman sa susunod na lesson ah!"
            : "Walang anuman po! Masaya akong natututo kasama mo.",
        };
      }
      return {
        mood: "proud",
        reply: roast
          ? "You owe me one crisp lesson in return — deal?"
          : "You're very welcome! I love learning right alongside you.",
      };
    }

    case "praise": {
      if (classified.lang === "fil") {
        return {
          mood: "proud",
          reply: roast
            ? "Siyempre naman, magaling kasi ang teacher ko — tuloy natin ito!"
            : "Salamat! Mas lalo akong ginaganahan matuto dahil sa iyo.",
        };
      }
      return {
        mood: "proud",
        reply: roast
          ? "Naturally — I only know what you taught me, so clearly we make a dangerous team!"
          : "Aww, thank you! That means a lot — let's keep learning together.",
      };
    }

    case "identity": {
      if (classified.lang === "fil") {
        return {
          mood: "proud",
          reply: roast
            ? `Ako si ${name}! Maliit lang utak ko kaya lahat ng alam ko ay galing lang talaga sa turo mo.`
            : `Ako si ${name}, ang study buddy mo! Natututo lang ako mula sa sarili mong paliwanag.`,
        };
      }
      return {
        mood: "proud",
        reply: roast
          ? `I'm ${name}! Zero outside facts in this head — I only know what you teach me, so teach wisely!`
          : `I'm ${name}, your study companion! Everything I know comes straight from the lessons you teach me.`,
      };
    }

    case "bye": {
      if (classified.lang === "fil") {
        return {
          mood: "happy",
          reply: roast
            ? "Sige, ingat ka! Babantayan ko yung notebook natin habang wala ka!"
            : "Paalam at ingat ka! Nandito lang ako kapag handa ka nang mag-aral ulit.",
        };
      }
      return {
        mood: "happy",
        reply: roast
          ? "See you soon! Don't leave my notes collecting dust for too long!"
          : "Goodbye for now! I'll keep your notes safe until we study again.",
      };
    }
  }
}
