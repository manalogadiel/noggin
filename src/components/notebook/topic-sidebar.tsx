"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type RefObject, useId } from "react";
import type { TopicSummary } from "@/core/application/ports";
import { cn } from "@/lib/utils";

export interface TopicSidebarProps {
  nogId: string;
  topics: ReadonlyArray<TopicSummary>;
  selectedTopicId: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectTopic: (topicId: string) => void;
  isAddOpen: boolean;
  onToggleAdd: () => void;
  draftTitle: string;
  onDraftTitleChange: (value: string) => void;
  onSubmitTopic: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  fieldError: string | null;
  pendingTitle: string | null;
  onRetryPending: () => void;
  statusAlert: string | null;
  newTopicInputRef: RefObject<HTMLInputElement | null>;
}

export function TopicSidebar({
  nogId,
  topics,
  selectedTopicId,
  searchQuery,
  onSearchChange,
  onSelectTopic,
  isAddOpen,
  onToggleAdd,
  draftTitle,
  onDraftTitleChange,
  onSubmitTopic,
  isSubmitting,
  fieldError,
  pendingTitle,
  onRetryPending,
  statusAlert,
  newTopicInputRef,
}: TopicSidebarProps) {
  const searchId = useId();
  const newTopicId = useId();
  const fieldErrorId = useId();

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTopics = normalizedQuery
    ? topics.filter((topic) =>
        topic.title.toLowerCase().includes(normalizedQuery),
      )
    : topics;

  return (
    <aside
      aria-label="Topics"
      className="flex w-full min-w-0 flex-col gap-2.5 rounded-[22px] bg-[rgb(255_253_247_/_0.94)] px-3.5 py-2.5 shadow-[0_5px_0_var(--ng-c-dfd2b2),0_10px_22px_rgb(24_40_8_/_0.14)] backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full shrink-0 sm:w-52">
          <label htmlFor={searchId} className="sr-only">
            Find a topic
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--noggin-ink)]"
          />
          <input
            id={searchId}
            type="search"
            aria-label="Find a topic"
            placeholder="Find a topic"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="min-h-9 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] py-1.5 pr-3.5 pl-9 text-[0.875rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] shadow-[inset_0_2px_6px_rgb(42_66_14_/_0.08)] focus-visible:outline-none"
          />
        </div>

        {filteredTopics.length > 0 ? (
          <ul className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-1.5 p-0 list-none">
            {filteredTopics.map((topic) => {
              const isSelected = topic.id === selectedTopicId;
              const href = `/nogs/${nogId}/notebook?topic=${encodeURIComponent(topic.id)}`;
              return (
                <li key={topic.id} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={isSelected ? "page" : undefined}
                    onClick={() => onSelectTopic(topic.id)}
                    className={cn(
                      "noggin-display inline-flex min-h-9 items-center gap-1.5 rounded-[var(--noggin-radius-pill)] px-3.5 py-1.5 text-[0.875rem] font-extrabold whitespace-nowrap no-underline transition-colors duration-150 motion-reduce:transition-none",
                      isSelected
                        ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_4px_10px_var(--noggin-shadow),inset_0_-2px_6px_var(--noggin-shadow-inset)]"
                        : "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)] hover:bg-[var(--noggin-panel)]",
                    )}
                  >
                    <span>{topic.title}</span>

                    {topic.status === "pending" && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-2 py-0.5 text-[0.7rem] font-semibold",
                          isSelected
                            ? "bg-[var(--noggin-cream)] text-[var(--noggin-forest)]"
                            : "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
                        )}
                      >
                        Writing…
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          topics.length > 0 && (
            <p className="m-0 flex-1 px-2 py-1 text-[0.875rem] font-medium text-[var(--noggin-ink)]">
              No matching topics.
            </p>
          )
        )}

        <button
          type="button"
          aria-expanded={isAddOpen}
          onClick={onToggleAdd}
          className="gbtn gbtn--white gbtn--sm shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Add Topic</span>
        </button>
      </div>

      {(isAddOpen || pendingTitle || statusAlert) && (
        <div className="flex flex-col gap-2.5">
          {isAddOpen && (
            <form
              noValidate
              onSubmit={onSubmitTopic}
              className="flex flex-wrap items-end gap-2.5 rounded-[18px] bg-[var(--noggin-white)] p-3 shadow-[0_6px_18px_var(--noggin-shadow)]"
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
                  onChange={(event) => onDraftTitleChange(event.target.value)}
                  aria-invalid={fieldError ? "true" : undefined}
                  aria-describedby={fieldError ? fieldErrorId : undefined}
                  disabled={isSubmitting}
                  className={cn(
                    "min-h-10 w-full rounded-[14px] px-3.5 py-1.5 text-[0.9375rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus-visible:outline-none",
                    fieldError ? "bg-[var(--noggin-danger-soft)]" : "bg-[var(--noggin-mint)]",
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="noggin-primary-pill noggin-display inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center px-5 text-[0.9375rem] font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Adding…" : "Add"}
              </button>

              {fieldError && (
                <p
                  id={fieldErrorId}
                  role="alert"
                  className="m-0 w-full text-[0.8125rem] font-medium text-[var(--noggin-danger)]"
                >
                  {fieldError}
                </p>
              )}
            </form>
          )}

          {pendingTitle && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-[18px] bg-[var(--noggin-meter-mid-soft)] px-3.5 py-2.5 text-[0.875rem] text-[var(--noggin-meter-mid-ink)]"
            >
              <p className="m-0 font-medium leading-snug">
                Your Nog&rsquo;s questions are being written.
              </p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onRetryPending}
                className="noggin-display inline-flex min-h-9 w-fit cursor-pointer items-center justify-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 text-[0.875rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors duration-150 hover:bg-[var(--noggin-mint-light)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {statusAlert && (
            <p
              role="alert"
              className="m-0 rounded-[16px] bg-[var(--noggin-danger-soft)] px-3.5 py-2 text-[0.875rem] font-medium leading-snug text-[var(--noggin-danger)]"
            >
              {statusAlert}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
