import Link from "next/link";
import { CircleCheck, NotebookPen } from "lucide-react";
import type { ActivityEvent } from "@/core/application/ports";

export interface RecentActivityViewProps {
  events: ActivityEvent[];
  now?: Date;
}

function toUtcDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayHeading(eventDate: Date, now: Date): string {
  const todayKey = toUtcDayKey(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = toUtcDayKey(yesterday);
  const eventKey = toUtcDayKey(eventDate);

  if (eventKey === todayKey) {
    return "Today";
  }
  if (eventKey === yesterdayKey) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(eventDate);
}

function formatEventTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
}

function formatEventResult(event: ActivityEvent): string {
  if (event.kind === "check") {
    return `${event.correct}/${event.total} correct`;
  }
  if (event.followUp) {
    return `Answered ${event.nogName}'s question`;
  }
  return "Lesson saved";
}

export function RecentActivityView({
  events,
  now = new Date(),
}: RecentActivityViewProps) {
  if (events.length === 0) {
    return (
      <section className="prof-panel items-center p-8 text-center">
        <p className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
          Nothing yet — teach your Nog something!
        </p>
        <Link href="/nogs" className="gbtn gbtn--leaf mt-3 no-underline">
          Go to My Nogs
        </Link>
      </section>
    );
  }

  const groups: Array<{
    key: string;
    heading: string;
    items: ActivityEvent[];
  }> = [];

  for (const event of events) {
    const parsed = new Date(event.at);
    const validDate = Number.isNaN(parsed.getTime()) ? now : parsed;
    const key = toUtcDayKey(validDate);
    const heading = formatDayHeading(validDate, now);

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.items.push(event);
    } else {
      groups.push({
        key,
        heading,
        items: [event],
      });
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {groups.map((group) => (
        <section key={group.key} className="prof-panel">
          <h2 className="prof-panel__title m-0">{group.heading}</h2>

          <ol className="prof-act-list m-0 list-none p-0">
            {group.items.map((event) => (
              <li key={`${event.kind}-${event.id}-${event.at}`}>
                <Link
                  href={`/nogs/${event.nogId}`}
                  className="prof-act-row no-underline transition-opacity hover:opacity-90"
                >
                  <span className="prof-act-ico shrink-0">
                    {event.kind === "check" ? (
                      <CircleCheck className="h-4 w-4 text-[var(--noggin-leaf-strong)]" aria-hidden="true" />
                    ) : (
                      <NotebookPen className="h-4 w-4 text-[var(--noggin-leaf-strong)]" aria-hidden="true" />
                    )}
                  </span>

                  <div className="prof-act-info">
                    <strong>
                      {event.nogName} · {event.topicName}
                    </strong>
                    <span>{formatEventResult(event)}</span>
                  </div>

                  <time
                    dateTime={event.at}
                    className="shrink-0 text-[0.8125rem] font-semibold text-[var(--noggin-ink)]"
                  >
                    {formatEventTime(event.at)}
                  </time>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
