"use client";

import { ArrowLeft, Lightbulb, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  answerFollowUpAction,
  reviseLessonAction,
  teachLessonAction,
} from "@/app/(app)/actions/lesson-actions";
import {
  addTopicAction,
  type AddTopicActionResult,
} from "@/app/(app)/actions/topic-actions";
import { RoomRail } from "@/components/room/room-rail";
import type {
  LessonPage,
  MicMode,
  NogRecord,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import type { ReviseLessonInput } from "@/core/application/use-cases/revise-lesson";
import type { TeachLessonInput } from "@/core/application/use-cases/teach-lesson";
import {
  countWords,
  DEFAULT_LESSON_WORD_LIMIT,
  splitLesson,
} from "@/core/domain/lesson";
import { BrainMeter } from "./brain-meter";
import { LessonEditor } from "./lesson-editor";
import { LessonSaved } from "./lesson-saved";
import { type FollowUpItem, NogChat } from "./nog-chat";
import { ThoughtCardDrawer } from "./thought-card-drawer";
import { TopicPicker } from "./topic-picker";

export interface FeedViewProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  selectedTopic: TopicSummary | null;
  pages: ReadonlyArray<LessonPage>;
  thoughtCards: ReadonlyArray<ThoughtCardRecord>;
  fixingCard: ThoughtCardRecord | null;
  initialDraft: string;
  reviseLessonId: string | null;
  micMode?: MicMode;
}

type PendingRetry =
  | { mode: "teach"; payload: TeachLessonInput }
  | { mode: "revise"; payload: ReviseLessonInput };

interface SavedLessonState {
  page: LessonPage;
  replyText: string;
  followUps: FollowUpItem[];
}

let keySequence = 0;

