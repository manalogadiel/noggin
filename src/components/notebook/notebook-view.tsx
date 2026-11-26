"use client";

import { Check, CheckCircle2, Pencil, Plus, RefreshCw, Search, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addTopicAction,
  type AddTopicActionResult,
} from "@/app/(app)/actions/topic-actions";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import { type BookCoverStyle, useGameUi } from "@/components/game-ui/game-ui-context";
import type {
  LessonPage,
  NogRecord,
  ThoughtCardRecord,
  TopicSummary,
} from "@/core/application/ports";
import { cn } from "@/lib/utils";
import { LessonCard } from "./lesson-card";
import { TopicThoughtCards } from "./topic-thought-cards";

export interface NotebookViewProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  selectedTopic: TopicSummary | null;
  pages: ReadonlyArray<LessonPage>;
  thoughtCards: ReadonlyArray<ThoughtCardRecord>;
  initialTopicExplicit?: boolean;
}

const COVER_SWATCHES: ReadonlyArray<{ id: BookCoverStyle; label: string; color: string }> = [
  { id: "sage", label: "Sage", color: "var(--ng-c-87b64c)" },
  { id: "honey", label: "Honey", color: "var(--ng-c-f5be2c)" },
  { id: "gingham", label: "Matcha", color: "var(--ng-c-a6d660)" },
  { id: "berry", label: "Berry", color: "var(--ng-c-e86058)" },
  { id: "denim", label: "Sky", color: "var(--ng-c-56b5f5)" },
  { id: "forest", label: "Forest", color: "var(--noggin-forest)" },
];

const COVER_THEME: Record<BookCoverStyle, { rim: string; rib: string }> = {
  sage: { rim: "var(--ng-c-7aa941)", rib: "var(--ng-c-ea6c68)" },
  honey: { rim: "var(--ng-c-cf8f15)", rib: "var(--ng-c-7aa941)" },
  gingham: { rim: "var(--ng-c-82b04b)", rib: "var(--ng-c-f2bd32)" },
  berry: { rim: "var(--ng-c-c74f4f)", rib: "var(--noggin-leaf)" },
  denim: { rim: "var(--ng-c-4d85b5)", rib: "var(--ng-c-f5c23b)" },
  forest: { rim: "var(--ng-c-203a09)", rib: "var(--ng-c-f7cb52)" },
};

