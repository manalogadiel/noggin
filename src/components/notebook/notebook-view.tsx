"use client";

import { BookOpen, CheckCircle2, LayoutGrid, Pencil, Plus, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
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

  const COVER_THEME: Record<BookCoverStyle, { rim: string; rib: string }> = {
    sage: { rim: "var(--ng-c-7aa941)", rib: "var(--ng-c-ea6c68)" },
    honey: { rim: "var(--ng-c-cf8f15)", rib: "var(--ng-c-7aa941)" },
    gingham: { rim: "var(--ng-c-82b04b)", rib: "var(--ng-c-f2bd32)" },
    berry: { rim: "var(--ng-c-c74f4f)", rib: "var(--noggin-leaf)" },
    denim: { rim: "var(--ng-c-4d85b5)", rib: "var(--ng-c-f5c23b)" },
    forest: { rim: "var(--ng-c-203a09)", rib: "var(--ng-c-f7cb52)" },
  };
  const coverTheme = COVER_THEME[activeCover] ?? COVER_THEME.sage;

  return (
    <div className="game-world nb-world nb-textured-bg">
      <div className="stage-body stage-body--with-rail max-w-[1280px] gap-5">
        <header className="open-book-toolbar">
          <div className="flex items-center gap-3">
            <h1 className="stage-h1">Notebook</h1>
            <span className="qs-round-pill inline-flex items-center gap-1.5">
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
                "gbtn gbtn--sm",
                viewMode === "shelf" ? "gbtn--leaf" : "gbtn--white",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{viewMode === "shelf" ? "Back to Open Book" : "All Notebooks (3D)"}</span>
            </button>

            <button
              type="button"
              aria-pressed={editMode}
              onClick={() => setEditMode((v) => !v)}
              className={cn("book-edit-toggle-btn", editMode && "is-on")}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{editMode ? "Done" : "Edit"}</span>
            </button>
          </div>
        </header>

        {/* Inline Edit & Cover Toolbar (when Edit active or customizing active book) */}
        {(editMode || viewMode === "spread") && selectedTopic && (
          <div className={cn(editMode ? "book-edit-bar" : "open-book-toolbar")}>
            {editMode ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="book-edit-title-row flex-1">
                  <label
                    htmlFor="nb-rename-input"
                    className="text-xs font-black text-[var(--noggin-forest)]"
                  >
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
                    className="book-edit-input"
                  />
                  <span className="book-edit-count tnum">
                    {customBookTitle.length}/30
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hw-date-stamp tnum">
                    {pages.length} / {maxPages} pages
                  </span>
                  {maxPages >= 60 ? (
                    <span className="nb-max-pill">MAX</span>
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
                      className="nb-plus-btn"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div
                  className="open-book-swatches"
                  role="group"
                  aria-label="Customize notebook cover"
                >
                  <span>Cover:</span>
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

                <div className="open-book-swatches">
                  <span className="tnum">
                    {pages.length} / {maxPages} pages
                  </span>
                  {maxPages >= 60 ? (
                    <span className="nb-max-pill">MAX</span>
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
                      className="nb-plus-btn"
                    >
                      +
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {viewMode === "shelf" ? (
          <section aria-label="3D notebooks shelf" className="nb-shelf-wrap">
            <div className="nb-shelf-grid">
              {visibleTopics.map((topic, idx) => {
                const title = state.notebookTitles[topic.id] ?? topic.title;
                const cover = state.notebookCovers[topic.id] ?? COVER_SWATCHES[idx % COVER_SWATCHES.length].id;
                const isCurrent = selectedTopic?.id === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => {
                      setViewMode("spread");
                      router.push(`${notebookBaseHref}?topic=${encodeURIComponent(topic.id)}`);
                    }}
                    className={cn(
                      "nb-shelf-card",
                      isCurrent && "is-current",
                      editMode && "is-editing",
                    )}
                  >
                    <div className="nb-shelf-card__book">
                      <Book3dSvg style={cover} title={title} uid={`shelf-${topic.id}`} />
                    </div>
                    <div className="nb-shelf-card__shadow" aria-hidden="true" />
                    <strong className="nb-shelf-card__name">{title}</strong>
                    <span className="nb-shelf-card__meta">
                      {topic.questionCount} questions
                    </span>
                  </button>
                );
              })}

              {Array.from({ length: extraSlots }).map((_, i) => (
                <div key={`extra-${i}`} className="nb-shelf-card">
                  <div className="nb-shelf-card__book opacity-85">
                    <Book3dSvg style="honey" title="New Subject" uid={`extra-slot-${i}`} />
                  </div>
                  <div className="nb-shelf-card__shadow" aria-hidden="true" />
                  <strong className="nb-shelf-card__name">Unlocked Slot</strong>
                </div>
              ))}

              <button
                type="button"
                onClick={handleUnlockSlot}
                aria-label="Unlock extra notebook slot for 150 coins"
                className="nb-shelf-card nb-shelf-card--locked"
              >
                <span className="nb-shelf-lock-badge flex-col gap-1">
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-xs font-black">🪙 150</span>
                </span>
                <strong className="nb-shelf-card__name">Add Notebook Slot</strong>
              </button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(240px,290px)_minmax(0,1fr)] lg:items-start">
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
              style={
                {
                  "--book-rim": coverTheme.rim,
                  "--book-rib": coverTheme.rib,
                } as CSSProperties
              }
              className="open-book-cover border border-[var(--noggin-leaf)] min-w-0"
            >
              <div className="open-book-ribbon" aria-hidden="true" />

              {!selectedTopic ? (
                <div className="open-book-page items-center justify-center rounded-[16px] text-center">
                  <p className="hw-title">Nothing taught yet</p>
                  <p className="mt-2 max-w-[36ch] text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                    Add a topic to start teaching {nog.name} in your own words.
                  </p>
                  <button
                    type="button"
                    onClick={openAddAndFocus}
                    className="gbtn gbtn--leaf gbtn--lg mt-4"
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Add your first topic</span>
                  </button>
                </div>
              ) : (
                <div className="open-book-spread">
                  {/* LEFT PAGE: Handwritten Header + Lessons */}
                  <div className="open-book-page open-book-page--left">
                    {activeDuplicateNotice && (
                      <p
                        role="status"
                        className="rounded-[14px] bg-[var(--noggin-mint-light)] px-4 py-2.5 text-[0.875rem] font-medium text-[var(--noggin-forest)]"
                      >
                        {activeDuplicateNotice}
                      </p>
                    )}

                    <div className="hw-page-head">
                      <div className="min-w-0">
                        <h2 className="hw-title [overflow-wrap:anywhere]">
                          {selectedTopic.title}
                        </h2>
                        <span className="hw-subtitle block">
                          {customBookTitle !== selectedTopic.title
                            ? customBookTitle
                            : `${nog.name}’s study notes`}
                        </span>
                      </div>

                      <span className="hw-date-stamp tnum">
                        {pages.length} / {maxPages} pages
                      </span>
                    </div>

                    {selectedTopic.status === "pending" && (
                      <p
                        id={pendingReasonId}
                        className="hw-sticky m-0 text-[1rem]"
                      >
                        Your Nog&rsquo;s questions are being written — Quick check unlocks once they&rsquo;re ready.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/nogs/${nog.id}/feed?topic=${encodeURIComponent(selectedTopic.id)}`}
                        className="gbtn gbtn--leaf gbtn--sm no-underline"
                      >
                        <Utensils className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Teach this topic</span>
                      </Link>

                      {selectedTopic.status === "pending" ? (
                        <button
                          type="button"
                          disabled
                          aria-describedby={pendingReasonId}
                          className="gbtn gbtn--sm bg-[var(--noggin-sand)] text-[var(--noggin-ink)] opacity-75 cursor-not-allowed"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Quick check</span>
                        </button>
                      ) : (
                        <Link
                          href={`/nogs/${nog.id}/play?topic=${encodeURIComponent(selectedTopic.id)}`}
                          className="gbtn gbtn--honey gbtn--sm no-underline"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Quick check</span>
                        </Link>
                      )}
                    </div>

                    {pages.length === 0 ? (
                      <div className="hw-sticky my-2">
                        <p className="m-0 font-bold">Nothing taught yet</p>
                        <p className="mt-1 mb-0 text-[0.95rem]">
                          Teach {nog.name} about {selectedTopic.title} in your own words to start your notes.
                        </p>
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                        {pages.map((page) => (
                          <LessonCard key={page.id} page={page} />
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* BOOK SPINE */}
                  <div className="open-book-spine" aria-hidden="true">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span key={i} />
                    ))}
                  </div>

                  {/* RIGHT PAGE: Thought Cards + Handwritten Sticky Note */}
                  <div className="open-book-page open-book-page--right">
                    <div className="hw-sticky hw-sticky--sage">
                      {nog.name} connects concepts here as you feed new lessons.
                    </div>

                    <TopicThoughtCards nogName={nog.name} cards={thoughtCards} />

                    <Link
                      href={`/nogs/${nog.id}/feed?topic=${encodeURIComponent(selectedTopic.id)}`}
                      className="hw-add-note-btn block no-underline"
                    >
                      + Write a new note for {selectedTopic.title}...
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <RoomRail nogId={nog.id} />
    </div>
  );
}
