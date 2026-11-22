"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { RoomRail } from "@/components/room/room-rail";
import { formatRestBackOnDate, isNogResting } from "@/lib/rest-schedule";

const REST_OPTIONS = [
  { days: 1, label: "In 1 day" },
  { days: 2, label: "In 2 days" },
  { days: 3, label: "In 3 days" },
  { days: 7, label: "In 1 week" },
] as const;

export interface RestViewProps {
  nog: { id: string; name: string };
  restUntil: string | null;
  now?: Date;
  onStartRest: (days: number) => unknown;
  onWake: () => unknown;
}

function extractUpdatedRestUntil(
  result: unknown,
): { found: true; value: string | null } | { found: false } {
  if (typeof result !== "object" || result === null) {
    return { found: false };
  }
  const candidate = result as {
    status?: unknown;
    nog?: { restUntil?: string | null };
  };
  if (candidate.status === "ok" && candidate.nog) {
    return { found: true, value: candidate.nog.restUntil ?? null };
  }
  return { found: false };
}

function extractActionError(result: unknown): string | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }
  const status = (result as { status?: unknown }).status;
  if (status === "unauthenticated") {
    return "Please log in again to update rest.";
  }
  if (status === "not_found") {
    return "We couldn't find this Nog right now.";
  }
  if (status === "invalid") {
    return "Choose one of the rest lengths listed.";
  }
  return null;
}

export function RestView({
  nog,
  restUntil,
  now,
  onStartRest,
  onWake,
}: RestViewProps) {
  const selectId = useId();
  const [fallbackNow] = useState<Date>(() => new Date());
  const [selectedDays, setSelectedDays] = useState<number>(2);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<{
    base: string | null;
    value: string | null;
  } | null>(null);

  const currentRestUntil =
    override && override.base === restUntil ? override.value : restUntil;
  const effectiveNow = now ?? fallbackNow;
  const resting = isNogResting(currentRestUntil, effectiveNow);
  const backOnDate =
    resting && currentRestUntil ? formatRestBackOnDate(currentRestUntil) : "";

  const roomHref = `/nogs/${nog.id}`;
  const notebookHref = `/nogs/${nog.id}/notebook`;

  async function handleStartRest() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await onStartRest(selectedDays);
      const updated = extractUpdatedRestUntil(result);
      if (updated.found) {
        setOverride({ base: restUntil, value: updated.value });
      } else {
        const message = extractActionError(result);
        if (message) {
          setError(message);
        }
      }
    } catch {
      setError("Couldn't start resting right now. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleWake() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await onWake();
      const updated = extractUpdatedRestUntil(result);
      if (updated.found) {
        setOverride({ base: restUntil, value: updated.value });
      } else {
        const message = extractActionError(result);
        if (message) {
          setError(message);
        }
      }
    } catch {
      setError("Couldn't wake your Nog right now. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-w-0 lg:pr-16">
      {resting ? (
        <section className="mx-auto flex w-full max-w-[920px] flex-col items-center py-4 text-center sm:py-8">
          <h1 className="noggin-display text-[clamp(3rem,8vw,7.5rem)] font-extrabold leading-[0.98] tracking-tight text-[var(--noggin-leaf-title)]">
            Nog Resting
          </h1>

          <div className="mt-6 w-full max-w-[480px] sm:mt-8">
            <NogStage
              scene="sleeping"
              poster="/nog/sleeping-books.png"
              alt={`${nog.name} curled up asleep next to a stack of books`}
              width={908}
              height={721}
              sizes="(max-width: 768px) 88vw, 480px"
              priority
              className="mx-auto w-full"
            />
          </div>

          <p
            aria-live="polite"
            className="mt-4 text-[1.125rem] font-semibold text-[var(--noggin-forest)]"
          >
            Back on {backOnDate}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-3 text-[0.9375rem] font-medium text-[var(--noggin-danger)]"
            >
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href={roomHref}
              className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center px-7 text-[1.0625rem] font-bold"
            >
              Return to Nog Room
            </Link>

            <Link
              href={notebookHref}
              className="noggin-primary-pill noggin-display inline-flex min-h-12 items-center justify-center px-7 text-[1.0625rem] font-bold"
            >
              View Notebook
            </Link>

            <button
              type="button"
              onClick={handleWake}
              disabled={pending}
              className="noggin-display inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--noggin-radius-pill)] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-7 text-[1.0625rem] font-bold text-[var(--noggin-forest)] shadow-[0_8px_20px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {pending ? "Waking…" : "Wake Nog"}
            </button>
          </div>
        </section>
      ) : (
        <section className="mx-auto grid w-full max-w-[1160px] grid-cols-1 items-center gap-10 py-4 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12">
          <div className="flex min-w-0 flex-col items-start gap-7">
            <h1 className="noggin-display text-[clamp(3.25rem,6.8vw,6rem)] font-extrabold leading-[0.96] tracking-tight text-[var(--noggin-leaf-title)]">
              Take a{" "}
              <br />
              Rest!
            </h1>

            <div className="flex w-full max-w-[340px] flex-col gap-2.5">
              <label
                htmlFor={selectId}
                className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]"
              >
                Return Later
              </label>

              <div className="relative">
                <select
                  id={selectId}
                  value={String(selectedDays)}
                  onChange={(event) => {
                    setSelectedDays(Number(event.target.value));
                  }}
                  disabled={pending}
                  className="h-13 min-h-12 w-full cursor-pointer appearance-none rounded-[18px] border border-[var(--noggin-leaf)] bg-[var(--noggin-white)] px-4 pr-11 text-[1.0625rem] font-semibold text-[var(--noggin-forest)] shadow-[0_8px_20px_var(--noggin-shadow)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {REST_OPTIONS.map((option) => (
                    <option key={option.days} value={String(option.days)}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-[var(--noggin-leaf-strong)]"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="text-[0.9375rem] font-medium text-[var(--noggin-danger)]"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleStartRest}
              disabled={pending}
              className="noggin-primary-pill noggin-display inline-flex min-h-14 cursor-pointer items-center justify-center px-9 text-[1.1875rem] font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Starting…" : "Start Resting →"}
            </button>
          </div>

          <div className="flex items-center justify-center">
            <NogStage
              scene="sleeping"
              poster="/nog/sleeping-books.png"
              alt={`${nog.name} curled up asleep next to a stack of books`}
              width={908}
              height={721}
              sizes="(max-width: 1024px) 90vw, 560px"
              priority
              className="mx-auto w-full max-w-[540px]"
            />
          </div>
        </section>
      )}

      <RoomRail nogId={nog.id} />
    </div>
  );
}
