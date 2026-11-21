import type { ThoughtCardRecord } from "@/core/application/ports";
import type { ThoughtCardStatus } from "@/core/domain/thought-card";
import { cn } from "@/lib/utils";

export interface TopicThoughtCardsProps {
  nogName: string;
  cards: ReadonlyArray<ThoughtCardRecord>;
}

const STATUS_META: Record<
  ThoughtCardStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  understood: {
    label: "Understood",
    dotClass: "bg-[var(--noggin-meter-high)]",
    badgeClass: "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]",
  },
  shaky: {
    label: "Shaky",
    dotClass: "bg-[var(--noggin-meter-mid)]",
    badgeClass:
      "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
  },
  confused: {
    label: "Confused",
    dotClass: "bg-[var(--noggin-meter-low)]",
    badgeClass:
      "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]",
  },
};

export function TopicThoughtCards({
  nogName,
  cards,
}: TopicThoughtCardsProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="topic-thought-cards-heading"
      className="flex flex-col gap-3.5 pt-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="topic-thought-cards-heading"
          className="noggin-display text-[1.1875rem] font-extrabold text-[var(--noggin-forest)]"
        >
          What {nogName} thinks
        </h3>

        <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3 py-0.5 text-[0.8125rem] font-semibold tabular-nums text-[var(--noggin-forest)]">
          {cards.length} {cards.length === 1 ? "thought" : "thoughts"}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card) => {
          const meta = STATUS_META[card.status] ?? STATUS_META.shaky;
          return (
            <li
              key={card.id}
              className="flex flex-col gap-2 rounded-[22px] bg-[var(--noggin-white)] p-4 shadow-[0_6px_18px_var(--noggin-shadow)] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      meta.dotClass,
                    )}
                  />
                  <span className="noggin-display text-[1rem] font-bold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                    {card.label}
                  </span>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-2.5 py-0.5 text-[0.75rem] font-semibold",
                    meta.badgeClass,
                  )}
                >
                  {meta.label}
                </span>
              </div>

              <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
                {card.paraphrase}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
