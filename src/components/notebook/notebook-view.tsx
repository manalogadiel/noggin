"use client";

import { BookOpen, CheckCircle2, Plus, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addTopicAction,
  type AddTopicActionResult,
} from "@/app/(app)/actions/topic-actions";
import { RoomRail } from "@/components/room/room-rail";
import type {
  LessonPage,
  NogRecord,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import { LessonCard } from "./lesson-card";
import { TopicSidebar } from "./topic-sidebar";
import { TopicThoughtCards } from "./topic-thought-cards";

export interface NotebookViewProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  selectedTopic: TopicSummary | null;
  pages: ReadonlyArray<LessonPage>;
  thoughtCards: ReadonlyArray<ThoughtCardRecord>;
}

export function NotebookView({
  nog,
  topics,
  selectedTopic,
  pages,
  thoughtCards,
}: NotebookViewProps) {
  const router = useRouter();
  const pendingReasonId = useId();
  const newTopicInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [extraTopics, setExtraTopics] = useState<TopicSummary[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [draftTitle, setDraftTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [statusAlert, setStatusAlert] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<{
    topicId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isAddOpen && focusTick > 0) {
      newTopicInputRef.current?.focus();
    }
  }, [isAddOpen, focusTick]);

  const visibleTopics = useMemo(() => {
    const byId = new Map<string, TopicSummary>();
    for (const topic of topics) {
      byId.set(topic.id, topic);
    }
    for (const topic of extraTopics) {
      if (!byId.has(topic.id)) {
        byId.set(topic.id, topic);
      }
    }
    return Array.from(byId.values());
  }, [topics, extraTopics]);

  const notebookBaseHref = `/nogs/${nog.id}/notebook`;

  function openAddAndFocus() {
    setIsAddOpen(true);
    setFocusTick((tick) => tick + 1);
  }

  function handleToggleAdd() {
    setIsAddOpen((prev) => {
      const next = !prev;
      if (next) {
        setFocusTick((tick) => tick + 1);
      } else {
        setFieldError(null);
      }
      return next;
    });
  }

  function handleSelectTopic(topicId: string) {
    if (duplicateNotice && duplicateNotice.topicId !== topicId) {
      setDuplicateNotice(null);
    }
  }

  function upsertExtraTopic(topic: TopicSummary) {
    setExtraTopics((prev) => {
      const filtered = prev.filter((item) => item.id !== topic.id);
      return [...filtered, topic];
    });
  }

  async function runAddTopic(title: string) {
    setIsSubmitting(true);
    setFieldError(null);
    setStatusAlert(null);

    let result: AddTopicActionResult;
    try {
      result = await addTopicAction(nog.id, title);
    } catch {
      setStatusAlert("Brain fog — couldn't add that topic right now. Try again.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    if (result.status === "ok") {
      upsertExtraTopic(result.topic);
      setPendingTitle(null);
      setDuplicateNotice(null);
      setDraftTitle("");
      setIsAddOpen(false);
      router.push(
        `${notebookBaseHref}?topic=${encodeURIComponent(result.topic.id)}`,
      );
      router.refresh();
      return;
    }

    if (result.status === "pending") {
      upsertExtraTopic(result.topic);
      setPendingTitle(title);
      setDuplicateNotice(null);
      setDraftTitle("");
      setIsAddOpen(false);
      return;
    }

    if (result.status === "already_exists") {
      setPendingTitle(null);
      setDraftTitle("");
      setIsAddOpen(false);
      setDuplicateNotice({
        topicId: result.topic.id,
        message: `"${result.topic.title}" is already in your notebook — opened it for you.`,
      });
      router.push(
        `${notebookBaseHref}?topic=${encodeURIComponent(result.topic.id)}`,
      );
      router.refresh();
      return;
    }

    if (result.status === "tired_for_today") {
      setPendingTitle(null);
      setStatusAlert("Your Nog is tired for today — try again tomorrow.");
      return;
    }

    if (result.status === "invalid_title") {
      setPendingTitle(null);
      setFieldError("Use 1 to 60 letters or numbers for a topic title.");
      return;
    }

    if (result.status === "unauthenticated") {
      router.push(`/login?next=${encodeURIComponent(notebookBaseHref)}`);
      return;
    }

    setStatusAlert(
      result.status === "error"
        ? result.error
        : "Couldn't add that topic right now. Try again.",
    );
  }

  function handleSubmitTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    void runAddTopic(draftTitle);
  }

  function handleRetryPending() {
    if (!pendingTitle || isSubmitting) {
      return;
    }
    void runAddTopic(pendingTitle);
  }

  const activeDuplicateNotice =
    duplicateNotice && selectedTopic?.id === duplicateNotice.topicId
      ? duplicateNotice.message
      : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="noggin-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-tight text-[var(--noggin-leaf-title)]">
            Notebook
          </h1>

          <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{nog.name}</span>
          </span>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,310px)_minmax(0,1fr)] lg:items-start">
          <TopicSidebar
            nogId={nog.id}
            topics={visibleTopics}
            selectedTopicId={selectedTopic?.id ?? null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectTopic={handleSelectTopic}
            isAddOpen={isAddOpen}
            onToggleAdd={handleToggleAdd}
            draftTitle={draftTitle}
            onDraftTitleChange={(value) => {
              setDraftTitle(value);
              if (fieldError) {
                setFieldError(null);
              }
            }}
            onSubmitTopic={handleSubmitTopic}
            isSubmitting={isSubmitting}
            fieldError={fieldError}
            pendingTitle={pendingTitle}
            onRetryPending={handleRetryPending}
            statusAlert={statusAlert}
            newTopicInputRef={newTopicInputRef}
          />

          <section
            aria-label={selectedTopic ? selectedTopic.title : "Topic notes"}
            className="flex min-w-0 flex-col gap-5 rounded-[28px] border border-[var(--noggin-leaf)] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-7"
          >
            {!selectedTopic ? (
              <div className="flex flex-col items-center rounded-[22px] bg-[var(--noggin-white)] px-6 py-10 text-center shadow-[0_6px_18px_var(--noggin-shadow)] sm:py-12">
                <p className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
                  Nothing taught yet
                </p>
                <p className="mt-2 max-w-[36ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                  Add a topic to start teaching {nog.name} in your own words.
                </p>
                <button
                  type="button"
                  onClick={openAddAndFocus}
                  className="noggin-primary-pill noggin-display mt-5 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-6 text-[1rem] font-bold"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Add your first topic</span>
                </button>
              </div>
            ) : (
              <>
                {activeDuplicateNotice && (
                  <p
                    role="status"
                    className="rounded-[18px] bg-[var(--noggin-mint-light)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-forest)]"
                  >
                    {activeDuplicateNotice}
                  </p>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h2 className="noggin-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-tight text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      {selectedTopic.title}
                    </h2>

                    {selectedTopic.status === "pending" && (
                      <p
                        id={pendingReasonId}
                        className="text-[0.875rem] font-medium text-[var(--noggin-meter-mid-ink)]"
                      >
                        Your Nog&rsquo;s questions are being written — Quick
                        check unlocks once they&rsquo;re ready.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                    <Link
                      href={`/nogs/${nog.id}/feed?topic=${encodeURIComponent(selectedTopic.id)}`}
                      className="noggin-primary-pill noggin-display inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[0.9375rem] font-bold"
                    >
                      <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Teach this topic</span>
                    </Link>

                    {selectedTopic.status === "pending" ? (
                      <button
                        type="button"
                        disabled
                        aria-describedby={pendingReasonId}
                        className="noggin-display inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sand)] px-5 text-[0.9375rem] font-bold text-[var(--noggin-ink)] opacity-75"
                      >
                        <CheckCircle2
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Quick check</span>
                      </button>
                    ) : (
                      <Link
                        href={`/nogs/${nog.id}/play?topic=${encodeURIComponent(selectedTopic.id)}`}
                        className="noggin-feature-pill noggin-display inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[0.9375rem] font-bold transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      >
                        <CheckCircle2
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Quick check</span>
                      </Link>
                    )}
                  </div>
                </div>

                {pages.length === 0 ? (
                  <div className="flex flex-col items-center rounded-[22px] bg-[var(--noggin-white)] px-6 py-9 text-center shadow-[0_6px_18px_var(--noggin-shadow)]">
                    <p className="noggin-display text-[1.125rem] font-extrabold text-[var(--noggin-forest)]">
                      Nothing taught yet
                    </p>
                    <p className="mt-1.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                      Teach {nog.name} about {selectedTopic.title} in your own
                      words to start your notes.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {pages.map((page) => (
                      <LessonCard key={page.id} page={page} />
                    ))}
                  </ul>
                )}

                <TopicThoughtCards nogName={nog.name} cards={thoughtCards} />
              </>
            )}
          </section>
        </div>
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
