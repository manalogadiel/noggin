"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SpeakButton } from "@/components/voice/speak-button";
import { cn } from "@/lib/utils";

export interface AskCitedNote {
  id: string;
  label: string;
  quote?: string;
}

export interface AskAnswerProps {
  nogName: string;
  answer: string;
  knows: boolean;
  citedNotes: ReadonlyArray<AskCitedNote>;
  messageId?: string;
  teachHref?: string;
}

/** The Nog's answer: its words, the notes it used, a voice button and, when untaught, a way to teach it. */
export function AskAnswer({
  nogName,
  answer,
  knows,
  citedNotes,
  messageId,
  teachHref,
}: AskAnswerProps) {
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const openNote = citedNotes.find((note) => note.id === openNoteId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="[overflow-wrap:anywhere]">{answer}</p>

      {knows && citedNotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[0.75rem] font-semibold text-[var(--noggin-ink)]">
            From my notes
          </p>
          <ul className="flex flex-wrap gap-2">
            {citedNotes.map((note) => {
              const expanded = openNoteId === note.id;
              const chipClass =
                "inline-flex min-h-8 items-center gap-1.5 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3 text-[0.8125rem] font-bold text-[var(--noggin-forest)]";
              return (
                <li key={note.id}>
                  {note.quote ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenNoteId(expanded ? null : note.id)}
                      className={cn(
                        chipClass,
                        "cursor-pointer transition-colors duration-150 hover:bg-[var(--noggin-mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-forest)] motion-reduce:transition-none",
                        expanded && "bg-[var(--noggin-mint)]",
                      )}
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{note.label}</span>
                    </button>
                  ) : (
                    <span className={chipClass}>
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{note.label}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {openNote?.quote && (
            <blockquote className="rounded-[18px] bg-[var(--noggin-cream)] px-4 py-3 text-[0.875rem] font-medium italic text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
              &ldquo;{openNote.quote}&rdquo;
            </blockquote>
          )}
        </div>
      )}

      {(messageId || (!knows && teachHref)) && (
        <div className="flex flex-wrap items-center gap-3">
          {messageId && (
            <SpeakButton messageId={messageId} text={answer} nogName={nogName} />
          )}
          {!knows && teachHref && (
            <Link
              href={teachHref}
              className="noggin-display inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-bold text-[var(--noggin-leaf-strong)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-forest)]"
            >
              <span>Teach me this</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
