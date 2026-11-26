import { Bath, Utensils } from "lucide-react";
import Link from "next/link";
import type { AnalysisCard } from "@/core/application/use-cases/get-nog-analysis";
import type {
  CardFreshness,
  ThoughtCardStatus,
} from "@/core/domain/thought-card";
import { cn } from "@/lib/utils";

export interface ThoughtCardsSectionProps {
  nogId: string;
  nogName: string;
  cards: ReadonlyArray<AnalysisCard>;
}

const GROUPS: ReadonlyArray<{
  status: ThoughtCardStatus;
  title: string;
  dotClass: string;
  needsBath: boolean;
}> = [
  {
    status: "understood",
    title: "Understood",
    dotClass: "bg-[var(--noggin-meter-high)]",
    needsBath: false,
  },
  {
    status: "shaky",
    title: "Shaky",
    dotClass: "bg-[var(--noggin-meter-mid)]",
    needsBath: true,
  },
  {
    status: "confused",
    title: "Confused",
    dotClass: "bg-[var(--noggin-meter-low)]",
    needsBath: true,
  },
];

const FRESHNESS_META: Record<
  CardFreshness,
  { label: string; badgeClass: string }
> = {
  fresh: {
    label: "Fresh",
    badgeClass: "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)]",
  },
  dusty: {
    label: "Dusty",
    badgeClass:
      "bg-[var(--noggin-meter-mid-soft)] text-[var(--noggin-meter-mid-ink)]",
  },
  forgotten: {
    label: "Forgotten",
    badgeClass: "bg-[var(--noggin-meter-low-soft)] text-[var(--noggin-danger)]",
  },
};

export function ThoughtCardsSection({
  nogId,
  nogName,
  cards,
}: ThoughtCardsSectionProps) {
  const feedHref = `/nogs/${nogId}?teach=feed`;

  return (
    <section
      aria-labelledby="thought-cards-heading"
      className="rounded-[32px] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="thought-cards-heading"
          className="noggin-display text-[clamp(1.375rem,3vw,1.875rem)] font-extrabold text-[var(--noggin-forest)]"
        >
          What {nogName} thinks
        </h2>

        {cards.length > 0 && (
          <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.875rem] font-semibold tabular-nums text-[var(--noggin-forest)]">
            {cards.length} {cards.length === 1 ? "thought" : "thoughts"}
          </span>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-[24px] bg-[var(--noggin-white)] px-6 py-8 text-center shadow-[0_6px_18px_var(--noggin-shadow)] sm:py-10">
          <p className="max-w-[40ch] text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
            {nogName} hasn&rsquo;t learned anything yet.
          </p>

          <Link
            href={feedHref}
            className="noggin-primary-pill noggin-display mt-5 inline-flex min-h-12 items-center justify-center gap-2.5 px-6 text-[1rem] font-bold"
          >
            <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Feed it a lesson</span>
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {GROUPS.map((group) => {
            const groupCards = cards.filter(
              (card) => card.status === group.status,
            );
            if (groupCards.length === 0) {
              return null;
            }

            return (
              <div key={group.status} className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full",
                      group.dotClass,
                    )}
                  />
                  <h3 className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]">
                    {group.title}
                  </h3>
                  <span className="inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums text-[var(--noggin-ink)]">
                    {groupCards.length}
                  </span>
                </div>

                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {groupCards.map((card) => {
                    const freshness = FRESHNESS_META[card.freshness];
                    const bathHref = `/nogs/${nogId}?teach=bath&card=${encodeURIComponent(card.id)}`;

                    return (
                      <li
                        key={card.id}
                        className="flex flex-col justify-between gap-3 rounded-[24px] bg-[var(--noggin-white)] p-4 shadow-[0_6px_18px_var(--noggin-shadow)] sm:p-5"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "h-2.5 w-2.5 shrink-0 rounded-full",
                                  group.dotClass,
                                )}
                              />
                              <span className="noggin-display text-[1rem] font-bold leading-snug text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                                {card.label}
                              </span>
                            </div>

                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center rounded-[var(--noggin-radius-pill)] px-2.5 py-0.5 text-[0.75rem] font-semibold",
                                freshness.badgeClass,
                              )}
                            >
                              {freshness.label}
                            </span>
                          </div>

                          <p className="text-[0.9375rem] leading-relaxed text-[var(--noggin-forest)]">
                            {card.paraphrase}
                          </p>

                          <p className="rounded-[14px] bg-[var(--noggin-mint)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--noggin-ink)]">
                            &ldquo;{card.quote}&rdquo;
                          </p>
                        </div>

                        {group.needsBath && (
                          <div className="pt-1">
                            <Link
                              href={bathHref}
                              className="noggin-primary-pill noggin-display inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[0.875rem] font-bold"
                            >
                              <Bath
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Fix in Bath</span>
                            </Link>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
