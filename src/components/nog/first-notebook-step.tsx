"use client";

import { Check, Pencil } from "lucide-react";
import { type FormEvent, type RefObject, useId } from "react";
import { Book3dSvg } from "@/components/game-ui/book-3d-svg";
import type { BookCoverStyle } from "@/components/game-ui/game-ui-context";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { MAX_TOPIC_NAME_LENGTH } from "@/core/domain/topic-name";
import { cn } from "@/lib/utils";

export const NOTEBOOK_COVER_OPTIONS: ReadonlyArray<{
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

export const STARTER_LESSON_TITLES = [
  "TCP Handshake",
  "Cell Mitosis",
  "Derivatives",
  "Philippine History",
] as const;

export interface FirstNotebookStepProps {
  nogName: string;
  bodyColor: string | null;
  notebookTitle: string;
  coverStyle: BookCoverStyle;
  pending: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onNotebookTitleChange: (value: string) => void;
  onCoverStyleChange: (style: BookCoverStyle) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function FirstNotebookStep({
  nogName,
  bodyColor,
  notebookTitle,
  coverStyle,
  pending,
  error,
  headingRef,
  onNotebookTitleChange,
  onCoverStyleChange,
  onSubmit,
}: FirstNotebookStepProps) {
  const titleInputId = useId();
  const titleHelpId = useId();
  const titleErrorId = useId();
  const trimmedTitle = notebookTitle.trim();
  const displayNogName = nogName.trim() || "your Nog";

  return (
    <section
      aria-labelledby="adopt-step-heading"
      className="nb-onboard-layout"
    >
      {/* LEFT: Live 3D Botanical Book + Peeking Customized Baby Nog */}
      <div className="nb-onboard-hero">
        <div className="nb-onboard-aura" aria-hidden="true" />
        <div className="nb-onboard-stage">
          <div className="nb-onboard-book-wrap">
            <Book3dSvg
              style={coverStyle}
              title={trimmedTitle || "First Lesson"}
              uid="onboard-first-book"
              multiline
              className="nb-onboard-book-svg"
            />
          </div>

          <div className="nb-onboard-nog-peek nog-bob" aria-hidden="true">
            <NogStage
              scene="room"
              alt=""
              poster="/nog/blob-closeup.png"
              width={1254}
              height={1254}
              sizes="(min-width: 768px) 156px, 118px"
              tint={bodyColor}
              priority
              decorative
              className="h-full w-full"
            />
          </div>

          <div className="nb-onboard-shadow" aria-hidden="true" />
        </div>
      </div>

      {/* RIGHT: Borderless Tactile Controls */}
      <form onSubmit={onSubmit} className="nb-onboard-controls" noValidate>
        <div className="nb-onboard-head">
          <h1
            id="adopt-step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="nb-onboard-h1 focus:outline-none"
          >
            Name your first notebook
          </h1>
          <p id={titleHelpId} className="nb-onboard-sub">
            Start with any lesson to teach <strong>{displayNogName}</strong>.
          </p>
        </div>

        <div className="nb-onboard-field">
          <label htmlFor={titleInputId} className="cust-heading nb-onboard-label">
            Lesson Title
          </label>
          <div className="nb-onboard-input-wrap">
            <input
              id={titleInputId}
              name="notebookTitle"
              type="text"
              autoComplete="off"
              minLength={1}
              maxLength={MAX_TOPIC_NAME_LENGTH}
              required
              value={notebookTitle}
              onChange={(event) => onNotebookTitleChange(event.target.value)}
              placeholder="e.g. TCP Handshake, Cell Mitosis, Derivatives"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={
                error ? `${titleHelpId} ${titleErrorId}` : titleHelpId
              }
              className="nb-onboard-input"
            />
            <span className="nb-onboard-input-icon" aria-hidden="true">
              <Pencil className="h-4 w-4" strokeWidth={2.4} />
            </span>
          </div>
        </div>

        <div className="nb-onboard-section">
          <span className="nb-onboard-eyebrow">Quick ideas</span>
          <div className="nb-onboard-chips">
            {STARTER_LESSON_TITLES.map((idea) => {
              const isSelected =
                trimmedTitle.toLowerCase() === idea.toLowerCase();
              return (
                <button
                  key={idea}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onNotebookTitleChange(idea)}
                  className={cn("nb-onboard-chip", isSelected && "is-on")}
                >
                  {idea}
                </button>
              );
            })}
          </div>
        </div>

        <div className="nb-onboard-section">
          <span className="nb-onboard-eyebrow">Cover Style</span>
          <div
            role="radiogroup"
            aria-label="Notebook cover style"
            className="nb-onboard-swatches"
          >
            {NOTEBOOK_COVER_OPTIONS.map((sw) => {
              const isSelected = coverStyle === sw.id;
              return (
                <button
                  key={sw.id}
                  type="button"
                  role="radio"
                  aria-label={`${sw.label} cover`}
                  aria-checked={isSelected}
                  onClick={() => onCoverStyleChange(sw.id)}
                  style={{ backgroundColor: sw.color }}
                  className={cn("nb-onboard-swatch", isSelected && "is-selected")}
                >
                  {isSelected && (
                    <Check
                      className="h-5 w-5 stroke-[2.8]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div
            id={titleErrorId}
            role="alert"
            className="w-full rounded-[20px] bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-semibold text-[var(--noggin-danger)]"
          >
            {error}
          </div>
        ) : null}

        <div className="nb-onboard-cta-wrap">
          <button
            type="submit"
            disabled={pending || trimmedTitle.length === 0}
            aria-busy={pending}
            className="cust-done-btn nb-onboard-cta disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Creating notebook…" : "Create Notebook & Enter Room →"}
          </button>
        </div>
      </form>
    </section>
  );
}
