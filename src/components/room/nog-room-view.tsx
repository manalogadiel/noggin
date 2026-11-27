"use client";

import { Check, Droplets, Mic, Pencil, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { askNogAction } from "@/app/(app)/actions/ask-actions";
import {
  answerFollowUpAction,
  reviseLessonAction,
  teachLessonAction,
} from "@/app/(app)/actions/lesson-actions";
import { addTopicAction } from "@/app/(app)/actions/topic-actions";
import { reviewCardAction } from "@/app/(app)/nogs/[id]/water/actions";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import {
  type BookCoverStyle,
  type SanctuaryTeachMode,
  useGameUi,
} from "@/components/game-ui/game-ui-context";
import { NogAvatar } from "@/components/nog/nog-avatar";
import { hasAccessoryGlb, resolveSceneGlb } from "@/components/nog-3d/model-manifest";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { usePetting } from "@/components/nog/use-petting";
import { InRoomLiveVoice } from "@/components/room/inroom-live-voice";
import {
  type InRoomChatMode,
  InRoomModeToggle,
  InRoomReplySpeaker,
  InRoomTeachFeedback,
  MOOD_LABELS,
  normalizeNogMood,
  type SanctuaryNogMood,
} from "@/components/room/inroom-teach-feedback";
import type { SaveProfileSettingsHandler } from "@/components/settings/settings-sheet";
import { IntentLink } from "@/components/shell/intent-link";
import type {
  DigestOperation,
  NogRecord,
  NogStageSlug,
  ProfileSettings,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import type { CitedCard } from "@/core/application/use-cases/ask-nog";
import {
  countWords,
  DEFAULT_LESSON_WORD_LIMIT,
  splitLesson,
} from "@/core/domain/lesson";
import { matchSmallTalk } from "@/core/domain/small-talk";
import type { VitalsResult } from "@/core/domain/vitals";
import { formatRoomRestDate, isNogResting } from "@/lib/rest-schedule";

export interface RoomViewProps {
  nog: NogRecord;
  vitals: VitalsResult;
  progress: number;
  initialSettings: ProfileSettings;
  onSaveSettings: SaveProfileSettingsHandler;
  onPet: () => Promise<void>;
  onWake?: () => Promise<unknown>;
  topics?: ReadonlyArray<TopicSummary>;
  dueCards?: ReadonlyArray<ThoughtCardRecord>;
  thoughtCards?: ReadonlyArray<ThoughtCardRecord>;
  initialTeachMode?: SanctuaryTeachMode | null;
  initialTopicId?: string | null;
  initialCardId?: string | null;
  now?: Date;
}

const STAGE_LEVEL: Record<NogStageSlug, number> = {
  hatchling: 1,
  sprout: 2,
  scholar: 3,
  genius: 4,
};

const STAGE_LABEL: Record<NogStageSlug, string> = {
  hatchling: "Hatchling",
  sprout: "Sprout",
  scholar: "Scholar",
  genius: "Genius",
};

const WORN_ACC_IMG: Record<string, string> = {
  glasses: "/game/ui/acc-glasses-worn.svg",
  beanie: "/game/ui/acc-beanie.svg",
  bow: "/game/ui/acc-bow.svg",
  gradcap: "/game/ui/acc-gradcap.svg",
};

const COVER_SWATCHES: ReadonlyArray<{
  id: BookCoverStyle;
  label: string;
  color: string;
}> = [
  { id: "sage", label: "Sage", color: "var(--ng-c-87b64c)" },
  { id: "honey", label: "Honey", color: "var(--ng-c-f5be2c)" },
  { id: "gingham", label: "Matcha", color: "var(--ng-c-a6d660)" },
  { id: "berry", label: "Berry", color: "var(--ng-c-e86058)" },
  { id: "denim", label: "Sky", color: "var(--ng-c-56b5f5)" },
  { id: "forest", label: "Forest", color: "var(--noggin-forest)" },
];

let inRoomKeySeq = 0;
function nextKey(prefix: string): string {
  inRoomKeySeq += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${inRoomKeySeq}`;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function NogRoomView({
  nog,
  vitals,
  progress,
  initialSettings,
  onPet,
  onWake,
  topics: initialTopics = [],
  dueCards: initialDueCards = [],
  thoughtCards: initialThoughtCards = [],
  initialTeachMode = null,
  initialTopicId = null,
  initialCardId = null,
  now,
}: RoomViewProps) {
  const router = useRouter();
  const { reaction, message, tapCount, pet } = usePetting({ onPet });
  const {
    state,
    activeRoom,
    openModal,
    requestPurchase,
    updateState,
    awardRewards,
    showToast,
    setSanctuary,
  } = useGameUi();

  const [fallbackNow] = useState<Date>(() => new Date());
  const [lampOn, setLampOn] = useState(false);
  const [teachMode, setTeachMode] = useState<SanctuaryTeachMode | null>(
    initialTeachMode,
  );
  const [wokeOverride, setWokeOverride] = useState(false);
  const [waking, setWaking] = useState(false);

  // In-room topics, book picker, water queue, bath queue
  const [extraTopics, setExtraTopics] = useState<TopicSummary[]>([]);
  const topics = useMemo(() => {
    const map = new Map<string, TopicSummary>();
    for (const t of initialTopics) map.set(t.id, t);
    for (const t of extraTopics) map.set(t.id, t);
    return Array.from(map.values());
  }, [initialTopics, extraTopics]);

  const [activeTopicId, setActiveTopicId] = useState<string | null>(() => {
    if (initialTopicId && initialTopics.some((t) => t.id === initialTopicId)) {
      return initialTopicId;
    }
    return initialTopics[0]?.id ?? null;
  });
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookEditMode, setBookEditMode] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [creatingBook, setCreatingBook] = useState(false);

  // In-room Feed / Ask composer state
  const [chatMode, setChatMode] = useState<InRoomChatMode>("teach");
  const [feedDraft, setFeedDraft] = useState("");
  const [feedSending, setFeedSending] = useState(false);
  const [lastUserEcho, setLastUserEcho] = useState<string | null>(null);
  const [nogTeachReply, setNogTeachReply] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<SanctuaryNogMood | null>(null);
  const [teachDoneLocal, setTeachDoneLocal] = useState(false);
  const [activeThread, setActiveThread] = useState<{
    rootLessonId: string;
    followUpQuestions: string[];
    followUpsUsed: number;
  } | null>(null);
  const [lastDigestOps, setLastDigestOps] = useState<DigestOperation[]>([]);
  const [lastOffTopic, setLastOffTopic] = useState(false);
  const [lastReplyMessageId, setLastReplyMessageId] = useState<string | null>(null);
  const [lastCitedCards, setLastCitedCards] = useState<CitedCard[]>([]);
  const [lastAskUntaught, setLastAskUntaught] = useState(false);
  const [questionsPendingNotice, setQuestionsPendingNotice] = useState<string | null>(null);
  const [pendingRetryBody, setPendingRetryBody] = useState<string | null>(null);

  // In-room Live Voice caption + speaking animation state
  const [liveCaption, setLiveCaption] = useState<string | null>(null);
  const [nogSpeaking, setNogSpeaking] = useState(false);

  // In-room Water state
  const [dueQueue, setDueQueue] = useState<ThoughtCardRecord[]>(() => [
    ...initialDueCards,
  ]);
  const [waterBusy, setWaterBusy] = useState(false);
  const [waterShowQuote, setWaterShowQuote] = useState(false);
  const [waterDoneLocal, setWaterDoneLocal] = useState(false);

  // In-room Bath state
  const bathCandidates = useMemo(
    () =>
      initialThoughtCards.filter(
        (c) => c.status === "confused" || c.status === "shaky",
      ),
    [initialThoughtCards],
  );
  const [bathIndex, setBathIndex] = useState(() => {
    if (!initialCardId) return 0;
    const idx = initialThoughtCards
      .filter((c) => c.status === "confused" || c.status === "shaky")
      .findIndex((c) => c.id === initialCardId);
    return idx >= 0 ? idx : 0;
  });
  const [fixingCard, setFixingCard] = useState<ThoughtCardRecord | null>(() => {
    if (!initialCardId) return null;
    return initialThoughtCards.find((c) => c.id === initialCardId) ?? null;
  });

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) ?? topics[0] ?? null,
    [topics, activeTopicId],
  );
  const activeBookId = activeTopic?.id ?? nog.id;
  const coverStyle =
    state.notebookCovers[activeBookId] ?? state.notebookCovers[nog.id] ?? "sage";
  const bookTitle =
    state.notebookTitles[activeBookId] ??
    activeTopic?.title ??
    state.notebookTitles[nog.id] ??
    nog.subjectName ??
    nog.name;

  const level = STAGE_LEVEL[nog.stage] ?? 1;
  const stageName = STAGE_LABEL[nog.stage] ?? "Sprout";
  const clampedProgress = clampPct(progress);
  const happyPct = clampPct(
    vitals.happiness <= 1 ? vitals.happiness * 100 : vitals.happiness,
  );
  const clarityPct = clampPct(
    vitals.clarity <= 1 ? vitals.clarity * 100 : vitals.clarity,
  );
  const vitalityPct = clampPct(
    vitals.vitality <= 1 ? vitals.vitality * 100 : vitals.vitality,
  );

  const roomBaseHref = `/nogs/${nog.id}`;
  const effectiveNow = now ?? fallbackNow;
  const restingDate =
    !wokeOverride && nog.restUntil && isNogResting(nog.restUntil, effectiveNow)
      ? formatRoomRestDate(nog.restUntil)
      : null;

  const happyDone = tapCount > 0 || happyPct >= 80;
  const wordCount = useMemo(() => countWords(feedDraft), [feedDraft]);
  const isOverloaded = wordCount > DEFAULT_LESSON_WORD_LIMIT;

  const currentDueCard = dueQueue[0] ?? null;
  const currentBathCard =
    bathCandidates[bathIndex % Math.max(1, bathCandidates.length)] ?? null;

  const handleExitTeach = useCallback(() => {
    setBookPickerOpen(false);
    setLiveCaption(null);
    setTeachMode((prev) => {
      if (prev === "live") {
        return "feed";
      }
      return null;
    });
  }, []);

  const handleOpenTeach = useCallback((mode: SanctuaryTeachMode) => {
    setBookPickerOpen(false);
    if (mode !== "live") {
      setLiveCaption(null);
    }
    setTeachMode(mode);
  }, []);

  const teachTopbarTitle = useMemo(() => {
    if (!teachMode) return undefined;
    if (teachMode === "live") return `Live Voice · ${nog.name}`;
    if (teachMode === "feed") return `Feed · ${bookTitle}`;
    if (teachMode === "water") return "Water Recall";
    if (teachMode === "bath") return "Bath · Clarify";
    return `Teach ${nog.name}`;
  }, [bookTitle, nog.name, teachMode]);

  useEffect(() => {
    setSanctuary({
      nogId: nog.id,
      nogName: nog.name,
      teachDone: clampedProgress > 0 || teachDoneLocal,
      waterDone: clarityPct >= 80 || waterDoneLocal,
      petDone: happyDone,
      teachMode,
      teachTitle: teachTopbarTitle,
      onExitTeach: handleExitTeach,
      onOpenTeach: handleOpenTeach,
    });
    return () => setSanctuary(null);
  }, [
    nog.id,
    nog.name,
    clampedProgress,
    clarityPct,
    happyDone,
    teachDoneLocal,
    waterDoneLocal,
    teachMode,
    teachTopbarTitle,
    handleExitTeach,
    handleOpenTeach,
    setSanctuary,
  ]);

  async function ensureActiveTopicId(): Promise<string | null> {
    if (activeTopic) return activeTopic.id;
    const fallbackTitle = bookTitle || nog.subjectName || `${nog.name} Notes`;
    const created = await addTopicAction(nog.id, fallbackTitle);
    if (created.status === "ok" || created.status === "pending" || created.status === "already_exists") {
      setExtraTopics((prev) => [...prev, created.topic]);
      setActiveTopicId(created.topic.id);
      return created.topic.id;
    }
    return null;
  }

  const resetTeachThread = useCallback(() => {
    setActiveThread(null);
    setFixingCard(null);
    setQuestionsPendingNotice(null);
    setPendingRetryBody(null);
  }, []);

  const handleChatModeChange = useCallback(
    (nextMode: InRoomChatMode) => {
      setChatMode(nextMode);
      resetTeachThread();
      setLastDigestOps([]);
      setLastOffTopic(false);
      setLastCitedCards([]);
      setLastAskUntaught(false);
      setLastReplyMessageId(null);
    },
    [resetTeachThread],
  );

  const handleClarifyConflict = useCallback(
    (cardId: string, label: string) => {
      const card =
        initialThoughtCards.find((c) => c.id === cardId) ??
        ({
          id: cardId,
          nogId: nog.id,
          topicId: activeTopic?.id ?? "",
          label,
          paraphrase: label,
          status: "confused",
        } as ThoughtCardRecord);
      setChatMode("teach");
      setActiveThread(null);
      setFixingCard(card);
      setNogTeachReply(`Help me clarify "${label}" in your own words!`);
    },
    [activeTopic?.id, initialThoughtCards, nog.id],
  );

  const handleSwitchTopic = useCallback(
    (nextTopicId: string) => {
      setActiveTopicId(nextTopicId);
      resetTeachThread();
      setLastDigestOps([]);
      setLastOffTopic(false);
      setLastCitedCards([]);
      setLastAskUntaught(false);
      setLastReplyMessageId(null);
    },
    [resetTeachThread],
  );

  type InRoomReplyOutcome = {
    reply: string;
    mood: SanctuaryNogMood;
    replyMessageId: string | null;
    followUpMessageIds: string[];
    followUpText: string | null;
  };

  async function sendAskText(rawText: string): Promise<InRoomReplyOutcome | null> {
    const question = rawText.trim();
    if (!question || feedSending) return null;

    setFeedSending(true);
    setLastUserEcho(question);
    setNogTeachReply("Let me check my notes…");
    setLastCitedCards([]);
    setLastAskUntaught(false);
    setLastReplyMessageId(null);

    try {
      const result = await askNogAction({
        nogId: nog.id,
        question,
        topicId: activeTopic?.id ?? null,
      });

      if (result.status === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(roomBaseHref)}`);
        return null;
      }

      if (result.status === "ok") {
        const mood = normalizeNogMood(result.mood);
        setNogTeachReply(result.answer);
        setActiveMood(mood);
        setLastReplyMessageId(result.answerMessageId);
        setLastCitedCards(result.knows ? result.citedCards : []);
        setLastAskUntaught(!result.knows);
        setFeedDraft("");
        return {
          reply: result.answer,
          mood,
          replyMessageId: result.answerMessageId,
          followUpMessageIds: [],
          followUpText: null,
        };
      }

      if (result.status === "too_long") {
        setNogTeachReply("Keep your question short and sweet (under 60 words)!");
      } else if (result.status === "tired_for_today") {
        setNogTeachReply("I'm full for today! Let's study more tomorrow.");
      } else if (result.status === "brain_fog") {
        setNogTeachReply("My brain got a little foggy — ask me again in a moment!");
      } else {
        setNogTeachReply("Hmm, I didn't quite catch that question. Try asking again!");
      }
      return null;
    } catch {
      setNogTeachReply("Brain fog! Couldn't check my notebook right now.");
      return null;
    } finally {
      setFeedSending(false);
    }
  }

  async function sendLessonText(
    rawText: string,
    allowPendingHeal = true,
  ): Promise<InRoomReplyOutcome | null> {
    if (chatMode === "ask") {
      return sendAskText(rawText);
    }

    const body = rawText.trim();
    if (!body || feedSending) return null;
    if (countWords(body) > DEFAULT_LESSON_WORD_LIMIT) {
      setNogTeachReply(
        `Whoa! Keep each chunk under ${DEFAULT_LESSON_WORD_LIMIT} words — tap Auto-Split!`,
      );
      return null;
    }

    if (!activeThread && !fixingCard) {
      const casual = matchSmallTalk(body, {
        nogName: nog.name,
        grillMode: initialSettings.grillMode,
        vitality: vitalityPct,
        happiness: happyPct,
        topicTitle: bookTitle,
      });
      if (casual) {
        const mood = normalizeNogMood(casual.mood);
        setLastUserEcho(body);
        setNogTeachReply(casual.reply);
        setActiveMood(mood);
        setLastDigestOps([]);
        setLastOffTopic(false);
        setLastReplyMessageId(null);
        setQuestionsPendingNotice(null);
        setPendingRetryBody(null);
        setFeedDraft("");
        return {
          reply: casual.reply,
          mood,
          replyMessageId: null,
          followUpMessageIds: [],
          followUpText: null,
        };
      }
    }

    setFeedSending(true);
    setLastUserEcho(body);
    setNogTeachReply("Mmm… chewing on that…");
    setQuestionsPendingNotice(null);
    setPendingRetryBody(null);

    try {
      let targetTopicId = await ensureActiveTopicId();
      if (!targetTopicId) {
        setNogTeachReply("Pick or create a notebook first so I know where to save this!");
        return null;
      }

      const submitCurrent = async (topicId: string) => {
        if (fixingCard?.sourceLessonId) {
          return reviseLessonAction({
            nogId: nog.id,
            topicId: fixingCard.topicId || topicId,
            lessonId: fixingCard.sourceLessonId,
            body,
            idempotencyKey: nextKey("inroom-revise"),
          });
        }
        if (activeThread) {
          return answerFollowUpAction({
            nogId: nog.id,
            topicId,
            lessonId: activeThread.rootLessonId,
            body,
            idempotencyKey: nextKey("inroom-followup"),
          });
        }
        return teachLessonAction({
          nogId: nog.id,
          topicId,
          body,
          idempotencyKey: nextKey("inroom-teach"),
        });
      };

      let result = await submitCurrent(targetTopicId);

      if (result.status === "questions_pending" && allowPendingHeal) {
        const titleToHeal = activeTopic?.title ?? bookTitle;
        const heal = await addTopicAction(nog.id, titleToHeal);
        if (heal.status === "ok" || heal.status === "already_exists") {
          setExtraTopics((prev) => [
            ...prev.filter((item) => item.id !== heal.topic.id),
            heal.topic,
          ]);
          targetTopicId = heal.topic.id;
          setActiveTopicId(heal.topic.id);
          result = await submitCurrent(targetTopicId);
        } else if (heal.status === "tired_for_today") {
          setNogTeachReply("I'm full for today! Let's study more tomorrow.");
          return null;
        } else {
          const notice = `Questions for ${titleToHeal} are still getting ready.`;
          setQuestionsPendingNotice(notice);
          setPendingRetryBody(body);
          setNogTeachReply(notice);
          return null;
        }
      }

      if (result.status === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(roomBaseHref)}`);
        return null;
      }

      if (result.status === "ok") {
        const followUps = result.digest.followUpQuestions ?? [];
        const firstFollowUp = followUps[0] ?? null;
        const replyLine = firstFollowUp
          ? `${result.digest.reply} ${firstFollowUp}`
          : result.digest.reply;
        const mood = normalizeNogMood(result.digest.mood);
        const replyMessageId = result.applied.replyMessageId ?? null;
        const followUpMessageIds = result.applied.followUpMessageIds ?? [];

        setNogTeachReply(replyLine);
        setActiveMood(mood);
        setLastDigestOps(result.digest.operations ?? []);
        setLastOffTopic(Boolean(result.digest.offTopic));
        setLastReplyMessageId(replyMessageId);
        setFeedDraft("");
        setFixingCard(null);
        setTeachDoneLocal(true);

        if (followUps.length > 0) {
          setActiveThread((prev) =>
            prev
              ? {
                  rootLessonId: prev.rootLessonId,
                  followUpQuestions: followUps,
                  followUpsUsed: prev.followUpsUsed + 1,
                }
              : {
                  rootLessonId: result.page.id,
                  followUpQuestions: followUps,
                  followUpsUsed: 0,
                },
          );
        } else {
          setActiveThread(null);
        }

        awardRewards(10, 15);
        showToast("Saved to Notebook! +15 EXP · +10 coins");
        router.refresh();
        return {
          reply: result.digest.reply,
          mood,
          replyMessageId,
          followUpMessageIds,
          followUpText: firstFollowUp,
        };
      }

      if (result.status === "already_taught") {
        setNogTeachReply("You already taught me this one!");
        setLastDigestOps([]);
        setLastOffTopic(false);
        setLastReplyMessageId(null);
        setFeedDraft("");
        return null;
      }

      if (result.status === "follow_up_limit") {
        setActiveThread(null);
        setNogTeachReply("That wraps up this thread! Start a fresh note whenever you're ready.");
        return null;
      }

      if (result.status === "questions_pending") {
        const notice = `Questions for ${bookTitle} are still getting ready.`;
        setQuestionsPendingNotice(notice);
        setPendingRetryBody(body);
        setNogTeachReply(notice);
        return null;
      }

      if (result.status === "overload") {
        setNogTeachReply("Whoa! My tiny brain is spinning! Keep it under 120 words.");
      } else if (result.status === "tired_for_today") {
        setNogTeachReply("I'm full for today! Let's study more tomorrow.");
      } else if (result.status === "brain_fog") {
        setNogTeachReply("Saved your note! My brain got a little foggy — try again soon.");
      } else {
        setNogTeachReply("Hmm, I couldn't catch that. Try sending it again!");
      }
      return null;
    } catch {
      setNogTeachReply("Brain fog! Couldn't save that right now — try again.");
      return null;
    } finally {
      setFeedSending(false);
    }
  }

  function handleFeedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendLessonText(feedDraft);
  }

  function handleAutoSplit() {
    const chunks = splitLesson(feedDraft, DEFAULT_LESSON_WORD_LIMIT);
    if (chunks.length > 0) {
      setFeedDraft(chunks[0]);
      showToast(`Split into ${chunks.length} chunks — ready to send part 1!`);
    }
  }

  async function handleWaterRemembered() {
    if (!currentDueCard || waterBusy) return;
    setWaterBusy(true);
    try {
      const res = await reviewCardAction({
        nogId: nog.id,
        cardId: currentDueCard.id,
        outcome: "remembered",
      });
      if (res.status === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(roomBaseHref)}`);
        return;
      }
      if (res.status === "ok") {
        setDueQueue((prev) => prev.slice(1));
        setWaterShowQuote(false);
        setWaterDoneLocal(true);
        awardRewards(0, 15);
        setNogTeachReply(`💧 Refreshed "${currentDueCard.label}"! Memory stronger!`);
        showToast("+15 EXP · Memory refreshed!");
        router.refresh();
      } else {
        showToast("Couldn't refresh right now — try again.");
      }
    } catch {
      showToast("Couldn't refresh right now — try again.");
    } finally {
      setWaterBusy(false);
    }
  }

  async function handleWaterReexplain() {
    if (!currentDueCard || waterBusy) return;
    setWaterBusy(true);
    try {
      await reviewCardAction({
        nogId: nog.id,
        cardId: currentDueCard.id,
        outcome: "forgot",
      });
    } catch {
      // proceed to feed anyway
    } finally {
      setWaterBusy(false);
    }
    setActiveTopicId(currentDueCard.topicId);
    setFixingCard(currentDueCard);
    setNogTeachReply(
      `Let's re-explain "${currentDueCard.label}" in your own words!`,
    );
    setTeachMode("feed");
  }

  function handleBathClarify() {
    if (!currentBathCard) {
      setTeachMode("feed");
      return;
    }
    setActiveTopicId(currentBathCard.topicId);
    setFixingCard(currentBathCard);
    setNogTeachReply(
      `Help me clarify "${currentBathCard.label}" in your own words!`,
    );
    setTeachMode("feed");
  }

  async function handleCreateInRoomNotebook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newBookTitle.trim();
    if (!trimmed || creatingBook) return;
    setCreatingBook(true);
    try {
      const res = await addTopicAction(nog.id, trimmed);
      if (res.status === "ok" || res.status === "pending" || res.status === "already_exists") {
        setExtraTopics((prev) => [...prev, res.topic]);
        setActiveTopicId(res.topic.id);
        setNewBookTitle("");
        setBookPickerOpen(false);
        showToast(`Switched notebook to ${res.topic.title}`);
        router.refresh();
      } else if (res.status === "invalid_title") {
        showToast("Use 1 to 60 letters or numbers.");
      } else {
        showToast("Couldn't create notebook right now.");
      }
    } finally {
      setCreatingBook(false);
    }
  }

  async function handleWakeClick() {
    if (waking) return;
    setWaking(true);
    try {
      await onWake?.();
      setWokeOverride(true);
      awardRewards(0, 10);
      showToast(`${nog.name} woke up refreshed! +10 EXP`);
    } finally {
      setWaking(false);
    }
  }

  const equippedIds = state.equippedSlots.filter((x): x is string => Boolean(x));
  const bubbleText = (() => {
    if (teachMode === "live") {
      return liveCaption ?? `Listening… explain ${bookTitle} to me!`;
    }
    if (teachMode === "feed") {
      if (chatMode === "ask") {
        if (nogTeachReply) return nogTeachReply;
        return `Ask me anything about ${bookTitle}, or just say hi!`;
      }
      if (isOverloaded) {
        return "Whoa! My tiny brain is spinning! Keep each lesson under 120 words.";
      }
      if (nogTeachReply) return nogTeachReply;
      if (fixingCard) {
        return `Help me understand "${fixingCard.label}" clearly!`;
      }
      return `I'm listening! Tell me about ${bookTitle} in your own words.`;
    }
    if (teachMode === "water") {
      return dueQueue.length > 0
        ? `💧 ${dueQueue.length} ${dueQueue.length === 1 ? "thought needs" : "thoughts need"} a quick refresh!`
        : "All my memories feel super fresh right now!";
    }
    if (teachMode === "bath") {
      return currentBathCard
        ? `Hmm, I'm a little fuzzy on "${currentBathCard.label}" — help me clear it up!`
        : "Squeaky clean! Everything I learned makes sense!";
    }
    if (teachMode === "hub") {
      return `What should we work on for ${bookTitle}?`;
    }
    if (restingDate) return `Zzz... resting until ${restingDate}`;
    if (message) return message;
    if (dueQueue.length > 0) {
      return `💧 ${dueQueue.length} ${dueQueue.length === 1 ? "note needs" : "notes need"} water!`;
    }
    return "✨ Ready to learn!";
  })();

  const isIdleBubble = !teachMode && !message;
  const editBookTopic =
    topics.find((t) => t.id === (editingBookId ?? activeTopic?.id)) ??
    activeTopic ??
    null;
  const editBookId = editBookTopic?.id ?? activeBookId;
  const editBookTitle = editBookTopic
    ? state.notebookTitles[editBookTopic.id] ?? editBookTopic.title
    : bookTitle;
  const editBookCover = state.notebookCovers[editBookId] ?? "sage";

  return (
    <div
      className={`game-world game-world--hub ${teachMode ? "is-teach-mode" : ""} ${teachMode === "live" ? "is-live-mode" : ""} ${lampOn ? "is-lamp-night" : ""}`}
      data-room-bg={activeRoom.id}
    >
      {/* Full-Bleed Centered Sanctuary Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeRoom.src}
        alt=""
        className="scene-bg-img scene-bg-img--gamestage"
      />
      <div
        className={`scene-bg-scrim ${restingDate ? "scene-bg-scrim--resting" : ""}`}
        aria-hidden="true"
      />
      <div className="room-lamp-glow" aria-hidden="true" />

      {/* Ambient Floating Sunbeam Dust Motes */}
      <div className="sunbeam-motes" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </div>

      {/* Clickable Room Props Hotspots */}
      {!teachMode && (
        <div className="room-hotspots" aria-label="Interactive room objects">
          <Link
            href={`${roomBaseHref}/notebook`}
            className="room-hotspot room-hotspot--shelf"
            title="Open Notebooks"
            aria-label="Open Notebooks from bookshelf"
          >
            <span className="room-hotspot__tip">Notebooks</span>
          </Link>
          <button
            type="button"
            onClick={() => handleOpenTeach("water")}
            className="room-hotspot room-hotspot--sprout"
            title="Water Potted Sprout"
            aria-label="Water potted sprout"
          >
            <span className="room-hotspot__tip">Water Sprout</span>
          </button>
        </div>
      )}

      {/* Teach Mode Floating 3D Notebook Trigger (Opens Blurred Choose Notebook Overlay) */}
      {teachMode && !bookPickerOpen && (
        <button
          type="button"
          onClick={() => setBookPickerOpen((v) => !v)}
          aria-expanded={bookPickerOpen}
          aria-label={`Switch active notebook (${bookTitle})`}
          className="live-book-btn live-book-btn--float"
        >
          <span className="live-book-btn__svg">
            <Book3dSvg style={coverStyle} title={bookTitle} uid={`hud-${activeBookId}`} />
          </span>
          <span className="live-book-btn__tag">{bookTitle}</span>
        </button>
      )}

      <div className="game-main-pane">
        {/* Bottom-Right 45deg Glowing Radial Wheel + Inner 3D Wedges */}
        <nav
          className={`home-arc-dock ${teachMode ? "pointer-events-none opacity-0" : ""}`}
          aria-label="Sanctuary quick actions"
        >
          <svg className="home-arc-svg" viewBox="0 0 390 390" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="home-arc-band" x1="70" y1="370" x2="370" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-fff8dd)" stopOpacity="0.88" />
                <stop offset="50%" stopColor="var(--ng-c-e3f7c2)" stopOpacity="0.92" />
                <stop offset="100%" stopColor="var(--ng-c-fff8dd)" stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id="home-arc-rim" x1="54" y1="390" x2="390" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-ffe780)" />
                <stop offset="50%" stopColor="var(--ng-c-d8ff99)" />
                <stop offset="100%" stopColor="var(--ng-c-ffe780)" />
              </linearGradient>
              <linearGradient id="wedge-quiz-g" x1="186" y1="384" x2="372" y2="270" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-ffe678)" />
                <stop offset="100%" stopColor="var(--ng-c-f2b21b)" />
              </linearGradient>
              <linearGradient id="wedge-arena-g" x1="260" y1="240" x2="386" y2="380" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--ng-c-ff997a)" />
                <stop offset="100%" stopColor="var(--ng-c-e55a47)" />
              </linearGradient>
              <filter id="home-arc-outer-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="g" />
                <feMerge>
                  <feMergeNode in="g" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="wedge-sh" x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="var(--ng-c-223608)" floodOpacity="0.28" />
              </filter>
            </defs>

            <path
              d="M 38 390 A 352 352 0 0 1 390 38"
              stroke="var(--ng-c-fff4b8)"
              strokeWidth="3"
              strokeDasharray="14 11"
              strokeLinecap="round"
              opacity="0.88"
              filter="url(#home-arc-outer-glow)"
            />
            <path
              d="M 54 390 A 336 336 0 0 1 390 54 L 390 168 A 222 222 0 0 0 168 390 Z"
              fill="url(#home-arc-band)"
              stroke="var(--ng-c-8cb956)"
              strokeWidth="2.6"
            />
            <path
              d="M 54 390 A 336 336 0 0 1 390 54"
              stroke="url(#home-arc-rim)"
              strokeWidth="3.6"
              strokeLinecap="round"
              filter="url(#home-arc-outer-glow)"
            />
            <path
              d="M 168 390 A 222 222 0 0 1 390 168"
              stroke="var(--ng-c-fffbe6)"
              strokeWidth="2"
              opacity="0.8"
            />
            <g stroke="var(--ng-c-85b54c)" strokeWidth="1.8" opacity="0.48">
              <line x1="179" y1="321" x2="70" y2="286" />
              <line x1="210" y1="259" x2="118" y2="193" />
              <line x1="259" y1="210" x2="193" y2="118" />
              <line x1="321" y1="179" x2="286" y2="70" />
            </g>
            <path
              d="M 118 193 A 336 336 0 0 1 193 118 L 259 210 A 222 222 0 0 0 210 259 Z"
              fill="rgba(255, 253, 242, 0.58)"
              stroke="var(--ng-c-f5c644)"
              strokeWidth="2.4"
            />

            {/* QUIZ Inner 3D Wedge */}
            <g className="home-puzzle-wedge home-puzzle-wedge--quiz pointer-events-none" filter="url(#wedge-sh)">
              <path d="M 380 392 L 184 392 A 206 206 0 0 1 241 253 Z" fill="var(--ng-c-c28308)" />
              <path d="M 380 384 L 184 384 A 206 206 0 0 1 241 245 Z" fill="url(#wedge-quiz-g)" />
              <path
                d="M 198 372 A 192 192 0 0 1 244 261"
                stroke="var(--ng-c-fff8cc)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.55"
                fill="none"
              />
              <g transform="translate(240, 298)">
                <path
                  d="M22 4c-8.5 0-14 2-14 2v9c0 6.5 4.2 11.4 10 13.2V34h-6c-1.8 0-3 1.3-3 3v3h26v-3c0-1.7-1.2-3-3-3h-6v-5.8c5.8-1.8 10-6.7 10-13.2V6s-5.5-2-14-2z"
                  fill="var(--ng-c-fff8d4)"
                />
                <path
                  d="M22 4c-8.5 0-14 2-14 2v9c0 6.5 4.2 11.4 10 13.2V34h4V4z"
                  fill="var(--noggin-white)"
                  opacity="0.45"
                />
                <path
                  d="M8 9H4.5C3.1 9 2 10.2 2 11.7c0 4.2 2.4 7.6 6.8 8.3l.6-3.2c-2.3-.5-3.6-2.2-3.6-4.4H8V9zM36 9h3.5c1.4 0 2.5 1.2 2.5 2.7 0 4.2-2.4 7.6-6.8 8.3l-.6-3.2c2.3-.5 3.6-2.2 3.6-4.4H36V9z"
                  fill="var(--ng-c-fff0a6)"
                />
                <rect x="11" y="34" width="22" height="6" rx="2.5" fill="var(--ng-c-9c5e00)" />
                <path
                  d="M22 10.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6 1.9-3.9z"
                  fill="var(--ng-c-f2a60f)"
                />
              </g>
              <text
                x="262"
                y="364"
                textAnchor="middle"
                fill="var(--ng-c-4f2e00)"
                fontFamily="Poppins,sans-serif"
                fontWeight="900"
                fontSize="16"
                letterSpacing="0.03em"
              >
                QUIZ
              </text>
            </g>

            {/* ARENA Inner 3D Wedge */}
            <g className="home-puzzle-wedge home-puzzle-wedge--arena pointer-events-none" filter="url(#wedge-sh)">
              <path d="M 386 386 L 247 247 A 206 206 0 0 1 386 190 Z" fill="var(--ng-c-b33526)" />
              <path d="M 386 378 L 247 239 A 206 206 0 0 1 386 182 Z" fill="url(#wedge-arena-g)" />
              <path
                d="M 262 242 A 192 192 0 0 1 374 196"
                stroke="var(--ng-c-ffd8cc)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.55"
                fill="none"
              />
              <g transform="translate(316, 232)">
                <path d="M5 28L2 11l10 7 8-12 8 12 10-7-3 17H5z" fill="var(--ng-c-ffe678)" />
                <path d="M5 28L2 11l10 7 8-12v22H5z" fill="var(--ng-c-fff5b8)" opacity="0.5" />
                <rect x="5" y="27" width="30" height="6.5" rx="3" fill="var(--ng-c-e59d14)" />
                <circle cx="20" cy="6" r="3" fill="var(--ng-c-fff7cc)" />
                <circle cx="3" cy="10.5" r="2.6" fill="var(--ng-c-fff7cc)" />
                <circle cx="37" cy="10.5" r="2.6" fill="var(--ng-c-fff7cc)" />
                <circle cx="20" cy="21" r="3.4" fill="var(--ng-c-e8584a)" />
                <circle cx="19" cy="20" r="1.2" fill="var(--noggin-white)" opacity="0.8" />
              </g>
              <text
                x="336"
                y="294"
                textAnchor="middle"
                fill="var(--noggin-white)"
                fontFamily="Poppins,sans-serif"
                fontWeight="900"
                fontSize="15"
                letterSpacing="0.03em"
              >
                ARENA
              </text>
            </g>
          </svg>

          <IntentLink
            href={`${roomBaseHref}/play`}
            aria-label="Play Quiz"
            className="ng-wedge-hit ng-wedge-hit--quiz"
          />
          <IntentLink
            href="/arena"
            aria-label="Party Arena"
            className="ng-wedge-hit ng-wedge-hit--arena"
          />

          <IntentLink
            href={`${roomBaseHref}/notebook`}
            className="home-arc-btn home-arc-btn--1"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-notebook-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Notebook</span>
          </IntentLink>
          <IntentLink
            href={`${roomBaseHref}/analysis`}
            className="home-arc-btn home-arc-btn--2"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-brainmap-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Brain Map</span>
          </IntentLink>
          <IntentLink
            href={`${roomBaseHref}/rest`}
            className="home-arc-btn home-arc-btn--3"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-rest-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Rest</span>
          </IntentLink>
          <button
            type="button"
            onClick={() => openModal({ type: "rooms" })}
            className="home-arc-btn home-arc-btn--4"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-rooms-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Rooms</span>
          </button>
          <IntentLink
            href={`${roomBaseHref}/customize`}
            className="home-arc-btn home-arc-btn--5"
          >
            <span className="home-arc-btn__ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/game/ui/icon-customize-clay.svg" alt="" />
            </span>
            <span className="home-arc-btn__lbl">Customize</span>
          </IntentLink>
        </nav>

        <div className={`gamestage-main ${teachMode ? "gamestage-main--teach" : ""}`}>
          {/* LEFT / CENTER: Living Nog Stage (Auto-Centers in Teach Mode) */}
          <section className="gamestage-left" aria-label={`${nog.name} pet stage`}>
            {!teachMode && restingDate && (
              <div className="gamestage-rest-banner" role="status">
                <span className="gamestage-rest-banner__moon" aria-hidden="true">🌙</span>
                <span>Resting · Back {restingDate}</span>
              </div>
            )}

            <div className="gamestage-carousel">
              <div className="gamestage-orbit">
                {!teachMode && (
                  <>
                    <Link
                      href={`${roomBaseHref}/notebook`}
                      className="floor-mini-book"
                      title={`Open ${bookTitle} notebook`}
                      aria-label={`Open ${bookTitle} notebook`}
                    >
                      <span className="floor-mini-book__svg">
                        <Book3dSvg style={coverStyle} title={bookTitle} uid={`flr-${activeBookId}`} />
                      </span>
                      <span className="floor-mini-book__tip">{bookTitle}</span>
                    </Link>

                    <button
                      type="button"
                      className={`floor-cozy-lamp ${lampOn ? "is-lit" : ""}`}
                      onClick={() => setLampOn((v) => !v)}
                      title="Toggle Cozy Lamp"
                      aria-label={lampOn ? "Turn off cozy lamp" : "Turn on cozy lamp"}
                    >
                      <span className="floor-cozy-lamp__glow" aria-hidden="true" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/game/ui/prop-lamp-clay.svg" alt="" className="floor-cozy-lamp__img" />
                      <span className="floor-mini-book__tip">{lampOn ? "Lamp Off" : "Cozy Lamp"}</span>
                    </button>
                  </>
                )}

                <div
                  className="gamestage-pet-wrap"
                  data-mood={activeMood ?? "happy"}
                >
                  {!bookPickerOpen && (
                    <div
                      className={`nog-bubble ${isIdleBubble ? "nog-bubble--idle" : ""}`}
                      role="status"
                      aria-live="polite"
                    >
                      <span className="nog-bubble-inner">
                        {teachMode && activeMood && (
                          <span className="nog-bubble-mood">
                            {MOOD_LABELS[activeMood]}
                          </span>
                        )}
                        <span>{bubbleText}</span>
                        {teachMode === "feed" && lastReplyMessageId && (
                          <InRoomReplySpeaker
                            messageId={lastReplyMessageId}
                            fallbackText={bubbleText}
                            voiceEnabled={initialSettings.voiceEnabled}
                            voice={state.audio.ttsVoice}
                            autoPlay={state.audio.autoSpeakReplies}
                            volume={(state.audio.voice ?? 90) / 100}
                            onSpeakingChange={setNogSpeaking}
                          />
                        )}
                      </span>
                    </div>
                  )}
                  {tapCount > 0 && (
                    <span key={`heart-${tapCount}`} className="pet-heart-pop" aria-hidden="true">
                      ♥
                    </span>
                  )}

                  {restingDate ? (
                    <div className="sanctuary-pet-btn" aria-label={`${nog.name} is resting`}>
                      <NogStage
                        scene="sleeping"
                        tint={nog.colors?.body ?? null}
                        alt={`${nog.name} sleeping peacefully`}
                        poster="/nog/sleeping-books.png"
                        width={908}
                        height={721}
                        sizes="400px"
                        className="nog-bob w-full"
                      />
                      <span className="nog-ground-shadow" aria-hidden="true" />
                    </div>
                  ) : (
                    <NogAvatar
                      variant="sanctuary"
                      name={nog.name}
                      stage={nog.stage}
                      reaction={isOverloaded ? "annoyed" : reaction}
                      message={null}
                      tapCount={tapCount}
                      onTap={pet}
                      tint={nog.colors?.body ?? null}
                      equippedAccessories={equippedIds}
                      mood={activeMood}
                      speaking={nogSpeaking}
                      roomTheme={activeRoom.id}
                    >
                      {equippedIds.map((accId) => {
                        if (resolveSceneGlb("room", nog.stage) && hasAccessoryGlb(accId)) {
                          return null;
                        }
                        const img = WORN_ACC_IMG[accId];
                        if (!img) return null;
                        return (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={accId}
                            src={img}
                            alt=""
                            aria-hidden="true"
                            className={`nog-worn-acc nog-worn-acc--${accId} nog-bob`}
                          />
                        );
                      })}
                      <span className="nog-ground-shadow" aria-hidden="true" />
                    </NogAvatar>
                  )}
                </div>
              </div>
            </div>

            {/* IDLE HOME: Wake CTA or Hero Teach Button */}
            {!teachMode && (
              <div className="gamestage-ctas">
                {restingDate ? (
                  <button
                    type="button"
                    disabled={waking}
                    onClick={handleWakeClick}
                    className="home-wake-hero-btn"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="5.5" fill="var(--ng-c-ffe678)" />
                      <path
                        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2"
                        stroke="var(--ng-c-ffe678)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Wake {nog.name}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenTeach("hub")}
                    aria-expanded={Boolean(teachMode)}
                    className="gbtn gbtn--leaf gbtn--lg home-teach-hero-btn"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/game/ui/icon-teach-clay.svg" alt="" className="home-teach-hero-ico" />
                    <span>Teach {nog.name}</span>
                  </button>
                )}
              </div>
            )}

            {/* IN-ROOM FEED: Floating AI Chat Composer + Live Voice Mic */}
            {!bookPickerOpen && teachMode === "feed" && (
              <div className="feed-inroom-wrap">
                {lastUserEcho && <div className="feed-user-echo">{lastUserEcho}</div>}
                <InRoomTeachFeedback
                  chatMode={chatMode}
                  topicTitle={bookTitle}
                  thoughtCards={initialThoughtCards}
                  followUpQuestions={activeThread?.followUpQuestions ?? []}
                  operations={lastDigestOps}
                  offTopic={lastOffTopic}
                  questionsPendingNotice={questionsPendingNotice}
                  citedCards={lastCitedCards}
                  askUntaught={lastAskUntaught}
                  onResetThread={resetTeachThread}
                  onClarifyConflict={handleClarifyConflict}
                  onRetryPending={() => {
                    if (pendingRetryBody) {
                      void sendLessonText(pendingRetryBody, true);
                    }
                  }}
                  onSwitchToTeach={() => {
                    handleChatModeChange("teach");
                    setNogTeachReply(`Teach me about ${bookTitle} in your own words!`);
                  }}
                />
                {chatMode === "teach" && isOverloaded && (
                  <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--noggin-danger-soft)] px-4 py-2 text-xs font-bold text-[var(--noggin-danger)]">
                    <span>Over 120 words — split into smaller chunks.</span>
                    <button
                      type="button"
                      onClick={handleAutoSplit}
                      className="gbtn gbtn--coral gbtn--sm"
                    >
                      Auto-Split
                    </button>
                  </div>
                )}
                <div className="inroom-chat-controls">
                  <InRoomModeToggle
                    mode={chatMode}
                    onChange={handleChatModeChange}
                    disabled={feedSending}
                  />
                </div>
                <form className="ai-chat-row" onSubmit={handleFeedSubmit}>
                  <div className="ai-chat-pill">
                    {chatMode === "teach" && (
                      <span
                        className="ai-chat-cap tnum"
                        title="Brain capacity"
                        style={
                          isOverloaded
                            ? { background: "var(--noggin-danger-soft)", color: "var(--noggin-danger)" }
                            : undefined
                        }
                      >
                        {wordCount}/{DEFAULT_LESSON_WORD_LIMIT}
                      </span>
                    )}
                    <input
                      type="text"
                      className="ai-chat-input"
                      aria-label={
                        chatMode === "ask"
                          ? `Ask ${nog.name} about ${bookTitle}`
                          : `Teach ${nog.name} about ${bookTitle}`
                      }
                      placeholder={
                        chatMode === "ask"
                          ? `Ask ${nog.name} about ${bookTitle} or say hi...`
                          : activeThread
                            ? `Answer ${nog.name}'s follow-up...`
                            : fixingCard
                              ? `Clarify "${fixingCard.label}" for ${nog.name}...`
                              : `Teach ${nog.name} about ${bookTitle}...`
                      }
                      value={feedDraft}
                      disabled={feedSending}
                      onChange={(e) => setFeedDraft(e.target.value)}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={
                        feedSending ||
                        (chatMode === "teach" && isOverloaded) ||
                        wordCount === 0
                      }
                      className="ai-chat-send disabled:opacity-50"
                      aria-label={chatMode === "ask" ? "Ask Nog" : "Send lesson"}
                    >
                      <Send className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLiveCaption(null);
                      setTeachMode("live");
                    }}
                    className="ai-live-mic-btn"
                    title="Start Live Voice Teaching"
                    aria-label="Start Live Voice Mode"
                  >
                    <Mic className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </form>
              </div>
            )}

            {/* IN-ROOM LIVE VOICE HUD */}
            {!bookPickerOpen && teachMode === "live" && (
              <InRoomLiveVoice
                nogName={nog.name}
                topicTitle={bookTitle}
                chatMode={chatMode}
                voiceEnabled={initialSettings.voiceEnabled}
                voiceName={state.audio.ttsVoice}
                voiceVolume={(state.audio.voice ?? 90) / 100}
                sending={feedSending}
                onChangeMode={handleChatModeChange}
                onSubmitTranscript={(text) => sendLessonText(text)}
                onCaptionChange={setLiveCaption}
                onSpeakingChange={setNogSpeaking}
                onExitToFeed={(feedbackMessage) => {
                  setLiveCaption(null);
                  setNogSpeaking(false);
                  if (feedbackMessage) {
                    setNogTeachReply(feedbackMessage);
                  }
                  setTeachMode("feed");
                }}
              />
            )}

            {/* IN-ROOM WATER: Compact Floating Recall Card */}
            {!bookPickerOpen && teachMode === "water" && (
              <div className="inroom-care-card">
                <div className="inroom-care-card__head">
                  <strong>Water · Refresh {bookTitle}</strong>
                  <span className="pill pill--honey tnum">{dueQueue.length} due</span>
                </div>
                {currentDueCard ? (
                  <>
                    <p className="inroom-care-card__q">
                      <strong>{currentDueCard.label}:</strong> &ldquo;{currentDueCard.paraphrase}&rdquo;
                    </p>
                    {waterShowQuote && currentDueCard.quote && (
                      <p className="m-0 rounded-[14px] bg-[var(--noggin-mint-light)] px-3 py-2 text-xs font-semibold text-[var(--noggin-forest)]">
                        Your words: &ldquo;{currentDueCard.quote}&rdquo;
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!waterShowQuote && currentDueCard.quote && (
                        <button
                          type="button"
                          onClick={() => setWaterShowQuote(true)}
                          className="gbtn gbtn--mint gbtn--sm mr-auto"
                        >
                          Show my words
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={waterBusy}
                        onClick={() => void handleWaterReexplain()}
                        className="gbtn gbtn--white gbtn--sm"
                      >
                        Re-explain
                      </button>
                      <button
                        type="button"
                        disabled={waterBusy}
                        onClick={() => void handleWaterRemembered()}
                        className="gbtn gbtn--leaf gbtn--sm"
                      >
                        {waterBusy ? "Saving…" : "Still Fresh ✓"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="inroom-care-card__q">
                    All {bookTitle} memories are fresh and hydrated!
                  </p>
                )}
              </div>
            )}

            {/* IN-ROOM BATH: Compact Floating Missed Concept Card */}
            {!bookPickerOpen && teachMode === "bath" && (
              <div className="inroom-care-card">
                <div className="inroom-care-card__head">
                  <strong>Bath · Clarify Mistake</strong>
                  <span className="pill">
                    {bathCandidates.length > 0 ? `${bathCandidates.length} to fix` : "Clean ✓"}
                  </span>
                </div>
                {currentBathCard ? (
                  <>
                    <p className="inroom-care-card__q">
                      <strong>{currentBathCard.label}</strong> — {currentBathCard.paraphrase}
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {bathCandidates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBathIndex((i) => (i + 1) % bathCandidates.length)}
                          className="gbtn gbtn--white gbtn--sm mr-auto"
                        >
                          Next ({(bathIndex % bathCandidates.length) + 1}/{bathCandidates.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleBathClarify}
                        className="gbtn gbtn--leaf gbtn--sm"
                      >
                        Clarify in Chat →
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="inroom-care-card__q">
                    Squeaky clean! No muddy concepts right now.
                  </p>
                )}
              </div>
            )}

            {/* PERSISTENT FIXED-BOTTOM TEACH MODE BAR: Feed · Water · Bath */}
            {!bookPickerOpen && teachMode && teachMode !== "live" && (
              <nav
                className={`teach-mode-bar ${teachMode !== "hub" ? "teach-mode-bar--docked" : ""}`}
                aria-label="Teach actions"
              >
                <button
                  type="button"
                  onClick={() => handleOpenTeach("feed")}
                  aria-pressed={teachMode === "feed"}
                  className={`toy-btn toy-btn--feed ${teachMode === "feed" ? "is-active" : ""}`}
                >
                  <Pencil className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
                  <span>Feed</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenTeach("water")}
                  aria-pressed={teachMode === "water"}
                  className={`toy-btn toy-btn--water ${teachMode === "water" ? "is-active" : ""}`}
                >
                  <Droplets className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
                  <span>Water</span>
                  {dueQueue.length > 0 && (
                    <span className="toy-dot tnum">{dueQueue.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenTeach("bath")}
                  aria-pressed={teachMode === "bath"}
                  className={`toy-btn toy-btn--bath ${teachMode === "bath" ? "is-active" : ""}`}
                >
                  <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
                  <span>Bath</span>
                  {bathCandidates.length > 0 && (
                    <span className="toy-dot tnum">{bathCandidates.length}</span>
                  )}
                </button>
              </nav>
            )}
          </section>

          {/* RIGHT: Organic Stats Card (Hidden Automatically in Teach Mode) */}
          {!teachMode && (
            <aside className="gamestage-right" aria-label={`${nog.name} stats and care`}>
              <div className="gamestage-card">
                <div className="gamestage-card__surface">
                  <div className="gamestage-card__head">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span className="gamestage-lvl-badge tnum">{level}</span>
                      <div style={{ minWidth: 0 }}>
                        <h1
                          style={{
                            margin: 0,
                            display: "block",
                            fontFamily: "var(--font-display)",
                            fontWeight: 800,
                            fontSize: 21,
                            lineHeight: 1.1,
                          }}
                        >
                          {nog.name}
                        </h1>
                        <span style={{ fontSize: 12, color: "var(--noggin-ink)" }}>
                          Lvl. {level} · {stageName}
                        </span>
                      </div>
                    </div>
                    <span className="streak-trophy-pill tnum" title={`${state.streakDays}-day study streak`}>
                      🏆 {state.streakDays}d
                    </span>
                  </div>

                  <div className="gamestage-bars tnum">
                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>BRAIN CAPACITY</span>
                      <div className="gamestage-meter">
                        <i
                          style={{
                            width: `${clampedProgress}%`,
                            background: "linear-gradient(90deg, var(--ng-c-93c556) 0%, var(--ng-c-5f9128) 100%)",
                          }}
                        />
                      </div>
                      <span style={{ textAlign: "right" }}>{clampedProgress}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>LEVEL {level}</span>
                      <div
                        role="progressbar"
                        aria-label={`${nog.name} level progress`}
                        aria-valuenow={clampedProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="gamestage-meter"
                      >
                        <i
                          style={{
                            width: `${clampedProgress}%`,
                            background: "linear-gradient(90deg, var(--ng-c-f7cb52) 0%, var(--noggin-leaf) 100%)",
                          }}
                        />
                      </div>
                      <span style={{ textAlign: "right" }}>{clampedProgress}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>HAPPINESS</span>
                      <div className="gamestage-meter">
                        <i style={{ width: `${happyPct}%`, background: "var(--noggin-leaf)" }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{happyPct}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>CLARITY</span>
                      <div className="gamestage-meter">
                        <i style={{ width: `${clarityPct}%`, background: "var(--ng-c-63b88c)" }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{clarityPct}%</span>
                    </div>

                    <div className="gamestage-bar-row" style={{ gridTemplateColumns: "108px 1fr 40px" }}>
                      <span>VITALITY</span>
                      <div className="gamestage-meter">
                        <i style={{ width: `${vitalityPct}%`, background: "var(--ng-c-ec8778)" }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{vitalityPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Centered Blurred Full-Screen 3D Notebook Selector Overlay */}
      {teachMode && bookPickerOpen && (
        <div
          className="live-book-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a notebook"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBookPickerOpen(false);
          }}
        >
          <div className="live-book-modal__inner">
            <div className="live-book-modal__head">
              <strong>{bookEditMode ? "Edit Notebook" : "Choose Notebook"}</strong>
              <div className="inline-flex items-center gap-2.5">
                <button
                  type="button"
                  className={`book-edit-toggle-btn ${bookEditMode ? "is-on" : ""}`}
                  aria-label="Edit notebooks"
                  aria-pressed={bookEditMode}
                  onClick={() => {
                    setBookEditMode((v) => !v);
                    if (!editingBookId && activeTopic) setEditingBookId(activeTopic.id);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="tasks-close-btn"
                  aria-label="Close notebook picker"
                  onClick={() => setBookPickerOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="live-book-modal__grid">
              {topics.map((t, idx) => {
                const tTitle = state.notebookTitles[t.id] ?? t.title;
                const tCover =
                  state.notebookCovers[t.id] ??
                  COVER_SWATCHES[idx % COVER_SWATCHES.length].id;
                const isSelected = bookEditMode
                  ? editBookId === t.id
                  : activeTopic?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (bookEditMode) {
                        setEditingBookId(t.id);
                        return;
                      }
                      handleSwitchTopic(t.id);
                      setBookPickerOpen(false);
                      showToast(`Switched notebook to ${tTitle}`);
                    }}
                    className={`live-book-float ${isSelected ? "is-active" : ""} ${bookEditMode && isSelected ? "is-editing" : ""}`}
                  >
                    <span className="live-book-float__svg">
                      <Book3dSvg style={tCover} title={tTitle} uid={`mdl-${t.id}`} />
                    </span>
                    <span className="live-book-float__name" title={tTitle}>
                      {tTitle}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  requestPurchase({
                    title: "UNLOCK NOTEBOOK SLOT",
                    itemLabel: "Extra Notebook Slot",
                    cost: 150,
                    onConfirm: () => {
                      updateState((prev) => ({
                        ...prev,
                        coins: Math.max(0, prev.coins - 150),
                      }));
                      showToast("Unlocked extra notebook slot! (-150 coins)");
                    },
                  })
                }
                className="live-book-float live-book-float--locked"
              >
                <span className="live-book-float__lock slot-glow-card tnum">
                  <span className="slot-glow-plus">+</span>
                  <span className="slot-glow-price">🪙 150</span>
                </span>
                <span className="live-book-float__name">Add Slot</span>
              </button>
            </div>

            {bookEditMode && editBookTopic ? (
              <div className="book-edit-bar">
                <div className="book-edit-title-row">
                  <input
                    className="book-edit-input"
                    type="text"
                    value={editBookTitle}
                    maxLength={30}
                    placeholder="Notebook title (max 30)"
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 30);
                      updateState((prev) => ({
                        ...prev,
                        notebookTitles: {
                          ...prev.notebookTitles,
                          [editBookTopic.id]: val,
                        },
                      }));
                    }}
                  />
                  <span className="book-edit-count tnum">
                    {editBookTitle.length}/30
                  </span>
                </div>
                <div className="live-book-modal__swatches">
                  <span>Cover:</span>
                  {COVER_SWATCHES.map((cs) => {
                    const isOn = editBookCover === cs.id;
                    return (
                      <button
                        key={cs.id}
                        type="button"
                        className={`live-book-swatch ${isOn ? "is-on" : ""}`}
                        style={{ backgroundColor: cs.color }}
                        title={cs.label}
                        aria-label={`${cs.label} cover`}
                        onClick={() => {
                          updateState((prev) => ({
                            ...prev,
                            notebookCovers: {
                              ...prev.notebookCovers,
                              [editBookId]: cs.id,
                            },
                          }));
                          showToast(`Updated ${editBookTitle} cover`);
                        }}
                      >
                        {isOn && (
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.2} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleCreateInRoomNotebook(e)}
                className="flex w-full max-w-[440px] items-center gap-2 rounded-full bg-[rgb(255_253_247_/_0.94)] p-1.5 pl-4 shadow-[0_8px_22px_rgb(18_32_6_/_0.26)]"
              >
                <input
                  type="text"
                  maxLength={60}
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="New notebook title..."
                  aria-label="New notebook title"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm font-bold text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creatingBook || !newBookTitle.trim()}
                  className="gbtn gbtn--leaf gbtn--sm shrink-0 disabled:opacity-55"
                >
                  {creatingBook ? "Adding…" : "+ Add"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
