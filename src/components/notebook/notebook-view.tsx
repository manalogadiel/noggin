"use client";

import { BookOpen, CheckCircle2, LayoutGrid, Pencil, Plus, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addTopicAction,
  type AddTopicActionResult,
} from "@/app/(app)/actions/topic-actions";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { type BookCoverStyle, useGameUi } from "@/components/game-ui/game-ui-context";
import { RoomRail } from "@/components/room/room-rail";
import type {
  LessonPage,
  NogRecord,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import { cn } from "@/lib/utils";
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

const COVER_SWATCHES: ReadonlyArray<{ id: BookCoverStyle; label: string; color: string }> = [
  { id: "sage", label: "Sage", color: "var(--ng-c-87b64c)" },
  { id: "honey", label: "Honey", color: "var(--ng-c-f5be2c)" },
  { id: "gingham", label: "Matcha", color: "var(--ng-c-a6d660)" },
  { id: "berry", label: "Berry", color: "var(--ng-c-e86058)" },
  { id: "denim", label: "Sky", color: "var(--ng-c-56b5f5)" },
  { id: "forest", label: "Forest", color: "var(--noggin-forest)" },
];

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

  const { state, openModal, requestPurchase, updateState, showToast } = useGameUi();

  const [viewMode, setViewMode] = useState<"spread" | "shelf">("spread");
  const [editMode, setEditMode] = useState(false);
  const [extraSlots, setExtraSlots] = useState(0);
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
  const activeBookId = selectedTopic?.id ?? nog.id;
  const activeCover = state.notebookCovers[activeBookId] ?? "sage";
  const maxPages = state.notebookMaxPages[activeBookId] ?? 20;
  const customBookTitle = selectedTopic
    ? state.notebookTitles[selectedTopic.id] ?? selectedTopic.title
    : `${nog.name}'s Notebook`;

  function openAddAndFocus() {
    setViewMode("spread");
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
      router.push(`${notebookBaseHref}?topic=${encodeURIComponent(result.topic.id)}`);
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
      router.push(`${notebookBaseHref}?topic=${encodeURIComponent(result.topic.id)}`);
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
    if (isSubmitting) return;
    void runAddTopic(draftTitle);
  }

  function handleRetryPending() {
    if (!pendingTitle || isSubmitting) return;
    void runAddTopic(pendingTitle);
  }

  function handleUnlockSlot() {
    requestPurchase({
      title: "UNLOCK NOTEBOOK SLOT",
      itemLabel: "Extra Notebook Shelf Slot",
      cost: 150,
      onConfirm: () => {
        updateState((prev) => ({
          ...prev,
          coins: Math.max(0, prev.coins - 150),
        }));
        setExtraSlots((n) => n + 1);
        showToast("Unlocked extra notebook slot! (-150 coins)");
      },
    });
  }

  const activeDuplicateNotice =
    duplicateNotice && selectedTopic?.id === duplicateNotice.topicId
      ? duplicateNotice.message
      : null;

  return (
    <div className="ng-botanical-bg grid grid-cols-1 gap-6 rounded-[28px] p-4 shadow-[0_14px_34px_var(--noggin-shadow)] md:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="noggin-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-tight text-[var(--noggin-leaf-title)]">
              Notebook
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{nog.name}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={viewMode === "shelf"}
              onClick={() => setViewMode((m) => (m === "shelf" ? "spread" : "shelf"))}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold shadow-sm transition",
                viewMode === "shelf"
                  ? "bg-[var(--noggin-leaf-strong)] text-white"
                  : "bg-white text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint)]",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{viewMode === "shelf" ? "Back to Open Book" : "All Notebooks (3D)"}</span>
            </button>

            <button
              type="button"
              aria-pressed={editMode}
              onClick={() => setEditMode((v) => !v)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold shadow-sm transition",
                editMode
                  ? "bg-[var(--ng-c-ffe26a)] text-[var(--ng-c-4a2e00)]"
                  : "bg-white text-[var(--noggin-forest)] hover:bg-[var(--noggin-mint)]",
              )}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{editMode ? "Done" : "Edit"}</span>
            </button>
          </div>
        </header>

        {/* Inline Edit & Cover Toolbar (when Edit active or customizing active book) */}
        {(editMode || viewMode === "spread") && selectedTopic && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ng-c-e3d6b4)] bg-[rgb(255_253_245_/_0.92)] px-4 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {editMode ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="nb-rename-input" className="text-xs font-black text-[var(--noggin-forest)]">
                    Title:
                  </label>
                  <input
                    id="nb-rename-input"
                    type="text"
                    maxLength={30}
                    value={customBookTitle}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 30);
                      updateState((prev) => ({
                        ...prev,
                        notebookTitles: { ...prev.notebookTitles, [selectedTopic.id]: val },
                      }));
                    }}
                    className="rounded-xl border border-[var(--noggin-sage-strong)] bg-white px-3 py-1 text-xs font-bold text-[var(--noggin-forest)]"
                  />
                  <span className="text-[11px] font-bold text-[var(--noggin-ink)]">
                    {customBookTitle.length}/30
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5" role="group" aria-label="Customize notebook cover">
                  <span className="text-xs font-extrabold text-[var(--noggin-forest)]">Cover:</span>
                  {COVER_SWATCHES.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      aria-label={`${sw.label} cover`}
                      aria-pressed={activeCover === sw.id}
                      onClick={() =>
                        updateState((prev) => ({
                          ...prev,
                          notebookCovers: { ...prev.notebookCovers, [activeBookId]: sw.id },
                        }))
                      }
                      className={cn(
                        "h-6 w-6 cursor-pointer rounded-full border-2 transition",
                        activeCover === sw.id
                          ? "scale-110 border-[var(--noggin-forest)]"
                          : "border-white opacity-85 hover:opacity-100",
                      )}
                      style={{ backgroundColor: sw.color }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--ng-c-efe7cf)] px-3 py-1 text-xs font-extrabold text-[var(--noggin-forest)] tabular-nums">
                {pages.length} / {maxPages} pages
              </span>
              {maxPages >= 60 ? (
                <span className="rounded-full bg-[var(--noggin-leaf-strong)] px-2.5 py-0.5 text-[11px] font-black text-white">
                  MAX
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Expand pages"
                  onClick={() =>
                    openModal({
                      type: "expandPages",
                      bookId: activeBookId,
                      bookTitle: customBookTitle,
                      cover: activeCover,
                    })
                  }
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[var(--ng-c-ffe26a)] text-sm font-black text-[var(--ng-c-4a2e00)] shadow-sm"
                >
                  +
                </button>
              )}
            </div>
          </div>
        )}

        {viewMode === "shelf" ? (
          <section aria-label="3D notebooks shelf" className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {visibleTopics.map((topic, idx) => {
              const title = state.notebookTitles[topic.id] ?? topic.title;
              const cover = state.notebookCovers[topic.id] ?? COVER_SWATCHES[idx % COVER_SWATCHES.length].id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => {
                    setViewMode("spread");
                    router.push(`${notebookBaseHref}?topic=${encodeURIComponent(topic.id)}`);
                  }}
                  className="flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-2 text-center transition hover:-translate-y-1"
                >
                  <div className="w-28 drop-shadow-[0_14px_18px_rgb(35_54_16_/_0.24)]">
                    <Book3dSvg style={cover} title={title} uid={`shelf-${topic.id}`} />
                  </div>
                  <strong className="text-sm font-black text-[var(--noggin-forest)]">{title}</strong>
                  <span className="text-[11px] font-bold text-[var(--noggin-ink)]">
                    {topic.questionCount} questions
                  </span>
                </button>
              );
            })}

            {Array.from({ length: extraSlots }).map((_, i) => (
              <div
                key={`extra-${i}`}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[var(--noggin-sage-strong)] bg-white/75 p-4 text-center"
              >
                <div className="w-24 opacity-80">
                  <Book3dSvg style="honey" title="New Subject" uid={`extra-slot-${i}`} />
                </div>
                <strong className="text-xs font-extrabold text-[var(--noggin-forest)]">Unlocked Slot</strong>
              </div>
            ))}

            <button
              type="button"
              onClick={handleUnlockSlot}
              aria-label="Unlock extra notebook slot for 150 coins"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--ng-c-f5be2c)] bg-[rgb(255_253_245_/_0.88)] p-4 text-center shadow-[0_0_24px_rgb(245_190_44_/_0.3)] transition hover:-translate-y-1"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ng-c-ffe26a)] text-2xl font-black text-[var(--ng-c-4a2e00)] shadow">
                +
              </span>
              <span className="rounded-full bg-[var(--ng-c-f5be2c)] px-3 py-0.5 text-xs font-black text-[var(--ng-c-4a2e00)]">
                🪙 150
              </span>
              <span className="text-xs font-extrabold text-[var(--noggin-forest)]">Add Notebook Slot</span>
            </button>
          </section>
        ) : (
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
                if (fieldError) setFieldError(null);
              }}
              onSubmitTopic={handleSubmitTopic}
              isSubmitting={isSubmitting}
              fieldError={fieldError}
              pendingTitle={pendingTitle}
              onRetryPending={handleRetryPending}
              statusAlert={statusAlert}
              newTopicInputRef={newTopicInputRef}
            />

            {/* 2-Page Open Book Spread */}
            <section
              aria-label={selectedTopic ? selectedTopic.title : "Topic notes"}
              className="relative flex min-w-0 flex-col gap-5 rounded-[28px] border-4 border-[var(--noggin-leaf)] bg-[var(--ng-c-fcf7e8)] p-5 shadow-[0_18px_38px_var(--noggin-shadow)] sm:p-7"
            >
              {!selectedTopic ? (
                <div className="flex flex-col items-center rounded-[22px] bg-[var(--noggin-white)] px-6 py-10 text-center shadow-sm sm:py-12">
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

                  <div className="flex flex-col gap-4 border-b-2 border-[var(--ng-c-e3d6b4)] pb-4 sm:flex-row sm:items-start sm:justify-between">
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
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>Quick check</span>
                        </button>
                      ) : (
                        <Link
                          href={`/nogs/${nog.id}/play?topic=${encodeURIComponent(selectedTopic.id)}`}
                          className="noggin-feature-pill noggin-display inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[0.9375rem] font-bold transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>Quick check</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Two-Page Spread Grid */}
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:divide-x-2 xl:divide-dashed xl:divide-[var(--ng-c-d7c9a3)]">
                    <div className="flex flex-col gap-3 xl:pr-4">
                      {pages.length === 0 ? (
                        <div className="flex flex-col items-center rounded-[22px] bg-[var(--noggin-white)] px-6 py-9 text-center shadow-sm">
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
                    </div>

                    <div className="xl:pl-5">
                      <TopicThoughtCards nogName={nog.name} cards={thoughtCards} />
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
