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
      <section className="flex flex-col items-center rounded-[28px] bg-[var(--noggin-cream)] p-8 text-center shadow-[0_12px_28px_var(--noggin-shadow)] sm:p-10">
        <p className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
          Nothing yet — teach your Nog something!
        </p>
        <Link
          href="/nogs"
          className="noggin-primary-pill noggin-display mt-5 inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-[1rem] font-bold"
        >
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
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section
          key={group.key}
          className="rounded-[28px] bg-[var(--noggin-cream)] p-5 shadow-[0_12px_28px_var(--noggin-shadow)] sm:p-6"
        >
          <h2 className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
            {group.heading}
          </h2>

          <ol className="mt-3.5 flex flex-col gap-2.5">
            {group.items.map((event) => (
              <li key={`${event.kind}-${event.id}-${event.at}`}>
                <Link
                  href={`/nogs/${event.nogId}`}
                  className="flex items-center justify-between gap-4 rounded-[20px] bg-[var(--noggin-white)] px-4 py-3.5 text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors hover:bg-[var(--noggin-mint)]"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noggin-mint)] text-[var(--noggin-leaf-strong)]">
                      {event.kind === "check" ? (
                        <CircleCheck className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <NotebookPen className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>

                    <div>
                      <p className="noggin-display text-[1rem] font-bold text-[var(--noggin-forest)]">
                        {event.nogName} · {event.topicName}
                      </p>
                      <p className="text-[0.875rem] font-medium text-[var(--noggin-ink)]">
                        {formatEventResult(event)}
                      </p>
                    </div>
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