function createIdempotencyKey(prefix: string): string {
  keySequence += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${keySequence}`;
}

function isTcpHandshakeTopic(topic: TopicSummary): boolean {
  return (
    topic.slug === "tcp-handshake" ||
    topic.title.trim().toLowerCase() === "tcp handshake"
  );
}

interface FeedWorkspaceProps {
  nog: NogRecord;
  topic: TopicSummary;
  pages: ReadonlyArray<LessonPage>;
  thoughtCards: ReadonlyArray<ThoughtCardRecord>;
  fixingCard: ThoughtCardRecord | null;
  initialDraft: string;
  reviseLessonId: string | null;
  duplicateMessage: string | null;
  micMode: MicMode;
}

function FeedWorkspace({
  nog,
  topic,
  pages,
  thoughtCards,
  fixingCard,
  initialDraft,
  reviseLessonId,
  duplicateMessage,
  micMode,
}: FeedWorkspaceProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [activeReviseLessonId, setActiveReviseLessonId] = useState<string | null>(
    reviseLessonId,
  );
  const [queuedParts, setQueuedParts] = useState<string[]>([]);
  const [splitTotalParts, setSplitTotalParts] = useState(1);
  const [splitPartIndex, setSplitPartIndex] = useState(1);

  const [isSaving, setIsSaving] = useState(false);
  const [isRetryingTopic, setIsRetryingTopic] = useState(false);
  const [topicRetryError, setTopicRetryError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const [statusBubble, setStatusBubble] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<SavedLessonState | null>(null);

  const wordCount = countWords(draft);
  const isOverloaded = wordCount > DEFAULT_LESSON_WORD_LIMIT;
  const isFirstLesson = pages.length === 0 && !fixingCard;
  const showTcpTips = isTcpHandshakeTopic(topic);
  const roomHref = `/nogs/${nog.id}`;
  const feedBaseHref = `${roomHref}/feed`;

  function handleDraftChange(nextValue: string) {
    setDraft(nextValue);
    if (pendingRetry) {
      setPendingRetry(null);
    }
    if (alertMessage) {
      setAlertMessage(null);
    }
  }

  function handleSplitLesson() {
    const parts = splitLesson(draft, DEFAULT_LESSON_WORD_LIMIT)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length <= 1) {
      return;
    }

    setDraft(parts[0]);
    setQueuedParts(parts.slice(1));
    setSplitTotalParts(parts.length);
    setSplitPartIndex(1);
    setPendingRetry(null);
    setAlertMessage(null);
    setStatusBubble(`Split into ${parts.length} parts! Feed part 1 when you're ready.`);
  }

  async function executeLessonSubmission(request: PendingRetry) {
    setIsSaving(true);
    setAlertMessage(null);

    try {
      const result =
        request.mode === "revise"
          ? await reviseLessonAction(request.payload)
          : await teachLessonAction(request.payload);

      setIsSaving(false);

      if (result.status === "unauthenticated") {
        router.push(
          `/login?next=${encodeURIComponent(`${feedBaseHref}?topic=${encodeURIComponent(topic.id)}`)}`,
        );
        return;
      }

      if (result.status === "brain_fog") {
        setPendingRetry(request);
        setStatusBubble("Brain fog 😵 — your lesson is saved. Try again?");
        return;
      }

      if (result.status === "tired_for_today") {
        setPendingRetry(null);
        setAlertMessage("Your Nog is tired for today — try again tomorrow.");
        return;
      }

      if (result.status === "overload") {
        setPendingRetry(null);
        setAlertMessage("Too many words for one bite — split your lesson first.");
        return;
      }

      if (result.status === "questions_pending") {
        setPendingRetry(null);
        setAlertMessage(
          "Your Nog's questions are still being written — tap Retry above to finish preparing this topic.",
        );
        return;
      }

      if (result.status !== "ok") {
        setPendingRetry(null);
        setAlertMessage("Couldn't save that lesson right now. Try again.");
        return;
      }

      setPendingRetry(null);

      if (queuedParts.length > 0) {
        const [nextPart, ...remaining] = queuedParts;
        setDraft(nextPart);
        setQueuedParts(remaining);
        setSplitPartIndex((current) => current + 1);
        setActiveReviseLessonId(null);
        setStatusBubble(
          result.digest.reply || "Got that part! Ready for the next chunk.",
        );
        return;
      }

      setSplitTotalParts(1);
      setSplitPartIndex(1);
      setStatusBubble(null);
      setSavedState({
        page: result.page,
        replyText:
          result.digest.reply || `Thanks for teaching me about ${topic.title}!`,
        followUps: result.digest.followUpQuestions
          .slice(0, 2)
          .map((question, index) => ({
            id: `${result.page.id}-q-${index}`,
            question,
            draft: "",
            answered: false,
            submitting: false,
            brainFogKey: null,
            error: null,
          })),
      });
    } catch {
      setIsSaving(false);
      setAlertMessage("Couldn't reach your Nog right now. Try again.");
    }
  }

  function handleFeed() {
    if (isSaving || wordCount === 0 || isOverloaded) {
      return;
    }

    const idempotencyKey = createIdempotencyKey("lesson");
    if (activeReviseLessonId) {
      void executeLessonSubmission({
        mode: "revise",
        payload: {
          nogId: nog.id,
          topicId: topic.id,
          lessonId: activeReviseLessonId,
          body: draft,
          idempotencyKey,
        },
      });
      return;
    }

    void executeLessonSubmission({
      mode: "teach",
      payload: {
        nogId: nog.id,
        topicId: topic.id,
        body: draft,
        idempotencyKey,
      },
    });
  }

  function handleRetryBrainFog() {
    if (!pendingRetry || isSaving) {
      return;
    }
    void executeLessonSubmission(pendingRetry);
  }

  async function handleRetryPendingTopic() {
    if (isRetryingTopic) {
      return;
    }

    setIsRetryingTopic(true);
    setTopicRetryError(null);

    let result: AddTopicActionResult;
    try {
      result = await addTopicAction(nog.id, topic.title);
    } catch {
      setTopicRetryError("Couldn't retry right now. Try again.");
      setIsRetryingTopic(false);
      return;
    }

    setIsRetryingTopic(false);

    if (result.status === "ok" || result.status === "already_exists") {
      router.push(
        `${feedBaseHref}?topic=${encodeURIComponent(result.topic.id)}`,
      );
      router.refresh();
      return;
    }

    if (result.status === "tired_for_today") {
      setTopicRetryError("Your Nog is tired for today — try again tomorrow.");
      return;
    }

    if (result.status === "pending") {
      setTopicRetryError("Still writing questions — try again in a moment.");
      return;
    }

    if (result.status === "unauthenticated") {
      router.push(
        `/login?next=${encodeURIComponent(`${feedBaseHref}?topic=${encodeURIComponent(topic.id)}`)}`,
      );
      return;
    }

    setTopicRetryError("Couldn't finish writing questions right now. Try again.");
  }

  function updateFollowUp(
    followUpId: string,
    updater: (item: FollowUpItem) => FollowUpItem,
  ) {
    setSavedState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        followUps: current.followUps.map((item) =>
          item.id === followUpId ? updater(item) : item,
        ),
      };
    });
  }

  function handleFollowUpDraftChange(followUpId: string, value: string) {
    updateFollowUp(followUpId, (item) => ({
      ...item,
      draft: value,
      brainFogKey: null,
      error: null,
    }));
  }

  async function submitFollowUp(followUpId: string, retryKey?: string) {
    if (!savedState) {
      return;
    }

    const target = savedState.followUps.find((item) => item.id === followUpId);
    if (!target || target.answered || target.submitting) {
      return;
    }

    const answerWords = countWords(target.draft);
    if (answerWords === 0 || answerWords > DEFAULT_LESSON_WORD_LIMIT) {
      return;
    }

    const idempotencyKey = retryKey ?? createIdempotencyKey("followup");
    updateFollowUp(followUpId, (item) => ({
      ...item,
      submitting: true,
      error: null,
    }));

    try {
      const result = await answerFollowUpAction({
        nogId: nog.id,
        topicId: topic.id,
        lessonId: savedState.page.id,
        body: target.draft,
        idempotencyKey,
      });

      if (result.status === "unauthenticated") {
        router.push(
          `/login?next=${encodeURIComponent(`${feedBaseHref}?topic=${encodeURIComponent(topic.id)}`)}`,
        );
        return;
      }

      if (result.status === "brain_fog") {
        updateFollowUp(followUpId, (item) => ({
          ...item,
          submitting: false,
          brainFogKey: idempotencyKey,
          error: "Brain fog 😵 — your answer is saved. Try again?",
        }));
        return;
      }

      if (result.status === "tired_for_today") {
        updateFollowUp(followUpId, (item) => ({
          ...item,
          submitting: false,
          brainFogKey: null,
          error: "Your Nog is tired for today — try again tomorrow.",
        }));
        return;
      }

      if (result.status === "follow_up_limit") {
        setSavedState((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            followUps: current.followUps.map((item) => ({
              ...item,
              answered: true,
              submitting: false,
              error: null,
            })),
          };
        });
        return;
      }

      if (result.status !== "ok") {
        updateFollowUp(followUpId, (item) => ({
          ...item,
          submitting: false,
          error: "Couldn't send that answer right now. Try again.",
        }));
        return;
      }

      setSavedState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          replyText: result.digest.reply || current.replyText,
          followUps: current.followUps.map((item) =>
            item.id === followUpId
              ? {
                  ...item,
                  answered: true,
                  submitting: false,
                  brainFogKey: null,
                  error: null,
                }
              : item,
          ),
        };
      });
    } catch {
      updateFollowUp(followUpId, (item) => ({
        ...item,
        submitting: false,
        error: "Couldn't send that answer right now. Try again.",
      }));
    }
  }

  function handleImprove() {
    if (!savedState) {
      return;
    }
    setDraft(savedState.page.body);
    setActiveReviseLessonId(savedState.page.id);
    setQueuedParts([]);
    setSplitTotalParts(1);
    setSplitPartIndex(1);
    setPendingRetry(null);
    setAlertMessage(null);
    setStatusBubble(`Want to polish that? Edit your lesson for ${topic.title}.`);
    setSavedState(null);
  }

  if (savedState) {
    return (
      <LessonSaved
        nog={nog}
        topic={topic}
        savedPage={savedState.page}
        replyText={savedState.replyText}
        followUps={savedState.followUps}
        onFollowUpDraftChange={handleFollowUpDraftChange}
        onSubmitFollowUp={(id) => void submitFollowUp(id)}
        onRetryFollowUp={(id) => {
          const match = savedState.followUps.find((item) => item.id === id);
          if (match?.brainFogKey) {
            void submitFollowUp(id, match.brainFogKey);
          }
        }}
        onImprove={handleImprove}
      />
    );
  }

  const bubbleText = isOverloaded
    ? "Too much! My brain is full!"
    : isSaving
      ? "Mmm… chewing on that…"
      : statusBubble ?? `Teach me about ${topic.title}!`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-col gap-5 lg:pr-14">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link
              href={roomHref}
              aria-label={`Back to ${nog.name}'s room`}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-white)] text-[var(--noggin-forest)] shadow-[0_6px_16px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>

            <h1 className="noggin-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-tight text-[var(--noggin-leaf-title)]">
              Feed
            </h1>

            <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sage)] px-4 py-1.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] [overflow-wrap:anywhere]">
              {topic.title}
            </span>
          </div>

          <Link
            href={feedBaseHref}
            className="noggin-display inline-flex min-h-11 items-center rounded-[var(--noggin-radius-pill)] border border-[var(--noggin-leaf-strong)] bg-transparent px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none"
          >
            Change topic
          </Link>
        </header>

        {duplicateMessage && (
          <p
            role="status"
            className="rounded-[20px] bg-[var(--noggin-mint-light)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-forest)]"
          >
            {duplicateMessage}
          </p>
        )}

        {topic.status === "pending" && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-[var(--noggin-meter-mid-soft)] px-4 py-3.5 text-[0.9375rem] text-[var(--noggin-meter-mid-ink)]"
          >
            <div className="flex flex-col gap-1">
              <p className="font-semibold">
                Your Nog&rsquo;s questions are being written — you can still teach it.
              </p>
              {topicRetryError && (
                <p role="alert" className="text-[0.875rem] font-medium text-[var(--noggin-danger)]">
                  {topicRetryError}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isRetryingTopic}
              onClick={() => void handleRetryPendingTopic()}
              className="noggin-display inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isRetryingTopic ? "Retrying…" : "Retry"}</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,420px)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <LessonEditor
              topic={topic}
              draft={draft}
              wordCount={wordCount}
              isOverloaded={isOverloaded}
              isSaving={isSaving}
              fixingCard={fixingCard}
              splitPartIndex={splitPartIndex}
              splitTotalParts={splitTotalParts}
              micMode={micMode}
              onDraftChange={handleDraftChange}
              onFeed={handleFeed}
              onSplit={handleSplitLesson}
            />

            <ThoughtCardDrawer
              nogName={nog.name}
              cards={thoughtCards}
              highlightedCardId={fixingCard?.id ?? null}
            />

            {isFirstLesson && (
              <section
                aria-label="Lesson guidance"
                className="rounded-[24px] border border-[var(--noggin-sage-strong)] bg-[var(--noggin-cream)] p-5 shadow-[0_10px_24px_var(--noggin-shadow)]"
              >
                <div className="flex items-center gap-2 text-[var(--noggin-forest)]">
                  <Lightbulb
                    className="h-4 w-4 shrink-0 text-[var(--noggin-leaf-strong)]"
                    aria-hidden="true"
                  />
                  <h2 className="noggin-display text-[0.9375rem] font-extrabold">
                    First lesson tips
                  </h2>
                </div>

                {showTcpTips ? (
                  <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                    <li>Start with how the client opens the connection with SYN.</li>
                    <li>Explain how the server replies with SYN-ACK and the client confirms with ACK.</li>
                    <li>Mention what both sides can do once the connection is open.</li>
                  </ul>
                ) : (
                  <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-[0.875rem] leading-relaxed text-[var(--noggin-ink)]">
                    <li>Explain the main idea in your own words, like you&rsquo;re teaching a friend.</li>
                    <li>Walk through the key steps or parts in order.</li>
                    <li>Keep it short (up to 120 words) — you can always teach more next.</li>
                  </ul>
                )}
              </section>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <BrainMeter wordCount={wordCount} />

            <NogChat
              nogName={nog.name}
              bubbleText={bubbleText}
              isDizzy={isOverloaded}
              showBrainFogRetry={Boolean(pendingRetry) && !isOverloaded}
              isRetrying={isSaving}
              onRetryBrainFog={handleRetryBrainFog}
              alertMessage={alertMessage}
            />
          </div>
        </div>
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}

export function FeedView({
  nog,
  topics,
  selectedTopic,
  pages,
  thoughtCards,
  fixingCard,
  initialDraft,
  reviseLessonId,
  micMode = "tap",
}: FeedViewProps) {
  const router = useRouter();
  const [draftTitle, setDraftTitle] = useState("");
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusAlert, setStatusAlert] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<{
    topicId: string;
    message: string;
  } | null>(null);

  const feedBaseHref = `/nogs/${nog.id}/feed`;

  async function handleSubmitTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingTopic) {
      return;
    }

    setIsSubmittingTopic(true);
    setFieldError(null);
    setStatusAlert(null);

    let result: AddTopicActionResult;
    try {
      result = await addTopicAction(nog.id, draftTitle);
    } catch {
      setStatusAlert("Brain fog — couldn't add that topic right now. Try again.");
      setIsSubmittingTopic(false);
      return;
    }

    setIsSubmittingTopic(false);

    if (result.status === "ok" || result.status === "pending") {
      setDraftTitle("");
      setDuplicateNotice(null);
      router.push(
        `${feedBaseHref}?topic=${encodeURIComponent(result.topic.id)}`,
      );
      router.refresh();
      return;
    }

    if (result.status === "already_exists") {
      setDraftTitle("");
      setDuplicateNotice({
        topicId: result.topic.id,
        message: `"${result.topic.title}" is already in your notebook — opened it for you.`,
      });
      router.push(
        `${feedBaseHref}?topic=${encodeURIComponent(result.topic.id)}`,
      );
      router.refresh();
      return;
    }

    if (result.status === "tired_for_today") {
      setStatusAlert("Your Nog is tired for today — try again tomorrow.");
      return;
    }

    if (result.status === "invalid_title") {
      setFieldError("Use 1 to 60 letters or numbers for a topic title.");
      return;
    }

    if (result.status === "unauthenticated") {
      router.push(`/login?next=${encodeURIComponent(feedBaseHref)}`);
      return;
    }

    setStatusAlert(
      result.status === "error"
        ? result.error
        : "Couldn't add that topic right now. Try again.",
    );
  }

  if (!selectedTopic) {
    return (
      <TopicPicker
        nog={nog}
        topics={topics}
        draftTitle={draftTitle}
        onDraftTitleChange={(value) => {
          setDraftTitle(value);
          if (fieldError) {
            setFieldError(null);
          }
          if (statusAlert) {
            setStatusAlert(null);
          }
        }}
        onSubmitTopic={(event) => void handleSubmitTopic(event)}
        isSubmitting={isSubmittingTopic}
        fieldError={fieldError}
        statusAlert={statusAlert}
      />
    );
  }

  const activeDuplicateMessage =
    duplicateNotice && duplicateNotice.topicId === selectedTopic.id
      ? duplicateNotice.message
      : null;

  const workspaceKey = `${selectedTopic.id}:${fixingCard?.id ?? ""}:${reviseLessonId ?? ""}`;

  return (
    <FeedWorkspace
      key={workspaceKey}
      nog={nog}
      topic={selectedTopic}
      pages={pages}
      thoughtCards={thoughtCards}
      fixingCard={fixingCard}
      initialDraft={initialDraft}
      reviseLessonId={reviseLessonId}
      duplicateMessage={activeDuplicateMessage}
      micMode={micMode}
    />
  );
}