export function NotebookView({
  nog,
  topics,
  selectedTopic,
  pages,
  thoughtCards,
  initialTopicExplicit = false,
}: NotebookViewProps) {
  const router = useRouter();
  const pendingReasonId = useId();
  const searchId = useId();
  const newTopicId = useId();
  const fieldErrorId = useId();
  const newTopicInputRef = useRef<HTMLInputElement | null>(null);

  const { state, activeRoom, openModal, requestPurchase, updateState, showToast } = useGameUi();
  const roomBgSrc = activeRoom?.src ?? "/game/bg/sanctuary-day.jpg";

  const [viewMode, setViewMode] = useState<"spread" | "shelf">(() =>
    initialTopicExplicit || topics.length === 0 ? "spread" : "shelf",
  );
  const [editMode, setEditMode] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(
    selectedTopic?.id ?? topics[0]?.id ?? null,
  );
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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTopics = useMemo(() => {
    if (!normalizedQuery) return visibleTopics;
    return visibleTopics.filter((topic) => {
      const displayTitle = state.notebookTitles[topic.id] ?? topic.title;
      return (
        topic.title.toLowerCase().includes(normalizedQuery) ||
        displayTitle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, state.notebookTitles, visibleTopics]);

  const notebookBaseHref = `/nogs/${nog.id}/notebook`;
  const activeBookId = selectedTopic?.id ?? nog.id;
  const activeCover = state.notebookCovers[activeBookId] ?? "sage";
  const maxPages = state.notebookMaxPages[activeBookId] ?? 20;
  const customBookTitle = selectedTopic
    ? state.notebookTitles[selectedTopic.id] ?? selectedTopic.title
    : `${nog.name}'s Notebook`;

  const editTargetTopic =
    visibleTopics.find((t) => t.id === editingTopicId) ??
    selectedTopic ??
    visibleTopics[0] ??
    null;
  const editTargetId = editTargetTopic?.id ?? activeBookId;
  const editTargetCover = state.notebookCovers[editTargetId] ?? "sage";
  const editTargetTitle = editTargetTopic
    ? state.notebookTitles[editTargetTopic.id] ?? editTargetTopic.title
    : customBookTitle;
  const editTargetMaxPages = state.notebookMaxPages[editTargetId] ?? 20;

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
      setViewMode("spread");
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
      setViewMode("spread");
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

  const coverTheme = COVER_THEME[activeCover] ?? COVER_THEME.sage;

  const addTopicPanelEl =
    isAddOpen || pendingTitle || statusAlert ? (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2.5">
        {isAddOpen && (
          <form
            noValidate
            onSubmit={handleSubmitTopic}
            className="flex flex-wrap items-end gap-2.5 rounded-[22px] bg-[rgb(255_253_247_/_0.96)] p-4 shadow-[0_5px_0_var(--ng-c-dfd2b2),0_14px_28px_rgb(34_54_10_/_0.14)]"
          >
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label
                htmlFor={newTopicId}
                className="noggin-display text-[0.8125rem] font-bold text-[var(--noggin-forest)]"
              >
                New topic
              </label>

              <input
                ref={newTopicInputRef}
                id={newTopicId}
                name="title"
                type="text"
                maxLength={60}
                placeholder="e.g. DNS lookup"
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  if (fieldError) setFieldError(null);
                }}
                aria-invalid={fieldError ? "true" : undefined}
                aria-describedby={fieldError ? fieldErrorId : undefined}
                disabled={isSubmitting}
                className={cn(
                  "min-h-11 w-full rounded-[14px] px-3.5 py-2 text-[0.9375rem] font-semibold text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] shadow-[inset_0_2px_6px_rgb(42_66_14_/_0.08)] focus-visible:outline-none",
                  fieldError
                    ? "bg-[var(--noggin-danger-soft)]"
                    : "bg-[var(--noggin-mint)]",
                )}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="gbtn gbtn--leaf gbtn--sm min-h-11 shrink-0 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Adding…" : "Add"}
            </button>

            {fieldError && (
              <p
                id={fieldErrorId}
                role="alert"
                className="m-0 w-full text-[0.8125rem] font-semibold text-[var(--noggin-danger)]"
              >
                {fieldError}
              </p>
            )}
          </form>
        )}

        {pendingTitle && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2.5 rounded-[18px] bg-[var(--noggin-meter-mid-soft)] px-4 py-3 text-[0.875rem] text-[var(--noggin-meter-mid-ink)] shadow-[0_4px_12px_rgb(34_54_10_/_0.1)]"
          >
            <p className="m-0 font-semibold leading-snug">
              Your Nog&rsquo;s questions are being written.
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRetryPending}
              className="gbtn gbtn--white gbtn--sm shrink-0 gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {statusAlert && (
          <p
            role="alert"
            className="m-0 rounded-[16px] bg-[var(--noggin-danger-soft)] px-4 py-2.5 text-[0.875rem] font-semibold leading-snug text-[var(--noggin-danger)] shadow-[0_4px_12px_rgb(160_38_38_/_0.1)]"
          >
            {statusAlert}
          </p>
        )}
      </div>
    ) : null;

  const editBarEl =
    editMode && editTargetTopic ? (
      <div className="book-edit-bar book-edit-bar--shelf">
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
              value={editTargetTitle}
              onChange={(e) => {
                const val = e.target.value.slice(0, 30);
                updateState((prev) => ({
                  ...prev,
                  notebookTitles: {
                    ...prev.notebookTitles,
                    [editTargetTopic.id]: val,
                  },
                }));
              }}
              className="book-edit-input"
            />
            <span className="book-edit-count tnum">
              {editTargetTitle.length}/30
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hw-date-stamp tnum">
              {editTargetTopic.id === selectedTopic?.id ? pages.length : 0} /{" "}
              {editTargetMaxPages} pages
            </span>
            {editTargetMaxPages >= 60 ? (
              <span className="nb-max-pill">MAX</span>
            ) : (
              <button
                type="button"
                aria-label="Expand pages"
                onClick={() =>
                  openModal({
                    type: "expandPages",
                    bookId: editTargetId,
                    bookTitle: editTargetTitle,
                    cover: editTargetCover,
                  })
                }
                className="nb-plus-btn"
              >
                +
              </button>
            )}
          </div>
        </div>

        <div
          className="open-book-swatches"
          role="group"
          aria-label="Customize notebook cover"
        >
          <span className="mr-1">Cover:</span>
          {COVER_SWATCHES.map((sw) => {
            const isSelected = editTargetCover === sw.id;
            return (
              <button
                key={sw.id}
                type="button"
                aria-label={`${sw.label} cover`}
                aria-pressed={isSelected}
                onClick={() =>
                  updateState((prev) => ({
                    ...prev,
                    notebookCovers: {
                      ...prev.notebookCovers,
                      [editTargetId]: sw.id,
                    },
                  }))
                }
                className={cn("live-book-swatch", isSelected && "is-on")}
                style={{ backgroundColor: sw.color }}
              >
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.2} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div className="game-world game-world--scroll nb-world">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={roomBgSrc} alt="" className="scene-bg-img" />
      <div className="scene-bg-scrim nb-textured-bg" aria-hidden="true" />

      <header className="stage-top">
        <h1 className="stage-h1" style={{ fontSize: "30px" }}>
          Notebook
        </h1>

        {viewMode === "shelf" ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              aria-expanded={isAddOpen}
              onClick={handleToggleAdd}
              className="gbtn gbtn--white gbtn--sm"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.8} aria-hidden="true" />
              <span>Add Topic</span>
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
        ) : (
          <span aria-hidden="true" />
        )}
      </header>

      <div
        className="stage-body"
        style={{ justifyContent: "flex-start", paddingTop: "12px" }}
      >
        {viewMode === "shelf" ? (
          <section aria-label="3D notebooks shelf" className="nb-shelf-wrap">
            {visibleTopics.length > 1 && (
              <div className="mx-auto flex w-full max-w-[360px] items-center">
                <div className="relative w-full">
                  <label htmlFor={searchId} className="sr-only">
                    Find a topic
                  </label>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--noggin-leaf-strong)]"
                  />
                  <input
                    id={searchId}
                    type="search"
                    aria-label="Find a topic"
                    placeholder="Find a topic"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="min-h-10 w-full rounded-[var(--noggin-radius-pill)] bg-[rgb(255_253_247_/_0.94)] py-2 pr-4 pl-10 text-[0.875rem] font-semibold text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] shadow-[0_4px_0_var(--ng-c-dfd2b2),0_10px_20px_rgb(34_54_10_/_0.12)] focus-visible:outline-none"
                  />
                </div>
              </div>
            )}

            {addTopicPanelEl}
            {editBarEl}

            {filteredTopics.length === 0 && visibleTopics.length > 0 ? (
              <p className="py-6 text-center text-[0.9375rem] font-semibold text-[var(--noggin-forest)]">
                No matching topics.
              </p>
            ) : (
              <div className="nb-shelf-grid">
                {filteredTopics.map((topic, idx) => {
                  const title = state.notebookTitles[topic.id] ?? topic.title;
                  const cover =
                    state.notebookCovers[topic.id] ??
                    COVER_SWATCHES[idx % COVER_SWATCHES.length].id;
                  const isCurrent = editMode
                    ? editTargetTopic?.id === topic.id
                    : selectedTopic?.id === topic.id;
                  const bookMaxPages = state.notebookMaxPages[topic.id] ?? 20;
                  const bookPageCount =
                    topic.id === selectedTopic?.id ? pages.length : 0;

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        if (editMode) {
                          setEditingTopicId(topic.id);
                          return;
                        }
                        if (duplicateNotice && duplicateNotice.topicId !== topic.id) {
                          setDuplicateNotice(null);
                        }
                        setViewMode("spread");
                        router.push(
                          `${notebookBaseHref}?topic=${encodeURIComponent(topic.id)}`,
                        );
                      }}
                      className={cn(
                        "nb-shelf-card",
                        isCurrent && "is-current",
                        editMode && isCurrent && "is-editing",
                      )}
                    >
                      <span className="nb-shelf-card__book">
                        <Book3dSvg style={cover} title={title} uid={`shelf-${topic.id}`} />
                      </span>
                      <span className="nb-shelf-card__shadow" aria-hidden="true" />
                      <strong className="nb-shelf-card__name" title={title}>
                        {title}
                      </strong>
                      <span className="nb-shelf-card__meta tnum">
                        {topic.status === "pending"
                          ? "Writing…"
                          : `${bookPageCount} / ${bookMaxPages}p · ${topic.questionCount} Qs`}
                      </span>
                    </button>
                  );
                })}

                {Array.from({ length: extraSlots }).map((_, i) => (
                  <button
                    key={`extra-${i}`}
                    type="button"
                    onClick={openAddAndFocus}
                    className="nb-shelf-card"
                  >
                    <span className="nb-shelf-card__book opacity-85">
                      <Book3dSvg style="honey" title="New Subject" uid={`extra-slot-${i}`} />
                    </span>
                    <span className="nb-shelf-card__shadow" aria-hidden="true" />
                    <strong className="nb-shelf-card__name">Unlocked Slot</strong>
                    <span className="nb-shelf-card__meta">Tap to add topic</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleUnlockSlot}
                  aria-label="Unlock extra notebook slot for 150 coins"
                  className="nb-shelf-card nb-shelf-card--locked"
                >
                  <span className="nb-shelf-lock-badge slot-glow-card tnum">
                    <span className="slot-glow-plus">+</span>
                    <span className="slot-glow-price">🪙 150</span>
                  </span>
                  <span className="nb-shelf-card__shadow" aria-hidden="true" />
                  <strong className="nb-shelf-card__name">Add Notebook</strong>
                  <span className="nb-shelf-card__meta">150 coins or Plus</span>
                </button>
              </div>
            )}
          </section>
        ) : (
          <div className="open-book-stage">
            {addTopicPanelEl}

            {selectedTopic && (
              <div className="open-book-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setViewMode("shelf");
                  }}
                  className="gbtn gbtn--white gbtn--sm"
                >
                  ← All Notebooks
                </button>

                <div
                  className="open-book-swatches"
                  role="group"
                  aria-label="Customize notebook cover"
                >
                  <span className="mr-1">Cover:</span>
                  {COVER_SWATCHES.map((sw) => {
                    const isSelected = activeCover === sw.id;
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        aria-label={`${sw.label} cover`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          updateState((prev) => ({
                            ...prev,
                            notebookCovers: { ...prev.notebookCovers, [activeBookId]: sw.id },
                          }))
                        }
                        className={cn("live-book-swatch", isSelected && "is-on")}
                        style={{ backgroundColor: sw.color }}
                      >
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.2} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
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

                  <Link
                    href={`/nogs/${nog.id}?teach=feed&topic=${encodeURIComponent(selectedTopic.id)}`}
                    className="gbtn gbtn--leaf gbtn--sm no-underline"
                  >
                    Teach →
                  </Link>
                </div>
              </div>
            )}

            {/* 2-Page Open Book Spread */}
            <section
              aria-label={selectedTopic ? selectedTopic.title : "Topic notes"}
              style={
                {
                  "--book-rim": coverTheme.rim,
                  "--book-rib": coverTheme.rib,
                } as CSSProperties
              }
              className="open-book-cover min-w-0"
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
                        {selectedTopic.status === "pending"
                          ? "Writing…"
                          : `${pages.length} / ${maxPages} pages`}
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
                        href={`/nogs/${nog.id}?teach=feed&topic=${encodeURIComponent(selectedTopic.id)}`}
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
                          className="gbtn gbtn--sm cursor-not-allowed bg-[var(--noggin-sand)] text-[var(--noggin-ink)] opacity-75"
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
                      <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
                      href={`/nogs/${nog.id}?teach=feed&topic=${encodeURIComponent(selectedTopic.id)}`}
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
    </div>
  );
}
