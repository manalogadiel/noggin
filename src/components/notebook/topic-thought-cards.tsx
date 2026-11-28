import type { ThoughtCardRecord } from "@/core/application/ports";
import type { ThoughtCardStatus } from "@/core/domain/thought-card";
import { cn } from "@/lib/utils";

export interface TopicThoughtCardsProps {
  nogName: string;
  cards: ReadonlyArray<ThoughtCardRecord>;
}

const STATUS_META: Record<
  ThoughtCardStatus,
  { label: string; stampClass: string }
> = {
  understood: {
    label: "Understood",
    stampClass: "hw-stamp--learned",
  },
  shaky: {
    label: "Shaky",
    stampClass: "hw-stamp--refresh",
  },
  confused: {
    label: "Confused",
    stampClass: "hw-stamp--muddy",
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
      className="flex flex-col gap-3"
    >
      <div className="hw-page-head">
        <h3
          id="topic-thought-cards-heading"
          className="hw-subtitle m-0"
        >
          What {nogName} thinks
        </h3>

        <span className="hw-date-stamp tnum">
          {cards.length} {cards.length === 1 ? "thought" : "thoughts"} · p.2
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {cards.map((card) => {
          const meta = STATUS_META[card.status] ?? STATUS_META.shaky;
          return (
            <li key={card.id} className="hw-entry">
              <div className="hw-entry__top">
                <span className="hw-entry__title [overflow-wrap:anywhere]">
                  {card.label}
                </span>

                <div className="inline-flex flex-wrap items-center gap-1.5">
                  {typeof card.evidenceCount === "number" &&
                    card.evidenceCount > 1 && (
                      <span className="hw-stamp hw-stamp--taught tnum">
                        Taught {card.evidenceCount}×
                      </span>
                    )}

                  <span className={cn("hw-stamp", meta.stampClass)}>
                    {meta.label}
                  </span>
                </div>
              </div>

              <ul className="hw-list">
                <li className="[overflow-wrap:anywhere]">{card.paraphrase}</li>
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
